/**
 * Agent Constants
 */

// Network Configuration
export const NETWORK_CONFIG = {
  FILTERS: [
    '/beacon',
    '/records',
    '/collect'
  ],
  PHASES: {
    MANIFEST: 'manifest',
    LICENSE: 'license',
    SEGMENT: 'segment',
    OTHER: 'other',
    UNKNOWN: 'unknown'
  },
  PHASE_KEYWORDS: {
    MANIFEST: ['manifest', '.m3u8', '.mpd'],
    LICENSE: ['license', 'drm'],
    SEGMENT: ['segment', '.ts', '.m4s']
  }
};

// Throttling Configuration
export const THROTTLE_CONFIG = {
  BUFFER_LEVEL: 500, // milliseconds
  CONSOLE_BATCH_DELAY: 100 // milliseconds
};

// Reconnection Configuration
export const RECONNECT_CONFIG = {
  MAX_ATTEMPTS: 5,
  INITIAL_DELAY: 1000, // milliseconds
  MAX_DELAY: 30000, // milliseconds
  BACKOFF_MULTIPLIER: 2
};

// Heartbeat Configuration
export const HEARTBEAT_CONFIG = {
  INTERVAL: 30000 // milliseconds (30 seconds)
};

// WebSocket Configuration
export const WS_CONFIG = {
  READY_STATE: {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  },
  QUERY_PARAMS: {
    DEVICE_ID: 'deviceId',
    TYPE: 'type'
  },
  CLIENT_TYPE: 'device',
  PROTOCOLS: {
    HTTP: 'http://',
    HTTPS: 'https://',
    WS: 'ws://',
    WSS: 'wss://'
  }
};

// Message Types
export const MESSAGE_TYPES = {
  SESSION: 'session',
  COMMAND: 'command',
  RESPONSE: 'response',
  EVENT: 'event',
  HEARTBEAT: 'heartbeat'
};

// Event Types
export const EVENT_TYPES = {
  NETWORK: 'networkEvent',
  CONSOLE: 'consoleEvent',
  ERROR: 'errorEvent',
  PLAYBACK: 'playbackEvent',
  METRIC: 'metricEvent'
};

// Console Methods
export const CONSOLE_METHODS = ['log', 'warn', 'error'];

// Device ID Configuration
export const DEVICE_ID_CONFIG = {
  STORAGE_KEYS: {
    CPID: 'CPID',
    REMOTE_DEBUG: 'remoteDebugDeviceId'
  },
  WINDOW_VAR: '__REMOTE_DEBUG_DEVICE_ID__',
  DEFAULT_PREFIX: 'device-'
};

// Server URL Configuration
export const SERVER_URL_CONFIG = {
  WINDOW_VAR: '__REMOTE_DEBUG_SERVER_URL__',
  DEFAULT: 'ws://localhost:3001'
};

// Result Serialization
export const SERIALIZATION = {
  FUNCTION_PLACEHOLDER: '[Function]',
  CIRCULAR_PLACEHOLDER: '[Circular]'
};

// Stack Trace Patterns
export const STACK_TRACE_PATTERNS = {
  FUNCTION_MATCH: /at\s+([^\s(]+)\s+\(([^:]+):(\d+):(\d+)\)/,
  FILE_MATCH: /at\s+([^:]+):(\d+):(\d+)/,
  ANONYMOUS_MATCH: /<anonymous>:(\d+):(\d+)/,
  VM_MATCH: /VM\d+:(\d+):(\d+)/,
  VM_PREFIX: /^VM\d+/
};

