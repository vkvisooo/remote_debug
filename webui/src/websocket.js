/**
 * WebSocket Connection Management
 */

import { WS_CONFIG, MESSAGE_TYPES } from './constants';
import { getWebUISessionId } from './utils';

/**
 * Create and setup WebSocket connection
 */
export function createWebSocketConnection(serverUrl, authToken, onOpen, onMessage, onError, onClose) {
  if (!authToken) {
    console.warn('[WebUI] Cannot connect WebSocket: No authentication token available');
    return null;
  }

  const sessionId = getWebUISessionId();
  const wsUrl = `${serverUrl}?${WS_CONFIG.QUERY_PARAM_TYPE}=${WS_CONFIG.TYPE_WEBUI}&${WS_CONFIG.QUERY_PARAM_SESSION_ID}=${sessionId}&token=${encodeURIComponent(authToken)}`;
  
  const websocket = new WebSocket(wsUrl);

  websocket.onopen = () => {
    onOpen(websocket);
  };

  websocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      onMessage(message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  };

  websocket.onerror = (error) => {
    onError(error);
  };

  websocket.onclose = (event) => {
    onClose(event);
  };

  return websocket;
}

/**
 * Check if WebSocket should reconnect
 */
export function shouldReconnectWebSocket(closeEvent) {
  // Only reconnect if:
  // 1. Not a normal closure (1000) - means unexpected disconnect
  // 2. Not closed by server due to duplicate (1008 with specific reason)
  return closeEvent.code !== 1000 &&
    !(closeEvent.code === 1008 && closeEvent.reason.includes('same session'));
}

