# OpenAPI 3.1 & REST Endpoint Discoverability

> Complete specification and interactive documentation for ShadowClaw REST and streaming endpoints.

## Overview

ShadowClaw exposes RESTful and streaming endpoints spanning device control plane orchestration, backups, scheduled tasks, Web Push, OAuth authentication, AI model proxies, email integrations, diagnostics, and MCP tool discovery.

To guarantee that all RESTful endpoints are both **discoverable** and **prevented from documentation drift**, ShadowClaw implements:

1. **Official OpenAPI 3.1 Specification (`GET /api/openapi.json`)**:
   A machine-readable OpenAPI 3.1.0 document consumable by LLMs, agents, Swagger tooling, Postman, and MCP relays.
2. **Interactive Scalar API Documentation (`GET /api/docs` and `GET /docs`)**:
   A modern, dark-mode native API reference UI powered by [Scalar](https://scalar.com/) (MIT License).
3. **Automated Route-Coverage Contract Test (`src/server/openapi/openapi-coverage.test.ts`)**:
   An automated Jest test that inspects the live Express routing table (`createApp`) and asserts that 100% of registered REST endpoints and HTTP methods have corresponding operations in the OpenAPI specification.

---

## Endpoints

| Endpoint            | Method | Description                                       |
| :------------------ | :----- | :------------------------------------------------ |
| `/api/openapi.json` | `GET`  | Machine-readable OpenAPI 3.1.0 specification JSON |
| `/api/docs`         | `GET`  | Interactive Scalar API documentation UI           |
| `/docs`             | `GET`  | Convenience redirect to `/api/docs`               |

---

## Architecture & Code Structure

The OpenAPI subsystem is organized modularly under `src/server/openapi/`:

```
src/server/openapi/
├── types.ts                    # Strongly typed OpenAPI 3.1 schema definitions
├── openapi-spec.ts             # Central specification aggregator & metadata
├── openapi-coverage.test.ts    # Automated route coverage drift guardrail
└── paths/                      # Domain-specific path definitions
    ├── control.ts              # /api/control/*
    ├── backup.ts               # /api/backup/*
    ├── schedule.ts             # /schedule/tasks/*
    ├── push.ts                 # /push/*
    ├── oauth.ts                # /oauth/*
    ├── integrations.ts         # /integrations/email/*
    ├── proxies.ts              # /*-proxy/* and /proxy, /git-proxy, /telegram
    ├── diagnostics.ts          # /activity-log and /__cspreport
    └── mcp.ts                  # /mcp
```

### Route Mounting

Docs routes are registered in `src/server/app.ts` via `registerDocsRoutes(app)`:

```typescript
import { registerDocsRoutes } from "./routes/docs.js";

// Inside createApp():
registerPushRoutes(app);
registerTaskScheduleRoutes(app);
registerDocsRoutes(app);
```

---

## Discoverability & Drift Guardrail

In accordance with ShadowClaw's Test-Driven Development ethos, route discoverability is enforced automatically:

```bash
NODE_OPTIONS="--no-warnings --experimental-vm-modules" jest src/server/openapi/openapi-coverage.test.ts
```

If a developer adds or removes an Express endpoint without updating the corresponding OpenAPI path definitions under `src/server/openapi/paths/`, `npm test` fails immediately in CI with an explicit list of missing or orphaned routes.
