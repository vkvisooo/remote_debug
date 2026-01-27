/**
 * Server Utility Functions
 */

import { SESSION_CONFIG, WS_CONFIG } from './constants.js';

/**
 * Get sessions sorted by deletion priority
 * Priority: oldest successful sessions first, then oldest error sessions
 */
export function getSessionsByDeletionPriority(sessions) {
  const sessionArray = Array.from(sessions.values());
  
  const successfulSessions = sessionArray
    .filter(s => s.status === SESSION_CONFIG.STATUS.SUCCESS)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  const errorSessions = sessionArray
    .filter(s => s.status === SESSION_CONFIG.STATUS.ERROR)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  return [...successfulSessions, ...errorSessions];
}

/**
 * Enforce max sessions limit by deleting oldest sessions
 */
export function enforceMaxSessions(sessions, deviceConnections, maxSessions) {
  if (sessions.size < maxSessions) {
    return;
  }

  const sessionsToDelete = getSessionsByDeletionPriority(sessions);
  let deleted = 0;
  const targetDelete = sessions.size - maxSessions + 1; // +1 for the new session

  for (const session of sessionsToDelete) {
    if (deleted >= targetDelete) break;
    
    // Close connection if exists
    const ws = deviceConnections.get(session.deviceId);
    if (ws && ws.readyState === WS_CONFIG.READY_STATE.OPEN) {
      ws.close();
    }
    
    sessions.delete(session.deviceId);
    deviceConnections.delete(session.deviceId);
    deleted++;
  }
}

/**
 * Broadcast message to all WebUI connections
 */
export function broadcastToWebUI(webUIConnections, message) {
  const messageStr = JSON.stringify(message);
  let sentCount = 0;
  
  webUIConnections.forEach((ws) => {
    const state = ws.readyState;
    if (state === WS_CONFIG.READY_STATE.OPEN) {
      try {
        ws.send(messageStr);
        sentCount++;
      } catch (error) {
        console.error(`[Server] Error sending message to WebUI connection:`, error);
      }
    } else {
      // Remove closed connections from the set
      if (state === WS_CONFIG.READY_STATE.CLOSED || state === WS_CONFIG.READY_STATE.CLOSING) {
        webUIConnections.delete(ws);
      }
    }
  });
  
  
  if (sentCount > 1) {
    console.warn(`[Server] WARNING: Event sent to ${sentCount} WebUI connections - this may cause duplicates!`);
  }
}

/**
 * Parse WebSocket URL and extract query parameters
 */
export function parseWebSocketUrl(request) {
  try {
    const requestUrl = request.url || '/';
    const requestHost = (request.headers && request.headers.host) || 'localhost';
    const url = new URL(requestUrl, `http://${requestHost}`);
    
    return {
      clientType: url.searchParams.get(WS_CONFIG.QUERY_PARAMS.TYPE),
      deviceId: url.searchParams.get(WS_CONFIG.QUERY_PARAMS.DEVICE_ID),
      deviceName: url.searchParams.get(WS_CONFIG.QUERY_PARAMS.DEVICE_NAME),
      modelName: url.searchParams.get(WS_CONFIG.QUERY_PARAMS.MODEL_NAME),
      sessionId: url.searchParams.get('sessionId'), // WebUI session ID
      token: url.searchParams.get('token'), // JWT token for WebUI
      url
    };
  } catch (error) {
    console.error('[Server] Error parsing WebSocket URL:', error);
    throw error;
  }
}

/**
 * Format session for API response
 */
export function formatSessionForAPI(session) {
  return {
    deviceId: session.deviceId,
    deviceName: session.deviceName || null,
    modelName: session.modelName || null,
    drmSupport: session.drmSupport || null,
    status: session.status,
    timestamp: session.timestamp,
    errorCount: session.errorCount,
    eventCount: session.events.length
  };
}

/**
 * Format session for WebUI
 */
export function formatSessionForWebUI(session) {
  return {
    deviceId: session.deviceId,
    deviceName: session.deviceName || null,
    modelName: session.modelName || null,
    drmSupport: session.drmSupport || null,
    status: session.status,
    timestamp: session.timestamp,
    errorCount: session.errorCount
  };
}


