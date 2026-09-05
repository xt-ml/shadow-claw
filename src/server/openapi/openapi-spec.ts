import type { OpenApiSpec } from "./types.js";
import { controlPaths } from "./paths/control.js";
import { backupPaths } from "./paths/backup.js";
import { schedulePaths } from "./paths/schedule.js";
import { pushPaths } from "./paths/push.js";
import { oauthPaths } from "./paths/oauth.js";
import { integrationPaths } from "./paths/integrations.js";
import { proxyPaths } from "./paths/proxies.js";
import { diagnosticPaths } from "./paths/diagnostics.js";
import { mcpPaths } from "./paths/mcp.js";
import { getPackageVersion } from "../utils/packageVersion.js";

export const openApiSpec: OpenApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "ShadowClaw API",
    version: getPackageVersion(),
    description:
      "Official REST and streaming API specification for ShadowClaw personal AI assistant and control plane server.",
    license: {
      name: "AGPL-3.0",
      url: "https://www.gnu.org/licenses/agpl-3.0.html",
    },
    contact: {
      name: "ShadowClaw Community",
      url: "https://github.com/xt-ml/shadow-claw",
    },
  },
  servers: [
    {
      url: "/",
      description: "Current ShadowClaw server instance",
    },
  ],
  tags: [
    {
      name: "Control Plane",
      description: "WebSocket, SSE, and REST device orchestration",
    },
    {
      name: "Backups",
      description: "Workspace snapshot storage and management",
    },
    {
      name: "Scheduled Tasks",
      description: "Server-side cron tasks and triggers",
    },
    {
      name: "Push Notifications",
      description: "Web Push registration and messaging",
    },
    {
      name: "Model Context Protocol",
      description: "Stateless MCP tool discovery and execution",
    },
    {
      name: "Model Proxies",
      description: "Inference gateways for Bedrock, Gemini, Ollama, etc.",
    },
    { name: "Email Integration", description: "IMAP and SMTP email actions" },
    {
      name: "OAuth",
      description: "Provider authentication and session token exchange",
    },
    {
      name: "Diagnostics & Logging",
      description: "Client activity logging and CSP reports",
    },
    {
      name: "HTTP Proxies",
      description: "CORS bypass and Git smart HTTP proxying",
    },
    {
      name: "API Documentation",
      description: "OpenAPI specification and interactive docs",
    },
  ],
  paths: {
    "/api/openapi.json": {
      get: {
        tags: ["API Documentation"],
        summary: "OpenAPI Specification",
        description:
          "Returns the complete OpenAPI 3.1.0 specification document for all server endpoints.",
        responses: {
          "200": {
            description: "OpenAPI 3.1 document",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/api/docs": {
      get: {
        tags: ["API Documentation"],
        summary: "Scalar Interactive API Documentation",
        description:
          "Renders the interactive Scalar API documentation explorer.",
        responses: {
          "200": {
            description: "Scalar documentation HTML interface",
            content: { "text/html": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/docs": {
      get: {
        tags: ["API Documentation"],
        summary: "API Documentation Redirect",
        description: "Convenience redirect to /api/docs.",
        responses: {
          "302": { description: "Redirect to /api/docs" },
        },
      },
    },
    ...controlPaths,
    ...backupPaths,
    ...schedulePaths,
    ...pushPaths,
    ...mcpPaths,
    ...oauthPaths,
    ...integrationPaths,
    ...proxyPaths,
    ...diagnosticPaths,
  },
  components: {
    securitySchemes: {
      ControlTokenAuth: {
        type: "apiKey",
        name: "x-control-token",
        in: "header",
        description:
          "ShadowClaw server control token passed via x-control-token header",
      },
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "ShadowClaw server control token or OAuth token passed as Authorization: Bearer <token>",
      },
    },
  },
};
