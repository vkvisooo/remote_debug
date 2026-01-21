# Production Deployment Checklist

## Required Changes for Production

### 1. **CORS Configuration** ⚠️ CRITICAL
Currently allows all origins. Must be restricted in production.

**Current:**
```javascript
app.use(cors());
```

**Production:**
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://your-domain.com'],
  credentials: true
}));
```

### 2. **Environment Variables**
Create `.env` file or set environment variables:

```bash
# Server Configuration
PORT=3001
HOST=0.0.0.0  # Listen on all interfaces for production
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Optional: Logging
LOG_LEVEL=info  # error, warn, info, debug
```

### 3. **Logging Levels**
Currently using `console.error` for everything. Consider:
- Use a logging library (winston, pino)
- Different log levels for production vs development
- Log rotation and storage

### 4. **Security Considerations**

#### Rate Limiting
Add rate limiting to prevent abuse:
```bash
npm install express-rate-limit
```

#### HTTPS/WSS
- Use reverse proxy (nginx, Caddy) with SSL/TLS
- Or use Node.js with `https` module and certificates

#### Input Validation
- Validate WebSocket message payloads
- Sanitize device IDs
- Limit message size

### 5. **Process Management**
Use PM2 or similar for:
- Auto-restart on crash
- Process monitoring
- Log management

```bash
npm install -g pm2
pm2 start dist/server/index.js --name remote-debug-server
pm2 save
pm2 startup
```

### 6. **Health Check & Monitoring**
- Health endpoint already exists at `/health`
- Consider adding metrics endpoint
- Set up monitoring (Prometheus, DataDog, etc.)

### 7. **Resource Limits**
- Max sessions: Currently 5 (configurable via `SESSION_CONFIG.MAX_SESSIONS`)
- WebSocket connection limits
- Memory limits per connection

### 8. **Error Handling**
- Global error handler for uncaught exceptions
- Graceful shutdown on SIGTERM/SIGINT
- Connection cleanup on server shutdown

### 9. **Build & Deployment**
```bash
# Build for production
npm run build

# Start production server
npm start
```

### 10. **Reverse Proxy (Recommended)**
Use nginx or similar:
```nginx
# WebSocket proxy
location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Server Shutdown & Restart

### What Happens on Shutdown?

When the server receives a shutdown signal (SIGTERM, SIGINT, or uncaught exception):
1. **Graceful shutdown process starts**
2. All WebSocket connections are closed
3. HTTP server stops accepting new connections
4. Process exits with `process.exit(0)`

### After Shutdown

**The server process is completely stopped** - it cannot be used again until restarted.

### Restart Options

#### Option 1: Manual Restart
```bash
# Start server again
npm start
# or
node dist/server/index.js
```

#### Option 2: Process Manager (Recommended for Production)
Use PM2 for automatic restart and management:

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/server/index.js --name remote-debug-server

# PM2 will automatically restart if server crashes
# PM2 commands:
pm2 restart remote-debug-server  # Restart manually
pm2 stop remote-debug-server     # Stop server
pm2 start remote-debug-server    # Start server
pm2 logs remote-debug-server     # View logs
pm2 status                       # Check status

# Save PM2 configuration
pm2 save
pm2 startup  # Auto-start on system reboot
```

#### Option 3: Systemd Service (Linux)
Create a systemd service file for automatic restart on boot and crash recovery.

### Important Notes

- **No persistent state**: All sessions and connections are lost on shutdown (in-memory storage)
- **Clients will reconnect**: When server restarts, clients (agents and WebUI) will automatically reconnect
- **Use process manager**: For production, always use PM2 or similar to ensure server restarts automatically

## Quick Production Setup

1. **Set environment variables**
2. **Update CORS configuration**
3. **Build the project**: `npm run build`
4. **Use process manager**: PM2 or systemd (for auto-restart)
5. **Set up reverse proxy** with SSL
6. **Monitor logs and health endpoint**

## Testing Production Readiness

- [ ] CORS is restricted to allowed origins
- [ ] Environment variables are set
- [ ] HTTPS/WSS is configured
- [ ] Rate limiting is enabled
- [ ] Process manager is configured
- [ ] Health check endpoint is accessible
- [ ] Logs are properly configured
- [ ] Error handling is robust
- [ ] Graceful shutdown works

