# WebUI Deployment Guide

## Multi-Domain/Path Deployment

The WebUI can be deployed to multiple domains or paths by setting the `VITE_BASE_PATH` environment variable during build time.

### Setting the Base Path

The base path is configurable via the `VITE_BASE_PATH` environment variable. You can set it in three ways:

#### Option 1: Environment Variable (Recommended for CI/CD)

```bash
cd RemoteDebug/webui
VITE_BASE_PATH=/your/path/ npm run build
```

#### Option 2: .env File

Create a `.env` file in the `webui` directory:
```bash
VITE_BASE_PATH=/your/path/
```

Then build:
```bash
npm run build
```

#### Option 3: Predefined Scripts

Use the predefined npm scripts:
```bash
npm run build:root    # Builds for root deployment (/)
npm run build:nested  # Builds for /RemoteDebug/webui/dist/webui/
```

### Path Format Rules

**Important Notes:**
- The path must start with `/` and end with `/`
- Spaces in folder names must be URL-encoded as `%20`
- For root deployment, use `/` or omit the variable (defaults to `/`)

### Example Deployments

#### Example 1: Root Deployment
```bash
# Build
VITE_BASE_PATH=/ npm run build
# or simply
npm run build:root

# Deploy to: https://example.com/
```

#### Example 2: Nested Path
```bash
# Build
VITE_BASE_PATH=/app/webui/ npm run build

# Deploy to: https://example.com/app/webui/
```

#### Example 3: Path with Spaces
```bash
# Build (URL encode spaces as %20)
VITE_BASE_PATH=/some%20folder/optionfolder/webui/ npm run build

# Deploy to: https://example.com/some folder/optionfolder/webui/
```

#### Example 4: Multiple Domains
```bash
# Build for domain1.com
VITE_BASE_PATH=/ npm run build
# Deploy dist/webui/ to domain1.com root

# Build for domain2.com/app/
VITE_BASE_PATH=/app/ npm run build
# Deploy dist/webui/ to domain2.com/app/
```

### Examples

#### Example 1: Simple nested path
```
Deployment: https://example.com/app/webui/
.env: VITE_BASE_PATH=/app/webui/
```

#### Example 2: Path with spaces
```
Deployment: https://example.com/some folder/optionfolder/webui/
.env: VITE_BASE_PATH=/some%20folder/optionfolder/webui/
```

#### Example 3: Root deployment
```
Deployment: https://example.com/
.env: VITE_BASE_PATH=/ 
# or omit VITE_BASE_PATH (defaults to /)
```

### Verifying the Build

After building, check the `dist/webui/index.html` file. The script and asset references should use the base path:

```html
<script type="module" src="/your/base/path/assets/index-xxx.js"></script>
<link rel="stylesheet" href="/your/base/path/assets/index-xxx.css">
```

### Troubleshooting

**Issue: Assets not loading (404 errors)**
- Check that `VITE_BASE_PATH` matches your actual deployment path
- Ensure spaces are URL-encoded as `%20`
- Verify the path starts with `/` and ends with `/`

**Issue: Blank page**
- Check browser console for errors
- Verify the base path in `index.html` matches your deployment path
- Ensure all assets are deployed to the correct location

