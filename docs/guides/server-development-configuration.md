# Development Server Configuration

> Configure host, port, and CORS behavior for the Express development server.

**Source:** `src/server/server.ts` · `bin/build.sh`

## Overview

The ShadowClaw Express server supports flexible host, port, and CORS configuration via CLI flags and environment variables. This guide covers common setup scenarios.

## Quick Start

```bash
# Default: localhost:8888
npm start

# Custom port
npm start -- 3000

# Listen on all interfaces
npm start -- 8888 --host 0.0.0.0

# Full control
npm start -- 9000 --host 192.168.1.100 --cors-mode all
```

## CLI Flags

### Port

**Position 1** (first positional argument)

```bash
npm start -- 5000          # Listen on port 5000
npm start -- 8888          # Listen on port 8888 (explicit)
```

### Host / IP Binding

**Flags:** `--host`, `--ip`, `--bind-ip`

```bash
npm start -- 8888 --host 0.0.0.0              # All interfaces
npm start -- 8888 --host 127.0.0.1            # Localhost only (secure)
npm start -- 8888 --host 192.168.1.100        # Specific interface
```

**Resolution order:**

1. CLI flag (`--host`, `--ip`, `--bind-ip`)
2. Environment variable (`SHADOWCLAW_HOST`, `SHADOWCLAW_IP`, `SHADOWCLAW_BIND_IP`)
3. Default: `127.0.0.1` (localhost only)

### CORS Mode

**Flag:** `--cors-mode`

```bash
npm start -- 8888 --cors-mode localhost      # Default: localhost:3000, localhost:8888
npm start -- 8888 --cors-mode private        # Also allow 127.0.0.1, ::1, 192.168.*, 10.*, 172.16-31.*
npm start -- 8888 --cors-mode all            # Allow any origin
```

**Modes:**

| Mode        | Allows                                                             |
| ----------- | ------------------------------------------------------------------ |
| `localhost` | `localhost:*`, `127.0.0.1:*` (default)                             |
| `private`   | localhost + private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x) |
| `all`       | Any origin (use only for development)                              |

### CORS Allowlist

**Flag:** `--cors-allow-origin` (repeatable)

```bash
npm start -- 8888 --cors-allow-origin https://example.com
npm start -- 8888 \
  --cors-allow-origin https://example.com \
  --cors-allow-origin https://app.example.com
```

**Can also use environment variable:**

```bash
export SHADOWCLAW_CORS_ALLOWED_ORIGINS="https://example.com,https://app.example.com"
npm start -- 8888
```

## Environment Variables

| Variable                          | Purpose                  | Example                       |
| --------------------------------- | ------------------------ | ----------------------------- |
| `SHADOWCLAW_HOST`                 | Server host (fallback)   | `0.0.0.0`                     |
| `SHADOWCLAW_IP`                   | Server host alias        | `192.168.1.100`               |
| `SHADOWCLAW_BIND_IP`              | Server host alias        | `127.0.0.1`                   |
| `SHADOWCLAW_CORS_MODE`            | CORS policy              | `private`, `all`, `localhost` |
| `SHADOWCLAW_CORS_ALLOWED_ORIGINS` | Explicit allowlist (CSV) | `https://a.com,https://b.com` |

## Common Scenarios

### Local Development (Default)

```bash
npm start
# Listens on http://127.0.0.1:8888
# CORS: localhost only
```

### Network Access Within LAN

```bash
npm start -- 8888 --host 192.168.1.100 --cors-mode private
# Listens on http://192.168.1.100:8888
# Allows connections from 192.168.x.x, 10.x.x.x, 127.0.0.1
```

### Public Server (Restricted)

```bash
npm start -- 8888 \
  --host 0.0.0.0 \
  --cors-allow-origin https://example.com \
  --cors-allow-origin https://app.example.com
# Listens on all interfaces
# CORS: only example.com and app.example.com
```

### Development with Mobile Testing

```bash
npm start -- 8888 --host 0.0.0.0 --cors-mode private
# Listen on all interfaces
# Allow private IP ranges (192.168, 10.*, 172.16-31.*)
# Access via http://<your-computer-ip>:8888 from mobile device
```

### Docker / Container

```bash
# Inside container, listen on all interfaces
npm start -- 8888 --host 0.0.0.0
```

In `docker-compose.yml`:

```yaml
services:
  shadowclaw:
    build: .
    ports:
      - "8888:8888"
    environment:
      - SHADOWCLAW_HOST=0.0.0.0
      - SHADOWCLAW_CORS_MODE=private
```

## Diagnostics

### Check Help

```bash
node dist/server.js --help
```

### Request Logs

The server emits detailed request logs showing:

- **Origin**: Client origin header
- **Client**: Client IP address
- **CORS Status**: Whether request was allowed/blocked
- **Preflight**: If request was a CORS preflight

Example:

```
[CORS] Origin: http://example.com | Client: 192.168.1.50 | Status: ✅ allowed (explicit allowlist)
[CORS] Origin: http://blocked.com | Client: 192.168.1.51 | Status: ❌ blocked (not in allowlist)
```

Use these logs to debug CORS issues when integrating with external apps.

## Modular Route Architecture

The server architecture has been refactored into modular routes and middleware for improved maintainability and security.

### Core Routes (`src/server/routes/`)

- **LLM Proxies**: `bedrock.ts`, `gemini.ts`, `vertex-ai.ts`, `ollama.ts`, `llamafile.ts`, `github-models.ts`
- **Utility**: `oauth.ts` (OAuth flow), `http-proxy.ts` (generic fetch)

### Services (`src/server/services/`)

Long-running or complex backend logic is encapsulated in services:

- `llamafile-manager.ts`: Manages `.llamafile` binary lifecycles
- `transformers-runtime.ts`: Backend runtime for Transformers.js models

### Middleware (`src/server/middleware/`)

- `cors.ts`: Dynamic CORS policy enforcement
- `request-logger.ts`: Detailed diagnostic logging
- `pna.ts`: Private Network Access compliance
- `static-files.ts`: SPA-aware static asset delivery
- `csp.ts`: Content Security Policy (CSP) report-only compliance

## Production Deployment

For production deployments:

1. **Use explicit `--cors-allow-origin`** — never use `--cors-mode all`
2. **Bind to private interface** — e.g., `127.0.0.1` behind a reverse proxy (nginx, AWS ALB, etc.)
3. **Use HTTPS** — ensure all communication is encrypted
4. **Enable request logging** — monitor for unexpected access patterns
5. **Rate limit** — apply rate limiting at proxy/load-balancer level

Example production setup (behind nginx reverse proxy):

```bash
# Server listens only locally
npm start -- 8888 --host 127.0.0.1 --cors-mode localhost
```

**nginx config:**

```nginx
server {
    listen 443 ssl;
    server_name shadowclaw.example.com;

    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## Electron App

The Electron desktop app runs the same Express server in-process. CLI flags don't apply to Electron; instead, configure via Settings or environment variables before launch:

```bash
SHADOWCLAW_HOST=0.0.0.0 SHADOWCLAW_CORS_MODE=private npm run electron
```

## Troubleshooting

### Port Already In Use

```
Error: listen EADDRINUSE :::8888
```

Solution:

```bash
# Use a different port
npm start -- 9000

# Or kill the process using port 8888
lsof -i :8888
kill -9 <PID>
```

### CORS Error in Browser Console

```
Access to XMLHttpRequest has been blocked by CORS policy
```

Causes:

- Request origin not in allowlist
- CORS mode is too restrictive for your setup

Solution:

- Check CORS logs with `--cors-mode private` or add origin with `--cors-allow-origin`
- Verify request origin matches configured allowlist exactly

### Can't Connect from Mobile on LAN

```
Failed to connect to 192.168.1.100:8888
```

Causes:

- Server bound to localhost only
- Firewall blocking port
- Wrong IP address

Solution:

```bash
# Bind to all interfaces and allow private ranges
npm start -- 8888 --host 0.0.0.0 --cors-mode private

# Find your computer's IP
ifconfig | grep "inet "  # macOS/Linux
ipconfig | grep IPv4      # Windows

# Access from mobile: http://<your-ip>:8888
```

### Reverse Proxy Issues

If behind nginx/ALB and getting CORS errors, ensure:

1. Reverse proxy forwards `Host` header
2. Reverse proxy forwards `X-Forwarded-Proto` (for https detection)
3. ShadowClaw CORS setting matches the public URL origin, not the internal proxy URL

Example fix:

```bash
# If public URL is https://shadowclaw.example.com
npm start -- 8888 --host 127.0.0.1 --cors-allow-origin https://shadowclaw.example.com
```
