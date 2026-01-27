/**
 * Agent Utility Functions
 */

import { 
  WS_CONFIG, 
  NETWORK_CONFIG, 
  DEVICE_ID_CONFIG, 
  SERVER_URL_CONFIG,
  SERIALIZATION,
  STACK_TRACE_PATTERNS
} from './constants.js';
import { getDeviceInfo } from './helpers.js';

/**
 * Convert HTTP/HTTPS URL to WebSocket URL
 */
export function convertToWebSocketUrl(url) {
  if (!url) {
    throw new Error('Server URL is not defined');
  }

  if (url.startsWith(WS_CONFIG.PROTOCOLS.HTTP)) {
    return url.replace(WS_CONFIG.PROTOCOLS.HTTP, WS_CONFIG.PROTOCOLS.WS);
  } else if (url.startsWith(WS_CONFIG.PROTOCOLS.HTTPS)) {
    return url.replace(WS_CONFIG.PROTOCOLS.HTTPS, WS_CONFIG.PROTOCOLS.WSS);
  } else if (!url.startsWith(WS_CONFIG.PROTOCOLS.WS) && !url.startsWith(WS_CONFIG.PROTOCOLS.WSS)) {
    // If no protocol, assume ws://
    return `${WS_CONFIG.PROTOCOLS.WS}${url}`;
  }
  
  return url;
}

/**
 * Build WebSocket URL with query parameters
 */
export function buildWebSocketUrl(wsUrl, deviceId) {
  try {
    const url = new URL(wsUrl);
    const deviceInfo = getDeviceInfo();
    url.searchParams.set(WS_CONFIG.QUERY_PARAMS.DEVICE_ID, deviceId);
    url.searchParams.set(WS_CONFIG.QUERY_PARAMS.DEVICE_NAME, deviceInfo.deviceName);
    url.searchParams.set(WS_CONFIG.QUERY_PARAMS.MODEL_NAME, deviceInfo.modelName);
    url.searchParams.set(WS_CONFIG.QUERY_PARAMS.TYPE, WS_CONFIG.CLIENT_TYPE);
    return url.toString();
  } catch (urlError) {
    throw new Error(`Invalid URL format: ${wsUrl} - ${urlError.message}`);
  }
}

/**
 * Detect network phase from URL
 */
export function detectNetworkPhase(url) {
  if (!url) return NETWORK_CONFIG.PHASES.UNKNOWN;
  
  const urlStr = url.toString().toLowerCase();
  
  if (NETWORK_CONFIG.PHASE_KEYWORDS.MANIFEST.some(keyword => urlStr.includes(keyword))) {
    return NETWORK_CONFIG.PHASES.MANIFEST;
  }
  
  if (NETWORK_CONFIG.PHASE_KEYWORDS.LICENSE.some(keyword => urlStr.includes(keyword))) {
    return NETWORK_CONFIG.PHASES.LICENSE;
  }
  
  if (NETWORK_CONFIG.PHASE_KEYWORDS.SEGMENT.some(keyword => urlStr.includes(keyword))) {
    return NETWORK_CONFIG.PHASES.SEGMENT;
  }
  
  return NETWORK_CONFIG.PHASES.OTHER;
}

/**
 * Check if network request should be filtered
 */
export function shouldFilterNetworkRequest(url, networkFilters) {
  if (!url) return false;
  const urlStr = typeof url === 'string' ? url : url.toString();
  return networkFilters.some(filter => urlStr.includes(filter));
}

/**
 * Parse stack trace to extract file, line, column, and function info
 */
export function parseStackTrace(stack, source, lineno, colno) {
  const result = {
    fileName: source || '',
    line: lineno || null,
    column: colno || null,
    function: null
  };

  if (stack) {
    const lines = stack.split('\n');
    
    for (const line of lines) {
      // Match: "at functionName (file://path/to/file.js:123:45)"
      const functionMatch = line.match(STACK_TRACE_PATTERNS.FUNCTION_MATCH);
      if (functionMatch) {
        result.function = functionMatch[1];
        result.fileName = functionMatch[2];
        result.line = parseInt(functionMatch[3], 10);
        result.column = parseInt(functionMatch[4], 10);
        if (STACK_TRACE_PATTERNS.VM_PREFIX.test(functionMatch[2])) {
          result.fileName = `eval (${functionMatch[2]})`;
        }
        break;
      }
      
      // Match: "at file://path/to/file.js:123:45" or "VM123:1:8"
      const fileMatch = line.match(STACK_TRACE_PATTERNS.FILE_MATCH);
      if (fileMatch) {
        result.fileName = fileMatch[1];
        result.line = parseInt(fileMatch[2], 10);
        result.column = parseInt(fileMatch[3], 10);
        if (STACK_TRACE_PATTERNS.VM_PREFIX.test(fileMatch[1])) {
          result.fileName = `eval (${fileMatch[1]})`;
        }
        break;
      }
      
      // Match: "<anonymous>:1:8" (from eval)
      const anonymousMatch = line.match(STACK_TRACE_PATTERNS.ANONYMOUS_MATCH);
      if (anonymousMatch) {
        result.fileName = 'eval (<anonymous>)';
        result.line = parseInt(anonymousMatch[1], 10);
        result.column = parseInt(anonymousMatch[2], 10);
        break;
      }
      
      // Match: "VM41493:1:8" (direct eval format)
      const vmMatch = line.match(STACK_TRACE_PATTERNS.VM_MATCH);
      if (vmMatch) {
        const vmId = vmMatch[0].match(/VM(\d+)/)?.[1] || 'unknown';
        result.fileName = `eval (VM${vmId})`;
        result.line = parseInt(vmMatch[1], 10);
        result.column = parseInt(vmMatch[2], 10);
        break;
      }
    }
  } else if (source) {
    result.fileName = source;
    result.line = lineno;
    result.column = colno;
  }

  return result;
}

/**
 * Serialize result for transmission (handle functions, undefined, circular refs, etc.)
 */
export function serializeResult(result) {
  if (result === undefined) {
    return undefined;
  }
  
  if (result === null) {
    return null;
  }
  
  if (typeof result === 'function') {
    return SERIALIZATION.FUNCTION_PLACEHOLDER;
  }
  
  if (typeof result === 'symbol') {
    return result.toString();
  }
  
  if (typeof result === 'object') {
    // Try to serialize, handle circular references
    const seen = new WeakSet();
    try {
      return JSON.parse(JSON.stringify(result, (key, val) => {
        if (val != null && typeof val === 'object') {
          if (seen.has(val)) {
            return SERIALIZATION.CIRCULAR_PLACEHOLDER;
          }
          seen.add(val);
        }
        if (typeof val === 'function') {
          return SERIALIZATION.FUNCTION_PLACEHOLDER;
        }
        if (typeof val === 'symbol') {
          return val.toString();
        }
        return val;
      }));
    } catch (serializeError) {
      // Fallback to string representation
      return String(result);
    }
  }
  
  return result;
}

/**
 * Resolve device ID with priority order
 */
export function resolveDeviceId() {
  // Priority 1: window variable
  let deviceId = window[DEVICE_ID_CONFIG.WINDOW_VAR];
  
  if (!deviceId) {
    // Priority 2: CPID from localStorage
    deviceId = localStorage.getItem(DEVICE_ID_CONFIG.STORAGE_KEYS.CPID);
    
    if (!deviceId) {
      // Priority 3: remoteDebugDeviceId from localStorage or generate new
      deviceId = localStorage.getItem(DEVICE_ID_CONFIG.STORAGE_KEYS.REMOTE_DEBUG) || 
                 `${DEVICE_ID_CONFIG.DEFAULT_PREFIX}${Date.now()}`;
      localStorage.setItem(DEVICE_ID_CONFIG.STORAGE_KEYS.REMOTE_DEBUG, deviceId);
    }
  }
  
  return deviceId;
}

/**
 * Get server URL from window variable or default
 */
export function getServerUrl() {
  return window[SERVER_URL_CONFIG.WINDOW_VAR] || SERVER_URL_CONFIG.DEFAULT;
}

/**
 * Calculate reconnection delay with exponential backoff
 */
export function calculateReconnectDelay(attempt, config) {
  const delay = config.INITIAL_DELAY * Math.pow(config.BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, config.MAX_DELAY);
}

