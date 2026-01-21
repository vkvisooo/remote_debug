# Remote Smart TV & Web Debugging Tool

A comprehensive remote debugging solution for Smart TV and Web applications, enabling real-time monitoring and control of network requests, console logs, errors, playback events, and custom metrics.

## Architecture

The project consists of three main components:

1. **Debug Agent** (`agent/`) - JavaScript library that hooks into the target application
2. **Debug Server** (`server/`) - Express.js server managing WebSocket connections
3. **Debug Web UI** (`webui/`) - React-based dashboard for monitoring and control

## Features

### Debug Agent
- ✅ Network request monitoring (fetch & XHR)
- ✅ Console log interception (log/warn/error)
- ✅ Error tracking (window.onerror, unhandled rejections)
- ✅ Player lifecycle event hooks
- ✅ Custom metrics support
- ✅ Whitelisted command execution
- ✅ WebSocket communication with automatic reconnection
- ✅ Bandwidth optimization (throttling & batching)

### Debug Server
- ✅ WebSocket connection management
- ✅ Session management (max 5 sessions globally)
- ✅ Command routing (Web UI → Agent → Response)
- ✅ Event routing (Agent → Web UI)
- ✅ Single connection per device enforcement
- ✅ Session deletion policy (oldest successful first, then errors)
- ✅ REST API for session management

### Debug Web UI
- ✅ Network tab with request details
- ✅ Console tab with log filtering
- ✅ Errors tab with stack traces
- ✅ Playback tab with timeline visualization
- ✅ Metrics tab for custom metrics
- ✅ Command input with whitelist validation
- ✅ Real-time updates via WebSocket
- ✅ Session management sidebar

## Installation

```bash
# Install dependencies for all workspaces
npm install

# Or install individually
cd agent && npm install
cd server && npm install
cd webui && npm install
```

## Development

### Start all components in development mode:

```bash
# Terminal 1: Start Debug Server
npm run dev:server

# Terminal 2: Start Debug Agent (build watch)
npm run dev:agent

# Terminal 3: Start Web UI
npm run dev:webui
```

### Individual commands:

```bash
# Debug Server (port 3001)
cd server && npm run dev

# Debug Agent (watch mode)
cd agent && npm run dev

# Web UI (port 3000)
cd webui && npm run dev
```

## Building

```bash
# Build all components
npm run build

# Build individually
npm run build:agent
npm run build:server
npm run build:webui
```

## Usage

### 1. Start the Debug Server

```bash
cd server
npm start
```

The server will run on `http://localhost:3001` with WebSocket support.

### 2. Integrate Debug Agent into your application

Include the built agent in your TV/Web application:

```html
<script src="path/to/agent/dist/agent/index.js"></script>
<script>
  // Auto-initializes with default settings
  // Or configure manually:
  window.__REMOTE_DEBUG_SERVER_URL__ = 'ws://your-server:3001';
  window.__REMOTE_DEBUG_DEVICE_ID__ = 'my-device-123';
</script>
```

Or as an ES module:

```javascript
import RemoteDebugAgent from './path/to/agent/dist/agent/index.js';

const agent = new RemoteDebugAgent('ws://localhost:3001', 'device-123');
agent.init();
```

### 3. Access the Web UI

Open `http://localhost:3000` in your browser to access the debug dashboard.

### 4. Monitor and Control

- Select an active session from the sidebar
- View real-time events in the respective tabs
- Send whitelisted commands to the device
- Monitor network requests, console logs, errors, and playback events

## Whitelisted Commands

The following commands can be executed safely on the device:

- `getBufferLevel` - Get current buffer level
- `isAdEnabled` - Check if ads are enabled
- `enableDebugMode` - Enable debug mode
- `pausePlayer` - Pause playback
- `resumePlayer` - Resume playback
- `seekTo` - Seek to specific time (requires `{time: number}` parameter)

## Session Management

- **Max Sessions**: 5 globally across all devices
- **Deletion Policy**: 
  1. Delete oldest successful sessions first
  2. If still over limit, delete oldest error sessions
- **Single Connection**: One WebSocket connection per device
- **Error Sessions**: Preserved longer for root cause analysis

## WebSocket Protocol

### Message Format

```json
{
  "type": "command" | "response" | "event" | "heartbeat",
  "sessionId": "string",
  "deviceId": "string",
  "payload": {}
}
```

### Event Types

- `networkEvent` - Network request details
- `consoleEvent` - Console log entries
- `errorEvent` - Error occurrences
- `playbackEvent` - Player state changes
- `metricEvent` - Custom metrics

## API Endpoints

### GET `/api/sessions`
Get list of all active sessions

### GET `/api/sessions/:sessionId`
Get detailed session information

### DELETE `/api/sessions/:sessionId`
Delete a session

### GET `/health`
Health check endpoint

## Security

- ✅ Command whitelist validation
- ✅ TLS support (wss://) for production
- ✅ CORS configuration
- ✅ All commands/events logged
- ✅ Single connection per device enforcement

## Bandwidth Optimization

- Buffer level updates throttled to 500ms
- Console logs batched (100ms delay)
- Event history limited (last 50-200 events per type)

## Development Notes

- All components use separate build pipelines
- Agent uses Vite for building
- Server uses Node.js with Express
- Web UI uses React with Vite
- WebSocket connections use heartbeat (30s interval)
- Automatic reconnection on disconnect

## Project Structure

```
remote-debug-tool/
├── agent/                 # Debug Agent
│   ├── src/
│   │   └── index.js      # Main agent code
│   ├── vite.agent.config.js
│   └── package.json
├── server/                # Debug Server
│   ├── src/
│   │   └── index.js      # Express + WebSocket server
│   ├── build-server.js
│   └── package.json
├── webui/                 # Debug Web UI
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── main.jsx
│   ├── vite.webui.config.js
│   └── package.json
├── package.json           # Root workspace config
└── README.md
```

## License

MIT

