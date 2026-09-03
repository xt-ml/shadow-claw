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
};
