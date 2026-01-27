/**
 * Server Constants
 */

// Session Management
export const SESSION_CONFIG = {
  MAX_SESSIONS: 5,
  STATUS: {
    ACTIVE: 'active',
    SUCCESS: 'success',
    ERROR: 'error'
  }
};

// WebSocket Configuration
export const WS_CONFIG = {
  CLOSE_CODES: {
    INVALID_CONNECTION: 1008,
    NORMAL_CLOSURE: 1000,
    DEVICE_ID_REQUIRED: 1008
  },
  CLOSE_REASONS: {
    INVALID_CONNECTION: 'Invalid connection',
    INVALID_URL: 'Invalid connection URL',
    DEVICE_ID_REQUIRED: 'deviceId required',
    NEW_CONNECTION: 'New connection from same device'
  },
  READY_STATE: {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  },
  QUERY_PARAMS: {
    TYPE: 'type',
    DEVICE_ID: 'deviceId',
    DEVICE_NAME: 'deviceName',
    MODEL_NAME: 'modelName',
  },
  CLIENT_TYPES: {
    DEVICE: 'device',
    WEBUI: 'webui'
  }
};

// Message Types
export const MESSAGE_TYPES = {
  SESSION: 'session',
  SESSIONS: 'sessions',
  SESSION_CREATED: 'sessionCreated',
  SESSION_UPDATED: 'sessionUpdated',
  SESSION_CLOSED: 'sessionClosed',
  SESSION_DELETED: 'sessionDeleted',
  EVENT: 'event',
  RESPONSE: 'response',
  COMMAND: 'command',
  HEARTBEAT: 'heartbeat',
  ERROR: 'error',
  DEVICE_INFO: 'deviceInfo'
};

// Event Types
export const EVENT_TYPES = {
  ERROR: 'errorEvent'
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404
};

// Server Configuration
export const SERVER_CONFIG = {
  DEFAULT_PORT: 3001,
  DEFAULT_HOST: 'localhost'
};

// API Routes
export const API_ROUTES = {
  SESSIONS: '/api/sessions',
  SESSION_BY_ID: '/api/sessions/:deviceId',
  DEVICE_DETAILS: '/api/devices/:deviceId',
  HEALTH: '/health',
  AUTH_LOGIN: '/api/auth/login'
};


