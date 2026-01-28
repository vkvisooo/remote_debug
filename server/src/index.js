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
  SERVER_CONFIG, 
  API_ROUTES
} from './constants.js';
import { authenticate, authenticateUser, generateToken } from './auth.js';
import { setupWebSocketHandler } from './websocket.js';
import {
  handleGetSessions,
  handleGetSessionById,
  handleGetDeviceDetails,
  handleDeleteSession,
  handleHealthCheck
} from './routes.js';

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

// Authentication endpoint (must be before auth middleware)
app.post(API_ROUTES.AUTH_LOGIN, (req, res) => {
  const { userName, password } = req.body;

  if (!userName || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const result = authenticateUser(userName, password);

  if (!result.success) {
    return res.status(401).json({ error: result.error });
  }

  const token = generateToken(result.user.userName);

  res.json({
    success: true,
    token,
    user: {
      userName: result.user.userName
    }
  });
});

// Authentication middleware (applied to all routes except login and health)
app.use(authenticate);

const server = createServer(app);
const wss = new ws.Server({ server });

// Session management
const sessions = new Map(); // deviceId -> session data (one session per device)
const deviceConnections = new Map(); // deviceId -> WebSocket
const webUIConnections = new Set(); // Set of WebSocket connections from Web UI
const webUISessionMap = new Map(); // sessionId -> WebSocket (to track and close old connections)

// Heartbeat rate limiting: track heartbeats per deviceId
const heartbeatRateLimiter = new Map(); // deviceId -> Array of timestamps

// Setup WebSocket handler
setupWebSocketHandler(wss, sessions, deviceConnections, webUIConnections, webUISessionMap, heartbeatRateLimiter);

// REST API endpoints (protected)
app.get(API_ROUTES.SESSIONS, handleGetSessions(sessions));
app.get(API_ROUTES.SESSION_BY_ID, handleGetSessionById(sessions));
app.get(API_ROUTES.DEVICE_DETAILS, handleGetDeviceDetails(sessions));
app.delete(API_ROUTES.SESSION_BY_ID, handleDeleteSession(sessions, deviceConnections, webUIConnections));
app.get(API_ROUTES.HEALTH, handleHealthCheck(sessions, deviceConnections, webUIConnections));

// 404 handler for debugging
app.use((req, res, next) => {
  console.error(`[Server] 404 - Route not found: ${req.method} ${req.originalUrl || req.path}`);
  res.status(404).json({ error: 'Route not found', path: req.originalUrl || req.path, method: req.method });
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

