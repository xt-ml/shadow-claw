# ADR: Server-to-Server A2A Protocol v1.0 (HTTP + JSON-RPC 2.0 Binding)

## Status

Accepted — Implemented

## Context

ShadowClaw previously supported agent-to-agent collaboration exclusively over WebRTC DataChannel via PeerJS for browser and desktop clients (`docs/decisions/peer-protocol-a2a-agui.md`). While WebRTC DataChannel excels at real-time browser-to-browser P2P communication, server-side ShadowClaw instances running in headless environments, containers, and proxy/control-plane architectures required a direct, connection-oriented HTTP transport.

Key requirements:

1. **Server-to-Server Collaboration:** Two or more ShadowClaw server instances running on remote hosts or local ports must be able to discover each other, exchange agent capability cards, submit tasks, monitor execution, and receive streamed responses.
2. **Zero Regressions & Full Compatibility:** The existing WebRTC DataChannel binding (`https://xt-ml.github.io/shadow-claw/bindings/webrtc-datachannel/v1`), GitHub Pages static hosting, Stateless MCP routes, and control plane bridges must remain 100% operational without regression.
3. **Spec Alignment:** Full compliance with Agent-to-Agent Protocol (A2A) v1.0 specifications for discovery, wire protocol, task states, and streaming.
4. **Lightweight & Dependency-Free:** Avoid heavy, conflicting external libraries like `a2a-js` (which targets legacy v0.3.x drafts and conflicting dependencies); leverage existing codebase primitives and native Node.js HTTP capabilities.

## Decision

Implement standard A2A v1.0 HTTP + JSON-RPC 2.0 server endpoints and an accompanying HTTP client within `src/server/a2a/`.

### Protocol Binding Identifier

Standard A2A v1.0 JSON-RPC 2.0 binding:

```
protocolBinding: "JSONRPC"
protocolVersion: "1.0"
```

### Discovery & Endpoints

| Endpoint                       | Method | Purpose                                                                                                                     |
| ------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/.well-known/agent-card.json` | `GET`  | Agent discovery; returns `AgentCard` describing name, version, supported interfaces, capabilities, and advertised skills.   |
| `/a2a`                         | `POST` | Primary JSON-RPC 2.0 wire protocol handling `SendMessage`, `GetTask`, `CancelTask`, `ListTasks`, and `GetAgentCard`.        |
| `/a2a/tasks/:taskId`           | `GET`  | Server-Sent Events (SSE) streaming task lifecycle events (`TaskStatusUpdateEvent`, `TaskArtifactUpdateEvent`, `AGUIEvent`). |

### Canonical Type Reuse

All A2A v1.0 data types (`A2ATask`, `TaskStatus`, `TaskState`, `A2AMessage`, `Part`, `Artifact`, `AgentCard`, `A2AJsonRpcRequest`, `A2AJsonRpcResponse`, `A2A_METHOD`, `A2A_ERROR_CODE`) are imported directly from `src/subsystems/channels/peer-protocol.ts`. No duplicate protocol data models are created.

## Architecture

```
                                  A2A v1.0 HTTP
  ShadowClaw Node A                                    ShadowClaw Node B
+-------------------+                                +-------------------+
|                   |  GET /.well-known/agent-card   |                   |
|                   | -----------------------------> |  Agent Discovery  |
|                   | <----------------------------- |                   |
|                   |                                |                   |
|  A2AHttpClient    |  POST /a2a (SendMessage)       |  A2AHttpServer    |
|                   | -----------------------------> |  (Task Execution) |
|                   | <----------------------------- |                   |
|                   |                                |         |         |
|                   |  GET /a2a/tasks/:taskId (SSE)  |         v         |
|                   | -----------------------------> |   A2ATaskStore    |
|                   | < - - - - - - - - - - - - - -  |   (LRU Cache)     |
+-------------------+                                +-------------------+
```

### Components

1. **Agent Card Builder (`src/server/a2a/agent-card-builder.ts`):** Constructs the canonical `AgentCard` advertising the HTTP JSON-RPC endpoint at `/a2a`, version, skills, and streaming capability.
2. **Task Store (`src/server/a2a/a2a-task-store.ts`):** Server-wide in-memory task registry managing the A2A v1.0 task lifecycle:
   `SUBMITTED` &rarr; `WORKING` &rarr; `COMPLETED` / `FAILED` / `CANCELED`. Enforces terminal state protections, supports cursor pagination, LRU eviction (`DEFAULT_A2A_MAX_TASKS = 500`), and real-time subscription.
3. **HTTP Server Handler (`src/server/a2a/a2a-http-server.ts`):** Validates and dispatches JSON-RPC 2.0 requests, coordinate task execution, and emits events.
4. **Route Registration (`src/server/a2a/routes.ts`):** Mounts discovery, JSON-RPC, and SSE endpoints into the Express application, complete with CORS, Private Network Access headers, and optional `x-control-token` / `Bearer` authentication.
5. **HTTP Client (`src/server/a2a/a2a-http-client.ts`):** Native Node.js `http`/`https` client allowing any ShadowClaw server instance to discover, delegate tasks to, monitor, and stream results from any remote A2A-compliant server.

### Configuration

Server-to-server A2A support is opt-in:

- **CLI Flag:** `--a2a` enables the server endpoints.
- **Environment Variable:** `SHADOWCLAW_A2A=1` enables the endpoints.
- **Peer discovery:** The HTTP client can connect to a known A2A endpoint, but the server does not yet maintain a configured peer registry or initiate outbound peer connections.
- **Authentication:** Inherits server control token (`--control-token` or `SHADOWCLAW_CONTROL_TOKEN`); when configured, incoming requests must supply `x-control-token: <token>` or `Authorization: Bearer <token>`. Discovery (`GET /.well-known/agent-card.json`) remains public per A2A specifications.
