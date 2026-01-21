# Environment Variables Setup

## Quick Setup

The server currently reads environment variables directly from `process.env`. You have two options:

### Option 1: Set Environment Variables Directly (No .env file needed)

You can set environment variables when starting the server:

```bash
# Linux/Mac
PORT=3001 HOST=0.0.0.0 NODE_ENV=production npm start

# Or export them first
export PORT=3001
export HOST=0.0.0.0
export NODE_ENV=production
export ALLOWED_ORIGINS=https://your-domain.com
npm start
```

### Option 2: Use .env File (Recommended)

1. **Create a `.env` file** in the `RemoteDebug/server/` directory:
   ```bash
   cd RemoteDebug/server
   cp .env.example .env
   ```

2. **Edit the `.env` file** with your values:
   ```bash
   # Development
   PORT=3001
   HOST=0.0.0.0
   NODE_ENV=development
   ALLOWED_ORIGINS=
   
   # Production
   PORT=3001
   HOST=0.0.0.0
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
   ```

3. **Install dotenv package** (optional but recommended):
   ```bash
   npm install dotenv
   ```

4. **Load .env file** in `src/index.js` (add at the very top):
   ```javascript
   import 'dotenv/config';
   ```

## Current Status

The server **works without .env file** - it uses default values:
- `PORT`: 3001 (from `SERVER_CONFIG.DEFAULT_PORT`)
- `HOST`: localhost (from `SERVER_CONFIG.DEFAULT_HOST`)
- `NODE_ENV`: undefined (treated as development)
- `ALLOWED_ORIGINS`: undefined (allows all origins in development)

## For Production

**You MUST set environment variables** for production:

1. Set `NODE_ENV=production`
2. Set `ALLOWED_ORIGINS` to your actual domain(s)
3. Set `HOST=0.0.0.0` to listen on all interfaces

## Quick Start (No .env needed)

The server will work with defaults:
```bash
npm start
```

For production, set environment variables:
```bash
NODE_ENV=production ALLOWED_ORIGINS=https://your-domain.com npm start
```

