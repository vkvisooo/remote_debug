/**
 * Utility Functions
 */

import { EVENT_LIMITS, DEDUP_CONFIG } from './constants';

/**
 * Deduplicate sessions by deviceId, keeping the most recent one
 */
export function deduplicateSessions(sessions) {
  return sessions.reduce((acc, session) => {
    const existing = acc.find(s => s.deviceId === session.deviceId);
    if (!existing) {
      acc.push(session);
    } else if (session.timestamp > existing.timestamp) {
      // Replace with newer session
      const index = acc.indexOf(existing);
      acc[index] = session;
    }
    return acc;
  }, []);
}

/**
 * Create initial device events structure
 */
export function createInitialDeviceEvents() {
  return {
    network: [],
    console: [],
    errors: [],
    playback: [],
    metrics: []
  };
}

/**
 * Create response fingerprint for deduplication
 */
export function createResponseFingerprint(payload, deviceId) {
  return JSON.stringify({
    result: payload.result,
    success: payload.success,
    error: payload.error,
    deviceId: deviceId
  });
}

/**
 * Check if a response is a duplicate
 */
export function isDuplicateResponse(response, recentResponses) {
  const responseFingerprint = createResponseFingerprint(response, response.deviceId);
  const now = Date.now();

  return recentResponses.some(resp => {
    const respFingerprint = createResponseFingerprint(resp, resp.deviceId);
    return respFingerprint === responseFingerprint &&
      (now - resp.timestamp) < DEDUP_CONFIG.DUPLICATE_WINDOW_MS;
  });
}

/**
 * Limit array size to specified max
 */
export function limitArraySize(array, maxSize) {
  return array.slice(-maxSize);
}

/**
 * Add event to device events storage with size limit
 */
export function addEventToStorage(deviceEvents, eventType, eventData, maxSize) {
  const limitedSize = maxSize || EVENT_LIMITS[eventType.toUpperCase().replace('EVENT', '')] || 100;
  
  deviceEvents[eventType].push(eventData);
  deviceEvents[eventType] = limitArraySize(deviceEvents[eventType], limitedSize);
}

/**
 * Get event size limit for event type
 */
export function getEventLimit(eventType) {
  const typeMap = {
    'networkEvent': EVENT_LIMITS.NETWORK,
    'consoleEvent': EVENT_LIMITS.CONSOLE,
    'errorEvent': EVENT_LIMITS.ERRORS,
    'playbackEvent': EVENT_LIMITS.PLAYBACK,
    'metricEvent': EVENT_LIMITS.METRICS
  };
  return typeMap[eventType] || 100;
}

/**
 * Get or create WebUI session ID from localStorage
 * This preserves the WebSocket connection identity across page reloads
 */
export function getWebUISessionId() {
  let sessionId = localStorage.getItem('remoteDebugWebUISessionId');
  if (!sessionId) {
    sessionId = `webui-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('remoteDebugWebUISessionId', sessionId);
  }
  return sessionId;
}

