/**
 * WebSocket Connection Handlers
 */

import { WS_CONFIG } from './constants.js';
import { parseWebSocketUrl } from './utils.js';
import { verifyToken } from './auth.js';
import {
  handleWebUIConnection,
  closeExistingConnection,
  createOrReuseSession,
  notifySessionReady,
  notifyWebUIOfSession,
  handleDeviceMessage,
  handleDeviceDisconnect
} from './helpers.js';

/**
 * Setup WebSocket server connection handler
 */
export function setupWebSocketHandler(wss, sessions, deviceConnections, webUIConnections, webUISessionMap, heartbeatRateLimiter) {
  wss.on('connection', (ws, req) => {
    try {
      // In ws v1.1.5, req might not be passed, try ws.upgradeReq as fallback
      const request = req || ws.upgradeReq;
      
      if (!request || !request.url) {
        console.warn('[Server] WebSocket connection without valid request object');
        ws.close(WS_CONFIG.CLOSE_CODES.INVALID_CONNECTION, WS_CONFIG.CLOSE_REASONS.INVALID_CONNECTION);
        return;
      }
      
      const { clientType, deviceId, sessionId, token, deviceName, modelName } = parseWebSocketUrl(request);

      if (clientType === WS_CONFIG.CLIENT_TYPES.WEBUI) {
        handleWebUIConnectionRequest(ws, token, sessions, webUIConnections, deviceConnections, sessionId, webUISessionMap);
        return;
      }

      // Device (Agent) connection
      handleDeviceConnection(ws, deviceId, deviceName, modelName, sessions, deviceConnections, webUIConnections, heartbeatRateLimiter);
    } catch (error) {
      console.error('[Server] Error parsing WebSocket URL:', error);
      ws.close(WS_CONFIG.CLOSE_CODES.INVALID_CONNECTION, WS_CONFIG.CLOSE_REASONS.INVALID_URL);
    }
  });
}

/**
 * Handle WebUI connection request
 */
function handleWebUIConnectionRequest(ws, token, sessions, webUIConnections, deviceConnections, sessionId, webUISessionMap) {
  // WebUI connections require JWT token authentication
  if (!token) {
    console.warn(`[Server] WebUI connection rejected: No token provided`);
    ws.close(WS_CONFIG.CLOSE_CODES.INVALID_CONNECTION, 'Authentication required');
    return;
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    console.warn(`[Server] WebUI connection rejected: Invalid or expired token`);
    ws.close(WS_CONFIG.CLOSE_CODES.INVALID_CONNECTION, 'Invalid or expired token');
    return;
  }
  
  handleWebUIConnection(ws, sessions, webUIConnections, deviceConnections, sessionId, webUISessionMap);
}

/**
 * Handle device (agent) connection request
 */
function handleDeviceConnection(ws, deviceId, deviceName, modelName, sessions, deviceConnections, webUIConnections, heartbeatRateLimiter) {
  // Agents are guest users and can connect without authentication
  if (!deviceId) {
    ws.close(WS_CONFIG.CLOSE_CODES.DEVICE_ID_REQUIRED, WS_CONFIG.CLOSE_REASONS.DEVICE_ID_REQUIRED);
    return;
  }

  // Check for existing connection BEFORE closing
  const existingConnection = deviceConnections.get(deviceId);
  if (existingConnection) {
    console.error(`[Server] Device ${deviceId} attempting to create new connection while existing connection is active (state: ${existingConnection.readyState})`);
  }

  // Enforce single connection per device
  closeExistingConnection(deviceId, deviceConnections);

  // Double-check: if connection still exists after close, force remove it
  const stillExists = deviceConnections.get(deviceId);
  if (stillExists && stillExists !== ws) {
    console.log(`[Server] Force removing existing connection for device ${deviceId}`);
    deviceConnections.delete(deviceId);
  }

  // Create or reuse session
  const { session, isNewSession } = createOrReuseSession(deviceId, sessions, deviceConnections, deviceName, modelName);
  deviceConnections.set(deviceId, ws);

  // Notify device that session is ready
  notifySessionReady(ws, deviceId);

  // Notify WebUI of session
  notifyWebUIOfSession(session, isNewSession, webUIConnections);

  // Handle messages from device (agent) - NO AUTHENTICATION REQUIRED
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleDeviceMessage(ws, message, sessions, webUIConnections, heartbeatRateLimiter);
    } catch (error) {
      console.error('[Server] Error handling device message:', error);
    }
  });

  // Handle device disconnect
  ws.on('close', () => {
    handleDeviceDisconnect(deviceId, ws, sessions, deviceConnections, webUIConnections, heartbeatRateLimiter);
  });

  ws.on('error', (error) => {
    console.error(`[Server] WebSocket error for device ${deviceId}:`, error);
  });
}

