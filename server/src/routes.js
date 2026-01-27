/**
 * REST API Route Handlers
 */

import { HTTP_STATUS, API_ROUTES, WS_CONFIG, MESSAGE_TYPES, SESSION_CONFIG } from './constants.js';
import { formatSessionForAPI, broadcastToWebUI } from './utils.js';

/**
 * Get all sessions
 */
export function handleGetSessions(sessions) {
  return (req, res) => {
    const sessionList = Array.from(sessions.values()).map(formatSessionForAPI);
    res.json(sessionList);
  };
}

/**
 * Get session by device ID
 */
export function handleGetSessionById(sessions) {
  return (req, res) => {
    const session = sessions.get(req.params.deviceId);
    if (!session) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Session not found' });
    }
    res.json({
      deviceId: session.deviceId,
      deviceName: session.deviceName || null,
      modelName: session.modelName || null,
      drmSupport: session.drmSupport || null,
      status: session.status,
      timestamp: session.timestamp,
      events: session.events,
      metrics: session.metrics
    });
  };
}

/**
 * Get device details (device name and model name)
 */
export function handleGetDeviceDetails(sessions) {
  return (req, res) => {
    const deviceId = req.params.deviceId;
    const session = sessions.get(deviceId);
    if (!session) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Device not found' });
    }
    
    res.json({
      deviceId: session.deviceId,
      deviceName: session.deviceName || null,
      modelName: session.modelName || null,
      drmSupport: session.drmSupport || null,
      status: session.status,
      timestamp: session.timestamp
    });
  };
}

/**
 * Delete session by device ID
 */
export function handleDeleteSession(sessions, deviceConnections, webUIConnections) {
  return (req, res) => {
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
  };
}

/**
 * Health check endpoint
 */
export function handleHealthCheck(sessions, deviceConnections, webUIConnections) {
  return (req, res) => {
    res.json({
      status: 'ok',
      activeSessions: sessions.size,
      maxSessions: SESSION_CONFIG.MAX_SESSIONS,
      connectedDevices: deviceConnections.size,
      webUIConnections: webUIConnections.size
    });
  };
}

