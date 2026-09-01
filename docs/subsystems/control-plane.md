# Control Plane & Client Bridge

> Bidirectional communication gateway connecting CLI commands, external MCP clients, and connected browser/Electron tabs.

**Source:** `src/server/control-plane.ts` · `src/server/client-registry.ts` · `src/core/control-plane-client.ts` · `bin/commands/`

---

## Overview

ShadowClaw provides a real-time **Control Plane** and client bridge that enables external tools and CLI commands to interact directly with connected browser or Electron clients. Connected clients act as persistent execution surfaces with access to local browser features, WebMCP tools, and IndexedDB/OPFS storage.

---

## Architecture & Transports

The Control Plane supports three interchangeable communication transports:

1. **Server-Sent Events + HTTP POST (`sse`, Default & Recommended):**
   - **Server $\rightarrow$ Client:** Persistent HTTP SSE stream (`GET /api/control/events?clientId=...`).
   - **Client $\rightarrow$ Server:** Standard HTTP JSON requests (`POST /api/control/messages`).
   - **Why Default:** Extremely resilient across corporate firewalls, reverse proxies (Nginx, Caddy, Traefik), and cloud edge/CDN setups that do not support or maintain WebSocket connection upgrades.
2. **WebSocket (`websocket`, Opt-in):**
   - Full-duplex WebSocket connection to `/ws/control?token=...`.
   - Useful for low-latency direct connections or environments where WebSockets are preferred.
3. **WebRTC DataChannel (`webrtc`, Peer-to-Peer):**
   - Direct P2P browser-to-CLI communication via PeerJS DataChannels.
   - CLI coordinates via `shadow-claw webrtc listen` and the local IPC socket bridge (`.cache/webrtc-ipc.sock`).
   - Allows headless commands and automation without requiring an active control-plane HTTP/SSE session.

```mermaid
graph TB
    subgraph CLI ["CLI & External Tools"]
        CLI_BIN["shadow-claw CLI (clients, send, backup, tasks)"]
        CLI_LISTEN["webrtc listen (IPC Socket: .cache/webrtc-ipc.sock)"]
        EXT_MCP["External MCP Clients (Hermes, Claude, Cursor)"]
    end

    subgraph Server ["Express Server & Control Plane"]
        SSE_ENDPOINT["/api/control/events (SSE Stream)"]
        MSG_ENDPOINT["/api/control/messages (HTTP POST)"]
        WS_ENDPOINT["/ws/control (WebSocket Server)"]
        PEERJS_SERVER["/peerjs/* (PeerJS Signaling Server)"]
        REST_ROUTES["/api/control/* (REST API)"]
        REGISTRY["Client Registry (SQLite: clients.db)"]
        TOKEN_STORE["Control Token Auth"]
        PUSH_WAKE["Web Push Remote Command Wakeup"]
    end

    subgraph Browser ["Connected Browser Client"]
        CP_CLIENT["src/core/control-plane-client.ts<br>(SSE Default / WS Configurable)"]
        PEERJS_CHANNEL["src/subsystems/channels/peerjs.ts<br>(WebRTC DataChannel)"]
        ORCH["Orchestrator"]
        WEBMCP["WebMCP (document.modelContext)"]
        STORAGE["OPFS Storage"]
    end

    CLI_BIN <-->|REST & WebSocket| WS_ENDPOINT
    CLI_BIN <-->|Local IPC Socket| CLI_LISTEN
    CLI_LISTEN <-->|WebRTC DataChannel| PEERJS_CHANNEL
    EXT_MCP <-->|Standard MCP| REST_ROUTES
    CP_CLIENT -->|SSE Stream (Commands)| SSE_ENDPOINT
    CP_CLIENT -->|HTTP POST (Results)| MSG_ENDPOINT
    CP_CLIENT -.->|Optional WebSocket| WS_ENDPOINT
    PEERJS_CHANNEL <-->|Signaling| PEERJS_SERVER
    WS_ENDPOINT --> REGISTRY
    SSE_ENDPOINT --> REGISTRY
    REGISTRY --> TOKEN_STORE
    WS_ENDPOINT --> PUSH_WAKE

    CP_CLIENT --> ORCH
    CP_CLIENT --> WEBMCP
    CP_CLIENT --> STORAGE
    PEERJS_CHANNEL --> ORCH
```

---

## Protocol Specification

All messages are JSON objects matching the `ControlMessage` envelope:

```ts
interface ControlMessage {
  id: string; // ULID for message/response correlation
  type: string; // Message discriminator
  replyTo?: string; // Request ID when responding
  payload: unknown; // Type-specific payload
}
```

### Message Types

| Message Type        | Direction       | Description                                                                                               |
| :------------------ | :-------------- | :-------------------------------------------------------------------------------------------------------- |
| `client:register`   | Client → Server | Client registration with ID, device label, version, transport, and capabilities                           |
| `server:registered` | Server → Client | Acknowledgement of successful registration                                                                |
| `client:heartbeat`  | Client → Server | Periodic heartbeat to refresh active client timestamp                                                     |
| `command:execute`   | Server → Client | Dispatches a command action (`send-message`, `list-tasks`, `invoke-tool`, `read-state`, `trigger-backup`) |
| `command:result`    | Client → Server | Response containing execution status, result data, or error message                                       |

### Command Payloads

#### `command:execute` Payload

```ts
interface CommandExecutePayload {
  commandId: string;
  action:
    | "send-message"
    | "list-tasks"
    | "trigger-backup"
    | "invoke-tool"
    | "read-state";
  args: Record<string, unknown>;
}
```

#### `command:result` Payload

```ts
interface CommandResultPayload {
  commandId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}
```

---

## Authentication & Security

1. **Control Token:** Connections must supply a secret control token via query parameter (`?token=...`), header (`x-control-token`), or Bearer authorization header (`Authorization: Bearer <token>`).
2. **Token Generation:** On server startup, a token is read from `SHADOWCLAW_CONTROL_TOKEN` or generated and persisted in SQLite (`clients.db` metadata table) and `.cache/control-token.json`.
3. **WebRTC CLI Peer Identity & Trust:** CLI clients connecting over WebRTC identify using a persistent peer ID in `.cache/cli-peer-id`. This ID can be retrieved or renewed using `npx shadow-claw peer-id [--renew|--set <id>]` and must be added in the browser under **Settings → WebRTC/PeerJS → Trusted Peer IDs** when peer restrictions are enabled.
4. **Localhost Binding:** Binds to `127.0.0.1` by default.

---

## Browser Integration & Settings

Browser tabs connect automatically to the Control Plane on startup using `createDefaultControlPlaneClient` when served from a server environment.

### Transport Configuration

Users can toggle between transports in **Settings $\rightarrow$ Integrations $\rightarrow$ Control Plane $\rightarrow$ Control Plane Transport**:

- `Server-Sent Events (SSE + HTTP POST)` — Default
- `WebSocket (Full Duplex)` — Opt-in

### Registered Command Handlers

- `send-message`: Submits message/prompt into Orchestrator queue (supports optional `groupId` e.g. `br:main` or `peer:<peerId>`).
- `list-tasks`: Queries scheduled tasks from IndexedDB.
- `read-state`: Returns current active conversation group and state.
- `invoke-tool`: Invokes WebMCP (`document.modelContext`) tools directly.
- `trigger-backup`: Initiates workspace upload via `BackupController`.

---

## Private Network Access (PNA) & Static Site Integration

When ShadowClaw is accessed from a public static host (e.g. GitHub Pages `https://xt-ml.github.io` or Cloudflare Pages `https://*.pages.dev`) and connected to a local Task Server / Control Plane (`http://127.0.0.1:8888` or `http://localhost:8888`):

1. **Service Worker Loopback Bypass:** The Service Worker fetch proxy (`src/service-worker/fetch-proxy-rules.ts`) unconditionally bypasses all loopback (`localhost`, `127.0.0.1`, `::1`) and private LAN IP ranges so cross-origin requests are handled natively by the browser rather than failing within the Service Worker context.
2. **PNA Headers:** The server (`src/server/middleware/pna.ts`) responds with `Access-Control-Allow-Private-Network: true` on both preflight (`OPTIONS`) and cross-origin requests.
3. **Browser Fetch Options:** Client requests targeting loopback or private network endpoints supply `targetAddressSpace: 'loopback'` (or `'private'`) to satisfy Chromium Private Network Access permissions.
4. **Origin Trust:** The server automatically trusts GitHub Pages (`.github.io`), Cloudflare Pages (`.pages.dev`), and origins configured via `allowedOrigins` or `corsMode: 'all'`.
