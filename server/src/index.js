/**
 * Remote Debug Server
 * Manages WebSocket connections and routes commands/events
 */

import express from 'express';
import ws from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { 
  SESSION_CONFIG, 
  WS_CONFIG, 
  MESSAGE_TYPES, 
  SERVER_CONFIG, 
  API_ROUTES,
  HTTP_STATUS 
} from './constants.js';
import { parseWebSocketUrl, formatSessionForAPI, broadcastToWebUI } from './utils.js';
import {
  handleWebUIConnection,
  handleWebUICommand,
  closeExistingConnection,
  createOrReuseSession,
  notifySessionReady,
  notifyWebUIOfSession,
  handleDeviceMessage,
  handleDeviceDisconnect
} from './helpers.js';

const app = express();

// CORS configuration - restrict in production
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : process.env.NODE_ENV === 'production' 
      ? [] // No origins allowed by default in production - must set ALLOWED_ORIGINS
      : true, // Allow all in development
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

const server = createServer(app);
const wss = new ws.Server({ server });

// Session management
const sessions = new Map(); // deviceId -> session data (one session per device)
const deviceConnections = new Map(); // deviceId -> WebSocket
const webUIConnections = new Set(); // Set of WebSocket connections from Web UI
const webUISessionMap = new Map(); // sessionId -> WebSocket (to track and close old connections)

/**
 * Handle WebSocket connection
 */
wss.on('connection', (ws, req) => {
  try {
    // In ws v1.1.5, req might not be passed, try ws.upgradeReq as fallback
    const request = req || ws.upgradeReq;
    
    if (!request || !request.url) {
      console.warn('[Server] WebSocket connection without valid request object');
      ws.close(WS_CONFIG.CLOSE_CODES.INVALID_CONNECTION, WS_CONFIG.CLOSE_REASONS.INVALID_CONNECTION);
      return;
    }
    
    const { clientType, deviceId, sessionId } = parseWebSocketUrl(request);

    if (clientType === WS_CONFIG.CLIENT_TYPES.WEBUI) {
      handleWebUIConnection(ws, sessions, webUIConnections, deviceConnections, sessionId, webUISessionMap);
      return;
    }

    // Device (Agent) connection
    if (!deviceId) {
      ws.close(WS_CONFIG.CLOSE_CODES.DEVICE_ID_REQUIRED, WS_CONFIG.CLOSE_REASONS.DEVICE_ID_REQUIRED);
      return;
    }

    // Check for existing connection BEFORE closing
    const existingConnection = deviceConnections.get(deviceId);
    if (existingConnection) {
      // console.error(`[Server] Device ${deviceId} attempting to create new connection while existing connection is active (state: ${existingConnection.readyState})`);
    }

    // Enforce single connection per device
    closeExistingConnection(deviceId, deviceConnections);

    // Double-check: if connection still exists after close, wait a bit and check again
    const stillExists = deviceConnections.get(deviceId);
    if (stillExists && stillExists !== ws) {
      // Force remove it
      deviceConnections.delete(deviceId);
    }

    // Create or reuse session
    const { session, isNewSession } = createOrReuseSession(deviceId, sessions, deviceConnections);
    deviceConnections.set(deviceId, ws);

    // Notify device that session is ready
    notifySessionReady(ws, deviceId);

    // Notify WebUI of session
    notifyWebUIOfSession(session, isNewSession, webUIConnections);

    // Handle messages from device
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleDeviceMessage(ws, message, sessions, webUIConnections);
      } catch (error) {
        console.error('[Server] Error handling device message:', error);
      }
    });

    // Handle device disconnect
    ws.on('close', () => {
      handleDeviceDisconnect(deviceId, ws, sessions, deviceConnections, webUIConnections);
    });

    ws.on('error', (error) => {
      console.error(`[Server] WebSocket error for device ${deviceId}:`, error);
    });
  } catch (error) {
    console.error('[Server] Error parsing WebSocket URL:', error);
    ws.close(WS_CONFIG.CLOSE_CODES.INVALID_CONNECTION, WS_CONFIG.CLOSE_REASONS.INVALID_URL);
  }
});

// REST API endpoints
app.get(API_ROUTES.SESSIONS, (req, res) => {
  const sessionList = Array.from(sessions.values()).map(formatSessionForAPI);
  res.json(sessionList);
});

app.get(API_ROUTES.SESSION_BY_ID, (req, res) => {
  const session = sessions.get(req.params.deviceId);
  if (!session) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Session not found' });
  }
  res.json({
    deviceId: session.deviceId,
    status: session.status,
    timestamp: session.timestamp,
    events: session.events,
    metrics: session.metrics
  });
});

app.delete(API_ROUTES.SESSION_BY_ID, (req, res) => {
  const session = sessions.get(req.params.deviceId);
  if (!session) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Session not found' });
  }

  const ws = deviceConnections.get(session.deviceId);
  if (ws && ws.readyState === WS_CONFIG.READY_STATE.OPEN) {
    ws.close();
  }

  sessions.delete(req.params.deviceId);
  deviceConnections.delete(session.deviceId);

  broadcastToWebUI(webUIConnections, {
    type: MESSAGE_TYPES.SESSION_DELETED,
    payload: { deviceId: req.params.deviceId }
  });

  res.json({ success: true });
});

// Health check
app.get(API_ROUTES.HEALTH, (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: sessions.size,
    maxSessions: SESSION_CONFIG.MAX_SESSIONS,
    connectedDevices: deviceConnections.size,
    webUIConnections: webUIConnections.size
  });
});

const PORT = process.env.PORT || SERVER_CONFIG.DEFAULT_PORT;
const HOST = process.env.HOST || SERVER_CONFIG.DEFAULT_HOST;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.error(`[Server] Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new connections
  wss.close(() => {
    console.error('[Server] WebSocket server closed');
  });
  
  // Close all existing WebSocket connections
  wss.clients.forEach(client => {
    if (client.readyState === WS_CONFIG.READY_STATE.OPEN) {
      client.close(WS_CONFIG.CLOSE_CODES.NORMAL_CLOSURE, 'Server shutting down');
    }
  });
  
  // Close HTTP server
  server.close(() => {
    console.error('[Server] HTTP server closed');
    console.error('[Server] Shutdown complete. Server must be restarted to use again.');
    process.exit(0);
  });
  
  // Force close after 10 seconds if graceful shutdown doesn't complete
  setTimeout(() => {
    console.error('[Server] Forcing shutdown after timeout...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, HOST, () => {
  const protocol = NODE_ENV === 'production' ? 'wss' : 'ws';
  const hostDisplay = HOST === '0.0.0.0' ? 'all interfaces' : HOST;
  console.error(`[Server] Debug server running on ${hostDisplay}:${PORT}`);
  console.error(`[Server] Environment: ${NODE_ENV}`);
  console.error(`[Server] WebSocket endpoint: ${protocol}://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.error(`[Server] Max sessions: ${SESSION_CONFIG.MAX_SESSIONS}`);
  if (NODE_ENV === 'production') {
    console.error(`[Server] CORS allowed origins: ${corsOptions.origin.length > 0 ? corsOptions.origin.join(', ') : 'NONE (set ALLOWED_ORIGINS env var)'}`);
  }
});

