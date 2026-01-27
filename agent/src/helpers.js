/**
 * Agent Helper Functions
 */

import { 
  MESSAGE_TYPES, 
  EVENT_TYPES, 
  WS_CONFIG, 
  CONSOLE_METHODS,
  THROTTLE_CONFIG,
  RECONNECT_CONFIG
} from './constants.js';
import { 
  parseStackTrace, 
  serializeResult, 
  detectNetworkPhase,
  shouldFilterNetworkRequest
} from './utils.js';

/**
 * Execute JavaScript command with Function constructor
 */
export function executeCommand(command, params) {
  const expr = command.trim();
  
  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    const paramKeys = Object.keys(params);
    const paramValues = Object.values(params);
    
    const func = new Function(
      'window',
      ...paramKeys,
      `try { return ${expr}; } catch(e) { throw e; }`
    );
    return func(window, ...paramValues);
  } else {
    const func = new Function('window', `try { return ${expr}; } catch(e) { throw e; }`);
    return func(window);
  }
}

/**
 * Create error event payload from error
 */
export function createErrorEventPayload(error, stackInfo, command = null) {
  return {
    message: error.message,
    stack: error.stack || '',
    fileName: stackInfo.fileName || 'Command execution',
    line: stackInfo.line,
    column: stackInfo.column,
    function: stackInfo.function || 'Command',
    fatal: false,
    ...(command && { command })
  };
}

/**
 * Create network event data
 */
export function createNetworkEventData(url, method, status, duration, error = null) {
  const networkData = {
    url: typeof url === 'string' ? url : url.toString(),
    method: method || 'GET',
    status: status || 0,
    duration: duration || 0,
    phase: detectNetworkPhase(url)
  };
  
  if (error) {
    networkData.error = error.message || error;
  }
  
  return networkData;
}

/**
 * Format console log arguments
 */
export function formatConsoleArgs(args) {
  return args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
}

/**
 * Check if WebSocket is ready
 */
export function isWebSocketReady(ws) {
  return ws && ws.readyState === WS_CONFIG.READY_STATE.OPEN;
}

/**
 * Check if WebSocket is closed or closing
 */
export function isWebSocketClosed(ws) {
  return ws && (
    ws.readyState === WS_CONFIG.READY_STATE.CLOSED || 
    ws.readyState === WS_CONFIG.READY_STATE.CLOSING
  );
}

/**
 * Check if WebSocket is connecting or open
 */
export function isWebSocketConnectingOrOpen(ws) {
  return ws && (
    ws.readyState === WS_CONFIG.READY_STATE.CONNECTING || 
    ws.readyState === WS_CONFIG.READY_STATE.OPEN
  );
}

/**
 * Create initial player state
 */
export function createInitialPlayerState() {
  return {
    bufferLevel: 0,
    isAdEnabled: false,
    debugMode: false,
    isPaused: false,
    currentTime: 0
  };
}

/**
 * Create initial console log batch
 */
export function createConsoleLogBatch() {
  return {
    batch: [],
    timeout: null
  };
}

/**
 * Check if should throttle buffer level update
 */
export function shouldThrottleBufferLevel(lastSendTime, throttleMs = THROTTLE_CONFIG.BUFFER_LEVEL) {
  return Date.now() - lastSendTime >= throttleMs;
}

/**
 * Calculate reconnection delay with exponential backoff
 */
export function getReconnectDelay(attempt) {
  const delay = RECONNECT_CONFIG.INITIAL_DELAY * Math.pow(RECONNECT_CONFIG.BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, RECONNECT_CONFIG.MAX_DELAY);
}


function isWidevineSupported() {
  if (!isEMESupported()) {
    return Promise.resolve(false);
  }
  try {
  return window.navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
    initDataTypes: ['cenc'],
    videoCapabilities: [{
      contentType: 'video/mp4; codecs="avc1.42E01E"'
    }]
  }]);
  } catch (error) {
    return Promise.resolve(false);
  }
}

export function isEMESupported() {  
  return !!window.navigator.requestMediaKeySystemAccess;
}

function isPlayReadySupported() {
  if (!isEMESupported()) {
    return Promise.resolve(false);
  }
  try {
  return window.navigator.requestMediaKeySystemAccess('com.microsoft.playready', [{
    initDataTypes: ['cenc'],
    videoCapabilities: [{
        contentType: 'video/mp4; codecs="avc1.42E01E"'
      }]
    }]);
  } catch (error) {
    return Promise.resolve(false);
  }
}

function isFairPlaySupported() {
  if (!isEMESupported()) {
    return Promise.resolve(false);
  }
  try { 
    return window.navigator.requestMediaKeySystemAccess('com.apple.fps.1_0', [{
      initDataTypes: ['cenc'],
      videoCapabilities: [{
        contentType: 'video/mp4; codecs="avc1.42E01E"'
      }]
    }]);
  } catch (error) {
    return Promise.resolve(false);
  }
}

export function getSecurityLevelAndSupported() {
  if (!isEMESupported()) {
    return false;
  }
  const names = ['widevine', 'playready', 'fairplay'];
  return Promise.allSettled([
    isWidevineSupported(),
    isPlayReadySupported(),
    isFairPlaySupported()
  ]).then(results => {
    return results.filter((result,index) => {
      return result?.status === 'fulfilled';
    }).map((result,index) => {
      return { 
        name: names[index],
        supported: true 
      };
    });
  }).catch(error => {
    return [];
  });
}

/**
   * Get device information from browser
   */
export function getDeviceInfo() {
  const ua = navigator.userAgent || '';
  const screenInfo = screen?.width && screen?.height
    ? `${screen.width}x${screen.height}`
    : 'unknown';

  const info = {
    deviceName: 'unknown',
    modelName: 'unknown',
    screen: screenInfo,
    ua
  };

  /* -------------------------
     Browser
  -------------------------- */
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) info.browser = 'Safari';
  else if (/Chrome/i.test(ua)) info.browser = 'Chrome';
  else if (/Firefox/i.test(ua)) info.browser = 'Firefox';


  /* -------------------------
     Smart TVs
  -------------------------- */
  if (/Tizen|SMART-TV/i.test(ua)) {
    info.deviceName = 'Smart TV';
    info.modelName = 'Tizen';
    const v = ua.match(/Tizen[\/\s]?(\d+(\.\d+)?)/i);
    if (v) info.osVersion = v[1];
  }

  else if (/webOS|Web0S|LG Browser/i.test(ua)) {
    info.deviceName = 'Smart TV';
    info.modelName = 'webOS';
    const v = ua.match(/webOS[\/\s]?(\d+(\.\d+)?)/i);
    if (v) info.osVersion = v[1];
  }

  /* -------------------------
     iOS / iPadOS
  -------------------------- */
  else if (/iPhone/i.test(ua)) {
    info.deviceName = 'Mobile';
    info.modelName = 'iOS';
  }

  else if (/iPad|Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) {
    info.deviceName = 'Tablet';
    info.modelName = 'iPadOS';
  }

  /* -------------------------
     Android
  -------------------------- */
  else if (/Android/i.test(ua)) {
    info.deviceName = 'Mobile';
    info.modelName = 'Android';
    const v = ua.match(/Android\s([0-9.]+)/);
    if (v) info.osVersion = v[1];
  }

  /* -------------------------
     Desktop
  -------------------------- */
  else if (/Macintosh/i.test(ua)) {
    info.deviceName = 'Desktop';
    info.modelName = 'macOS';
  }

  else if (/Windows/i.test(ua)) {
    info.deviceName = 'Desktop';
    info.modelName = 'Windows';
  }

  else if (/Linux/i.test(ua)) {
    info.deviceName = 'Desktop';
    info.modelName = 'Linux';
  }
  info.deviceName = `${info.deviceName} (${info.screen})`;
  return info;
}