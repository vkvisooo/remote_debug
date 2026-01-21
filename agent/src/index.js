/**
 * Remote Debug Agent
 * Hooks into network, console, errors, and player lifecycle events
 * Communicates with Debug Server via WebSocket
 */

import {
  NETWORK_CONFIG,
  THROTTLE_CONFIG,
  RECONNECT_CONFIG,
  HEARTBEAT_CONFIG,
  WS_CONFIG,
  MESSAGE_TYPES,
  EVENT_TYPES,
  CONSOLE_METHODS
} from './constants.js';
import {
  convertToWebSocketUrl,
  buildWebSocketUrl,
  detectNetworkPhase,
  shouldFilterNetworkRequest,
  parseStackTrace,
  serializeResult,
  resolveDeviceId,
  getServerUrl
} from './utils.js';
import {
  executeCommand,
  createErrorEventPayload,
  createNetworkEventData,
  formatConsoleArgs,
  isWebSocketReady,
  isWebSocketClosed,
  isWebSocketConnectingOrOpen,
  createInitialPlayerState,
  shouldThrottleBufferLevel,
  getReconnectDelay,
  getSecurityLevelAndSupported
} from './helpers.js';

class RemoteDebugAgent {
  constructor(serverUrl, deviceId) {
    this.serverUrl = serverUrl;
    this.deviceId = deviceId;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = RECONNECT_CONFIG.MAX_ATTEMPTS;
    this.heartbeatInterval = null;
    
    // Network filtering
    this.networkFilters = NETWORK_CONFIG.FILTERS;
    
    // Throttling
    this.bufferLevelThrottle = THROTTLE_CONFIG.BUFFER_LEVEL;
    this.lastBufferLevelSend = 0;
    this.consoleLogBatch = [];
    this.consoleBatchTimeout = null;
    this.consoleBatchDelay = THROTTLE_CONFIG.CONSOLE_BATCH_DELAY;
    
    // Original functions to restore
    this.originalFetch = null;
    this.originalXHROpen = null;
    this.originalXHRSend = null;
    this.originalConsole = {};
    
    // Player state
    this.playerState = createInitialPlayerState();
    this.segmentPlaybackTimeoutDelay = 5000; // 5 seconds
    this.segmentPlaybackTimeout = null;
  }

  /**
   * Initialize the debug agent
   */
  async init() {
    try {
      this.hookNetwork();
      this.hookConsole();
      this.hookErrors();
      this.hookPlayback();
      this.connect();
    } catch (error) {
      console.error('[RemoteDebug] Failed to initialize:', error);
    }
  }

  /**
   * Connect to debug server via WebSocket
   */
  connect() {
    // Check if WebSocket is available
    if (typeof WebSocket === 'undefined') {
      console.error('[RemoteDebug] WebSocket is not available in this environment');
      return;
    }

    // Clean up any existing connection that's closed or closing
    if (this.ws) {
      const readyState = this.ws.readyState;
      if (isWebSocketClosed(this.ws)) {
        console.log(`[Agent] Existing connection is closed (state: ${readyState}), cleaning up`);
        this.ws = null;
      } else if (isWebSocketConnectingOrOpen(this.ws)) {
        console.warn(`[Agent] WebSocket is already ${readyState === WS_CONFIG.READY_STATE.CONNECTING ? 'connecting' : 'connected'} (state: ${readyState}), skipping new connection`);
        return;
      } else {
        console.warn(`[Agent] Existing connection in unexpected state: ${readyState}, cleaning up`);
        try {
          this.ws.close();
        } catch (error) {
          console.error('[Agent] Error closing existing connection:', error);
        }
        this.ws = null;
      }
    }

    try {
      // Convert http/https to ws/wss
      const wsUrl = convertToWebSocketUrl(this.serverUrl);
      const finalUrl = buildWebSocketUrl(wsUrl, this.deviceId);
      
      console.log(`[Agent] Creating new WebSocket connection for device: ${this.deviceId}`);
      this.ws = new WebSocket(finalUrl);
      
      if (!this.ws) {
        throw new Error('Failed to create WebSocket instance');
      }
      
      this.ws.onopen = () => {
        console.log(`[Agent] WebSocket connection opened successfully for device: ${this.deviceId}`);
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // Send any pending events that were queued before connection
        if (this.pendingEvents && this.pendingEvents.length > 0) {
          this.pendingEvents.forEach(({ eventType, eventData }) => {
            this.sendEvent(eventType, eventData);
          });
          this.pendingEvents = [];
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[RemoteDebug] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[RemoteDebug] WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('[RemoteDebug] Failed to connect:', error);
      this.attemptReconnect();
    }
  }

  /**
   * Handle incoming messages from server
   */
  handleMessage(message) {
    if (message.type === MESSAGE_TYPES.COMMAND) {
      this.handleCommand(message);
    } else if (message.type === MESSAGE_TYPES.HEARTBEAT) {
      this.sendHeartbeat();
    } else if (message.type === MESSAGE_TYPES.SESSION) {
      // Session is ready - send any pending events
      if (this.pendingEvents && this.pendingEvents.length > 0) {
        this.pendingEvents.forEach(({ eventType, eventData }) => {
          this.sendEvent(eventType, eventData);
        });
        this.pendingEvents = [];
      }
    }
  }

  /**
   * Execute JavaScript commands safely
   * Supports nested property access and method calls like:
   * - window.SPN_PLAYER_OBJ.play()
   * - window[key][key][flag]
   * - window[key][key][method]()
   */
  handleCommand(message) {
    const { command, params } = message.payload;
    
    try {
      let result;
      
      // If command is a string, execute it as JavaScript expression
      if (typeof command === 'string' && command.trim()) {
        const expr = command.trim();
        
        try {
          result = executeCommand(expr, params);
        } catch (evalError) {
          // Capture and report the error as an error event
          const errorStack = evalError.stack || '';
          const stackInfo = parseStackTrace(errorStack, null, null, null);
          
          // Send error event for visibility in Errors tab
          this.sendEvent(EVENT_TYPES.ERROR, {
            message: `Command execution error: ${evalError.message}`,
            ...createErrorEventPayload(evalError, stackInfo, expr)
          });
          
          throw new Error(`Execution error: ${evalError.message}`);
        }
      } else {
        throw new Error('Command must be a non-empty string');
      }

      // Serialize result
      const serializedResult = serializeResult(result);

      this.sendResponse({
        success: true,
        result: serializedResult,
        resultType: typeof result
      });
    } catch (error) {
      // Also send error event for any uncaught errors during command execution
      const errorStack = error.stack || '';
      const stackInfo = parseStackTrace(errorStack, null, null, null);
      
      this.sendEvent(EVENT_TYPES.ERROR, {
        message: `Command error: ${error.message}`,
        ...createErrorEventPayload(error, stackInfo, message.payload?.command)
      });
      
      this.sendResponse({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Send response to server
   */
  sendResponse(payload) {
    this.sendMessage({
      type: MESSAGE_TYPES.RESPONSE,
      deviceId: this.deviceId,
      payload
    });
  }

  /**
   * Send event to server
   */
  sendEvent(eventType, eventData) {
    // Queue events if not connected yet
    if (!isWebSocketReady(this.ws)) {
      // Store events to send later when connected
      if (!this.pendingEvents) {
        this.pendingEvents = [];
      }
      this.pendingEvents.push({ eventType, eventData });
      console.log(`[Agent] Event queued (not connected):`, eventType, `pending: ${this.pendingEvents.length}`);
      return;
    }

    const timestamp = Date.now();
    // console.log(`[Agent] Sending event:`, eventType, `deviceId: ${this.deviceId}`, `timestamp: ${timestamp}`);
    this.sendMessage({
      type: MESSAGE_TYPES.EVENT,
      deviceId: this.deviceId,
      payload: {
        eventType,
        ...eventData,
        timestamp
      }
    });
  }

  /**
   * Send message via WebSocket
   */
  sendMessage(message) {
    if (isWebSocketReady(this.ws)) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Check if a network request should be filtered (excluded)
   */
  shouldFilterNetworkRequest(url) {
    return shouldFilterNetworkRequest(url, this.networkFilters);
  }

  /**
   * Hook into network requests (fetch and XHR)
   */
  hookNetwork() {
    // Hook fetch - prevent double hooking
    if (window.fetch._remoteDebugHooked) {
      return;
    }
    
    this.originalFetch = window.fetch;
    const originalFetchFn = this.originalFetch;
    const agentInstance = this;
    
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const url = args[0];
      const options = args[1] || {};
      const method = options.method || 'GET';

      try {
        const response = await originalFetchFn(...args);
        const duration = Date.now() - startTime;
        
        // Filter out unwanted network requests
        if (agentInstance.shouldFilterNetworkRequest(url)) {
          return response;
        }
        
        const networkData = createNetworkEventData(url, method, response.status, duration);
        agentInstance.sendEvent(EVENT_TYPES.NETWORK, networkData);
        
        // If this is a segment network call, start sending PLAYBACK events every 5 seconds
        if (networkData.phase === NETWORK_CONFIG.PHASES.SEGMENT) {
          agentInstance.startSegmentPlaybackTracking(url);
        }

        return response;
      } catch (error) {
        // Filter out unwanted network requests even on error
        if (!agentInstance.shouldFilterNetworkRequest(url)) {
          const duration = Date.now() - startTime;
          const networkData = createNetworkEventData(url, method, 0, duration, error);
          agentInstance.sendEvent(EVENT_TYPES.NETWORK, networkData);
        }
        throw error;
      }
    };
    window.fetch._remoteDebugHooked = true;

    // Hook XMLHttpRequest - prevent double hooking
    if (window.XMLHttpRequest && XMLHttpRequest.prototype) {
      if (XMLHttpRequest.prototype.open._remoteDebugHooked) {
        return;
      }
      
      // Capture original functions before modifying
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;
      const agentInstance = this; // Capture agent instance

      // Store references for cleanup
      this.originalXHROpen = originalXHROpen;
      this.originalXHRSend = originalXHRSend;

      // Replace open method
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        // Store debug info on the instance
        this._debugMethod = method;
        this._debugUrl = url;
        this._debugStartTime = Date.now();
        
        // Call original open method with proper context
        return originalXHROpen.call(this, method, url, ...rest);
      };
      XMLHttpRequest.prototype.open._remoteDebugHooked = true;

      // Replace send method
      XMLHttpRequest.prototype.send = function(...args) {
        const xhr = this;
        
        // Add loadend listener to track request completion
        xhr.addEventListener('loadend', function() {
          if (xhr._debugStartTime) {
            // Filter out unwanted network requests
            if (agentInstance.shouldFilterNetworkRequest(xhr._debugUrl)) {
              return;
            }
            
            const duration = Date.now() - xhr._debugStartTime;
            const networkData = createNetworkEventData(
              xhr._debugUrl || '',
              xhr._debugMethod || 'GET',
              xhr.status || 0,
              duration
            );
            agentInstance.sendEvent(EVENT_TYPES.NETWORK, networkData);
            
            // If this is a segment network call, start sending PLAYBACK events every 5 seconds
            if (networkData.phase === NETWORK_CONFIG.PHASES.SEGMENT) {
              agentInstance.startSegmentPlaybackTracking(xhr._debugUrl || '');
            }
          }
        });
        
        // Call original send method with proper context
        return originalXHRSend.apply(this, args);
      };
      XMLHttpRequest.prototype.send._remoteDebugHooked = true;
    }
  }


  /**
   * Hook into console methods
   */
  hookConsole() {
    CONSOLE_METHODS.forEach(method => {
      this.originalConsole[method] = console[method];
      console[method] = (...args) => {
        this.originalConsole[method].apply(console, args);
        this.batchConsoleLog(method, args);
      };
    });
  }

  /**
   * Batch console logs to reduce bandwidth
   */
  batchConsoleLog(type, args) {
    this.consoleLogBatch.push({
      type,
      message: formatConsoleArgs(args),
      timestamp: Date.now()
    });

    if (this.consoleBatchTimeout) {
      clearTimeout(this.consoleBatchTimeout);
    }

    this.consoleBatchTimeout = setTimeout(() => {
      if (this.consoleLogBatch.length > 0) {
        this.sendEvent(EVENT_TYPES.CONSOLE, {
          logs: this.consoleLogBatch
        });
        this.consoleLogBatch = [];
      }
    }, this.consoleBatchDelay);
  }


  /**
   * Hook into error handlers
   */
  hookErrors() {
    window.onerror = (message, source, lineno, colno, error) => {
      const errorMessage = error?.message || message;
      const errorStack = error?.stack || `${source}:${lineno}:${colno}`;
      const stackInfo = parseStackTrace(errorStack, source, lineno, colno);

      this.sendEvent(EVENT_TYPES.ERROR, {
        message: errorMessage,
        stack: errorStack,
        fileName: stackInfo.fileName,
        line: stackInfo.line,
        column: stackInfo.column,
        function: stackInfo.function,
        fatal: false
      });
    };

    window.onunhandledrejection = (event) => {
      const reason = event.reason;
      const errorMessage = reason?.message || 'Unhandled promise rejection';
      const errorStack = reason?.stack || '';
      const stackInfo = parseStackTrace(errorStack, null, null, null);

      this.sendEvent(EVENT_TYPES.ERROR, {
        message: errorMessage,
        stack: errorStack,
        fileName: stackInfo.fileName,
        line: stackInfo.line,
        column: stackInfo.column,
        function: stackInfo.function,
        fatal: false
      });
    };
  }

  /**
   * Hook into playback events
   */
  hookPlayback() {
    const isEMESupported = !!window.navigator.requestMediaKeySystemAccess;
    getSecurityLevelAndSupported().then(results => {
      this.emitPlaybackEvent('deviceDetails', { results, isEMESupported });
    });
  }

  /**
   * Emit playback event
   */
  emitPlaybackEvent(state, data = {}) {
    this.sendEvent(EVENT_TYPES.PLAYBACK, {
      state,
      ...data
    });
  }

  /**
   * Start tracking playback for a segment network call
   * Sends PLAYBACK events every 5 seconds with playerState, buffer, and readyState
   */
  startSegmentPlaybackTracking(segmentUrl) {
    console.log('startSegmentPlaybackTracking', this.segmentPlaybackTimeout);
    if (this.segmentPlaybackTimeout) {
      return;
    }

    // Get player state, buffer, and readyState
    const playbackData = this.getPlaybackData();
    // Send initial PLAYBACK event
    this.emitPlaybackEvent('playerState', playbackData);
    // Set up interval to send PLAYBACK events every 5 seconds
    this.segmentPlaybackTimeout = setTimeout(() => {
      const playbackData = this.getPlaybackData();
      this.emitPlaybackEvent('playerState', playbackData);
      this.segmentPlaybackTimeout = null;
    }, this.segmentPlaybackTimeoutDelay);
  }

  /**
   * Get playback data including playerState, buffer, and readyState
   */
  getPlaybackData() {
    const playerState={}
    // Try to get video element from common player objects
    const videoElement = this.getPlayerRef()?.playerDomRef();
    if (videoElement) {
      playerState.readyState = videoElement.readyState || "UNKNOWN";
    }
      playerState.bufferHealth = this.getPlayerRef()?.getBufferHealth() || null;
    return playerState;
  }

  /**
   * Try to find playerRef
   */
  getPlayerRef() {
    return window.SPN_PLAYER_OBJ || window.SPN_PLAYER?.playerObj || null;
  }

  /**
   * Update buffer level (throttled)
   */
  updateBufferLevel(level) {
    this.playerState.bufferLevel = level;
    const now = Date.now();
    if (shouldThrottleBufferLevel(this.lastBufferLevelSend, this.bufferLevelThrottle)) {
      this.emitPlaybackEvent('buffering', { bufferLevel: level });
      this.lastBufferLevelSend = now;
    }
  }

  /**
   * Emit custom metric
   */
  emitMetric(name, value) {
    this.sendEvent(EVENT_TYPES.METRIC, {
      customName: name,
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Start heartbeat
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_CONFIG.INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat
   */
  sendHeartbeat() {
    this.sendMessage({
      type: MESSAGE_TYPES.HEARTBEAT,
      deviceId: this.deviceId
    });
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = getReconnectDelay(this.reconnectAttempts);
      setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  /**
   * Cleanup and disconnect
   */
  destroy() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
    
    // Restore original functions
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    if (this.originalXHROpen) {
      XMLHttpRequest.prototype.open = this.originalXHROpen;
    }
    if (this.originalXHRSend) {
      XMLHttpRequest.prototype.send = this.originalXHRSend;
    }
    Object.keys(this.originalConsole).forEach(method => {
      console[method] = this.originalConsole[method];
    });
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.RemoteDebugAgent = RemoteDebugAgent;
  window.__remoteDebugAgent = null; // Will be set when initialized
}

// Auto-initialization - runs immediately when script loads
(function() {
  'use strict';
  
  if (typeof window === 'undefined') {
    return; // Not in browser environment
  }
  
  try {
    // Prevent multiple initializations
    if (window.__remoteDebugAgent) {
      console.log('[RemoteDebug] Agent already initialized, skipping auto-init');
      return;
    }
    
    // Auto-initialize if server URL is provided
    const serverUrl = getServerUrl();
    const deviceId = resolveDeviceId();
    
    if (typeof RemoteDebugAgent === 'undefined') {
      console.error('[RemoteDebug] ERROR: RemoteDebugAgent class is not defined!');
      return;
    }
    
    window.__remoteDebugAgent = new RemoteDebugAgent(serverUrl, deviceId);
    window.__remoteDebugAgent.init().catch((error) => {
      console.error('[RemoteDebug] Failed to initialize:', error);
    });
  } catch (error) {
    console.error('[RemoteDebug] Fatal error during initialization:', error);
  }
})();

export default RemoteDebugAgent;

