import type { OpenApiPathItem } from "../types.js";

export const mcpPaths: Record<string, OpenApiPathItem> = {
  "/mcp": {
    post: {
      tags: ["Model Context Protocol"],
      summary: "Stateless MCP Endpoint",
      description:
        "Official Stateless Model Context Protocol (MCP 2026-07-28) endpoint supporting tools/list and tools/call JSON-RPC methods.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["jsonrpc", "method"],
              properties: {
                jsonrpc: { type: "string", example: "2.0" },
                id: { type: "string", example: "1" },
                method: { type: "string", example: "tools/list" },
                params: { type: "object" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "JSON-RPC response or SSE response stream",
          content: {
            "application/json": { schema: { type: "object" } },
            "text/event-stream": { schema: { type: "string" } },
          },
        },
        "400": { description: "Invalid JSON-RPC request" },
        "401": { description: "Unauthorized" },
      },
    },
  },
  "/.well-known/mcp": {
    post: {
      tags: ["Model Context Protocol"],
      summary: "Stateless MCP Endpoint (Well-Known)",
      description:
        "Alternative well-known path for Stateless MCP (2026-07-28) Streamable HTTP requests.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      responses: {
        "200": { description: "JSON-RPC response" },
        "401": { description: "Unauthorized" },
      },
    },
    get: {
      tags: ["Model Context Protocol"],
      summary: "MCP Server Card Discovery",
      description: "Returns SEP-2127 MCP Server Card discovery metadata.",
      responses: {
        "200": {
          description: "MCP Server Card",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/.well-known/mcp.json": {
    get: {
      tags: ["Model Context Protocol"],
      summary: "MCP Server Card (SEP-2127)",
      description: "Returns SEP-2127 MCP Server Card discovery metadata.",
      responses: {
        "200": {
          description: "MCP Server Card",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/mcp/server-card": {
    get: {
      tags: ["Model Context Protocol"],
      summary: "MCP Server Card (Canonical Endpoint)",
      description: "Returns SEP-2127 MCP Server Card for this server.",
      responses: {
        "200": {
          description: "MCP Server Card",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/.well-known/ai-catalog.json": {
    get: {
      tags: ["Model Context Protocol"],
      summary: "AI Catalog Discovery (SEP-2127)",
      description: "Returns AI Catalog referencing this MCP Server Card.",
      responses: {
        "200": {
          description: "AI Catalog manifest",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/.well-known/mcp/servers.json": {
    get: {
      tags: ["Model Context Protocol"],
      summary: "MCP Servers Manifest (Discussion #1147)",
      description: "Returns servers manifest per Discussion #1147.",
      responses: {
        "200": {
          description: "MCP servers manifest",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/.well-known/oauth-protected-resource": {
    get: {
      tags: ["Model Context Protocol"],
      summary: "Protected Resource Metadata (RFC 9728)",
      description:
        "OAuth 2.0 Protected Resource Metadata pointing clients to authorization servers.",
      responses: {
        "200": {
          description: "Protected Resource Metadata",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/.well-known/oauth-protected-resource.json": {
    get: {
      tags: ["Model Context Protocol"],
      summary: "Protected Resource Metadata JSON (RFC 9728)",
      description:
        "OAuth 2.0 Protected Resource Metadata pointing clients to authorization servers.",
      responses: {
        "200": {
          description: "Protected Resource Metadata",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
};
