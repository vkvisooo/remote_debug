/**
 * Server Helper Functions
 */

import { WS_CONFIG, MESSAGE_TYPES, SESSION_CONFIG } from './constants.js';
import { Session } from './models/Session.js';
import { broadcastToWebUI, enforceMaxSessions, formatSessionForWebUI } from './utils.js';

/**
 * Handle WebUI connection
 */
export function handleWebUIConnection(ws, sessions, webUIConnections, deviceConnections, sessionId, webUISessionMap) {
  // First, clean up any closed/stale connections from the set
  const closedConnections = [];
  webUIConnections.forEach(conn => {
    if (conn.readyState === WS_CONFIG.READY_STATE.CLOSED || 
        conn.readyState === WS_CONFIG.READY_STATE.CLOSING) {
      closedConnections.push(conn);
    }
  });
  closedConnections.forEach(conn => {
    webUIConnections.delete(conn);
    // Also remove from session map if it exists
    webUISessionMap.forEach((mappedWs, sid) => {
      if (mappedWs === conn) {
        webUISessionMap.delete(sid);
      }
    });
  });

  // If sessionId is provided, close any existing connection with the same sessionId
  if (sessionId) {
    const existingWs = webUISessionMap.get(sessionId);
    if (existingWs && existingWs !== ws) {
      // Check if the existing connection is still open
      const existingState = existingWs.readyState;
      if (existingState === WS_CONFIG.READY_STATE.OPEN || 
          existingState === WS_CONFIG.READY_STATE.CONNECTING) {
        console.log(`[Server] Closing existing WebUI connection for session: ${sessionId} (state: ${existingState})`);
        try {
          existingWs.close(WS_CONFIG.CLOSE_CODES.INVALID_CONNECTION, 'New connection from same session');
        } catch (error) {
          console.error(`[Server] Error closing existing WebUI connection:`, error);
        }
        // Remove from connections set immediately
        webUIConnections.delete(existingWs);
      } else {
        console.log(`[Server] Existing WebUI connection for session ${sessionId} is already closed (state: ${existingState}), removing from map`);
        // Remove from connections set if it's still there
        webUIConnections.delete(existingWs);
      }
      // Remove from session map
      webUISessionMap.delete(sessionId);
    } else if (existingWs === ws) {
      console.log(`[Server] WebUI connection for session ${sessionId} is the same as existing, no action needed`);
      // Connection already exists and is mapped, but we still need to set up handlers
      // Don't add to set again, but continue to set up handlers below
    } else {
      // Map the new connection to the sessionId
      webUISessionMap.set(sessionId, ws);
    }
  } else {
    // No sessionId provided - check if this exact connection already exists
    if (webUIConnections.has(ws)) {
      console.log(`[Server] WebUI connection already exists in set, skipping duplicate`);
      // Still need to set up handlers, so don't return
    }
  }
  
  // Add the new connection (only if not already in set)
  if (!webUIConnections.has(ws)) {
    webUIConnections.add(ws);
  }
  
  // Warn if multiple connections exist (could be legitimate if multiple browser tabs/windows)
  if (webUIConnections.size > 1) {
    console.warn(`[Server] WARNING: ${webUIConnections.size} WebUI connections active! This may cause duplicate events.`);
  }

  // Send current sessions list
  ws.send(JSON.stringify({
    type: MESSAGE_TYPES.SESSIONS,
    payload: Array.from(sessions.values()).map(formatSessionForWebUI)
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebUIMessage(ws, message, deviceConnections);
    } catch (error) {
      console.error('[Server] Error handling Web UI message:', error);
    }
  });

  ws.on('close', () => {
    webUIConnections.delete(ws);
    // Remove from session map if it exists
    if (sessionId) {
      const mappedWs = webUISessionMap.get(sessionId);
      if (mappedWs === ws) {
        webUISessionMap.delete(sessionId);
      }
    }
  });
}

/**
 * Handle command from WebUI to device
 */
export function handleWebUICommand(webUIWs, message, deviceConnections) {
  const deviceWs = deviceConnections.get(message.deviceId);
  
  if (deviceWs && deviceWs.readyState === WS_CONFIG.READY_STATE.OPEN) {
    deviceWs.send(JSON.stringify({
      type: MESSAGE_TYPES.COMMAND,
      deviceId: message.deviceId,
      payload: message.payload
    }));
  } else {
    webUIWs.send(JSON.stringify({
      type: MESSAGE_TYPES.ERROR,
      payload: { message: 'Device not connected' }
    }));
  }
}

/**
 * Handle WebUI message (wrapper to pass deviceConnections)
 */
export function handleWebUIMessage(ws, message, deviceConnections) {
  if (message.type === MESSAGE_TYPES.COMMAND) {
    handleWebUICommand(ws, message, deviceConnections);
  }
}

/**
 * Close existing connection for a device
 */
export function closeExistingConnection(deviceId, deviceConnections) {
  const existingConnection = deviceConnections.get(deviceId);
  if (existingConnection) {
    const readyState = existingConnection.readyState;
    
    if (readyState === WS_CONFIG.READY_STATE.OPEN || 
        readyState === WS_CONFIG.READY_STATE.CONNECTING) {
      try {
        existingConnection.close(WS_CONFIG.CLOSE_CODES.INVALID_CONNECTION, WS_CONFIG.CLOSE_REASONS.NEW_CONNECTION);
      } catch (error) {
        console.error(`[Server] Error closing existing connection for device ${deviceId}:`, error);
      }
      // Remove immediately to prevent race condition
      deviceConnections.delete(deviceId);
    } else {
      deviceConnections.delete(deviceId);
    }
  } else {
    // console.log(`[Server] No existing connection found for device: ${deviceId}`);
  }
}

/**
 * Create or reuse session for device
 */
export function createOrReuseSession(deviceId, sessions, deviceConnections, deviceName = null, modelName = null) {
  let session = sessions.get(deviceId);
  let isNewSession = false;
  
  if (session) {
    // Reuse existing session - update device info if provided
    session.status = SESSION_CONFIG.STATUS.ACTIVE;
    if (deviceName || modelName) {
      session.updateDeviceInfo(deviceName, modelName, null);
    }
  } else {
    // Create new session
    enforceMaxSessions(sessions, deviceConnections, SESSION_CONFIG.MAX_SESSIONS);
    session = new Session(deviceId, deviceName, modelName);
    sessions.set(deviceId, session);
    isNewSession = true;
  }
  
  return { session, isNewSession };
}

/**
 * Notify device that session is ready
 */
export function notifySessionReady(ws, deviceId) {
  ws.send(JSON.stringify({
    type: MESSAGE_TYPES.SESSION,
    deviceId
  }));
}

/**
 * Notify WebUI of session creation/update
 */
export function notifyWebUIOfSession(session, isNewSession, webUIConnections) {
  const messageType = isNewSession ? MESSAGE_TYPES.SESSION_CREATED : MESSAGE_TYPES.SESSION_UPDATED;
  broadcastToWebUI(webUIConnections, {
    type: messageType,
    payload: {
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      modelName: session.modelName,
      drmSupport: session.drmSupport,
      status: session.status,
      timestamp: session.timestamp
    }
  });
}

/**
 * Handle messages from device (agent)
 * NOTE: No authentication required - agents are guest users
 * Agents can send events, responses, and heartbeats without tokens
 */
export function handleDeviceMessage(ws, message, sessions, webUIConnections, heartbeatRateLimiter) {
  const session = sessions.get(message.deviceId);
  if (!session) {
    console.warn(`[Server] Message from device ${message.deviceId} but no session found`);
    return;
  }

  switch (message.type) {
    case MESSAGE_TYPES.EVENT:
      handleDeviceEvent(session, message, webUIConnections);
      break;
      
    case MESSAGE_TYPES.RESPONSE:
      handleDeviceResponse(session, message, webUIConnections);
      break;
      
    case MESSAGE_TYPES.HEARTBEAT:
      handleDeviceHeartbeat(ws, message, heartbeatRateLimiter);
      break;
      
    case MESSAGE_TYPES.DEVICE_INFO:
      handleDeviceInfo(session, message, webUIConnections);
      break;
      
    default:
      console.warn(`[Server] Unknown message type from device: ${message.type}`);
  }
}

/**
 * Handle event from device
 */
function handleDeviceEvent(session, message, webUIConnections) {
  const eventType = message.payload?.eventType;
  const deviceId = message.deviceId;
  session.addEvent(message.payload);
  broadcastToWebUI(webUIConnections, {
    type: MESSAGE_TYPES.EVENT,
    deviceId: deviceId,
    payload: message.payload
  });
}

/**
 * Handle response from device
 */
function handleDeviceResponse(session, message, webUIConnections) {
  session.markSuccess();
  broadcastToWebUI(webUIConnections, {
    type: MESSAGE_TYPES.RESPONSE,
    deviceId: message.deviceId,
    payload: message.payload
  });
}

/**
 * Handle device info from device
 * Device info is stored but not broadcast via WebSocket
 * WebUI should fetch it via REST API when needed
 */
function handleDeviceInfo(session, message, webUIConnections) {
  const { deviceName, modelName, drmSupport } = message.payload || {};
  if (deviceName || modelName || drmSupport) {
    session.updateDeviceInfo(deviceName, modelName, drmSupport);
  }
}

// Constants for heartbeat rate limiting
const HEARTBEAT_MAX_PER_SECOND = 20;
const HEARTBEAT_WINDOW_MS = 1000; // 1 second

/**
 * Handle heartbeat from device with rate limiting
 */
function handleDeviceHeartbeat(ws, message, heartbeatRateLimiter) {
  const deviceId = message.deviceId;
  const now = Date.now();
  
  // Get or create heartbeat timestamps array for this device
  if (!heartbeatRateLimiter.has(deviceId)) {
    heartbeatRateLimiter.set(deviceId, []);
  }
  
  const timestamps = heartbeatRateLimiter.get(deviceId);
  
  // Remove timestamps older than 1 second
  const cutoff = now - HEARTBEAT_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
  
  // Check if rate limit exceeded
  if (timestamps.length >= HEARTBEAT_MAX_PER_SECOND) {
    // Rate limit exceeded, ignore this heartbeat
    console.warn(`[Server] Heartbeat rate limit exceeded for device ${deviceId}: ${timestamps.length} heartbeats in last second`);
    return;
  }
  
  // Add current timestamp
  timestamps.push(now);
  
  // Send heartbeat response
  ws.send(JSON.stringify({
    type: MESSAGE_TYPES.HEARTBEAT,
    deviceId: deviceId
  }));
}

/**
 * Handle device disconnect
 */
export function handleDeviceDisconnect(deviceId, ws, sessions, deviceConnections, webUIConnections, heartbeatRateLimiter) {

  const currentConnection = deviceConnections.get(deviceId);
  if (currentConnection === ws) {
    deviceConnections.delete(deviceId);
  }
  
  // Clean up heartbeat rate limiter for this device
  if (heartbeatRateLimiter) {
    heartbeatRateLimiter.delete(deviceId);
  }
  
  const session = sessions.get(deviceId);
  if (session) {
    session.markSuccess();
    broadcastToWebUI(webUIConnections, {
      type: MESSAGE_TYPES.SESSION_CLOSED,
      payload: { deviceId }
    });
  }
}

