/**
 * Application Constants
 */

// WebSocket Configuration
export const WS_CONFIG = {
  RECONNECT_DELAY: 3000, // milliseconds
  QUERY_PARAM_TYPE: "type",
  QUERY_PARAM_SESSION_ID: "sessionId",
  TYPE_WEBUI: "webui",
};

// Event Storage Limits
export const EVENT_LIMITS = {
  NETWORK: 100,
  CONSOLE: 200,
  ERRORS: 50,
  PLAYBACK: 100,
  METRICS: 100,
  COMMAND_RESPONSES: 50,
};

// Response Deduplication
export const DEDUP_CONFIG = {
  RECENT_RESPONSES_CHECK: 5,
  DUPLICATE_WINDOW_MS: 2000,
};

// Event Types
export const EVENT_TYPES = {
  NETWORK: "networkEvent",
  CONSOLE: "consoleEvent",
  ERROR: "errorEvent",
  PLAYBACK: "playbackEvent",
  METRIC: "metricEvent",
};

// Message Types
export const MESSAGE_TYPES = {
  SESSIONS: "sessions",
  SESSION_CREATED: "sessionCreated",
  SESSION_UPDATED: "sessionUpdated",
  SESSION_CLOSED: "sessionClosed",
  SESSION_DELETED: "sessionDeleted",
  EVENT: "event",
  RESPONSE: "response",
  COMMAND: "command",
  ERROR: "error",
};

// Tab IDs
export const TAB_IDS = {
  NETWORK: "network",
  CONSOLE: "console",
  ERRORS: "errors",
  PLAYBACK: "playback",
  METRICS: "metrics",
};

// Default Values
export const DEFAULTS = {
  ACTIVE_TAB: TAB_IDS.NETWORK,
  SERVER_URL: "wss://ws.apni-duniya.com",
  // SERVER_URL: 'ws://localhost:3001'
};
