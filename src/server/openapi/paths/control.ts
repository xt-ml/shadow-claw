import type { OpenApiPathItem } from "../types.js";

export const controlPaths: Record<string, OpenApiPathItem> = {
  "/api/control/health": {
    get: {
      tags: ["Control Plane"],
      summary: "Server Health Check",
      description:
        "Returns the health and connectivity status of the control plane server.",
      responses: {
        "200": {
          description: "Server is healthy",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "ok" },
                  time: { type: "integer", example: 1772668800000 },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/control/clients": {
    get: {
      tags: ["Control Plane"],
      summary: "List Registered Clients",
      description:
        "Returns a list of all active or recently seen clients registered with the server.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      responses: {
        "200": {
          description: "List of registered clients",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  clients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        clientId: { type: "string" },
                        deviceLabel: { type: "string" },
                        capabilities: {
                          type: "array",
                          items: { type: "string" },
                        },
                        lastHeartbeat: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "401": {
          description: "Unauthorized - missing or invalid control token",
        },
      },
    },
  },
  "/api/control/command": {
    post: {
      tags: ["Control Plane"],
      summary: "Send Command to Client",
      description:
        "Dispatches a command action to a specific connected client and awaits its result.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["clientId", "action"],
              properties: {
                clientId: { type: "string", description: "Target client ID" },
                action: {
                  type: "string",
                  description: "Command action to execute",
                },
                args: {
                  type: "object",
                  description: "Arguments for the command action",
                },
                timeoutMs: {
                  type: "number",
                  description: "Timeout in milliseconds",
                  default: 30000,
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Command executed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["ok", "error"] },
                  data: { type: "object" },
                },
              },
            },
          },
        },
        "400": { description: "Bad request - missing clientId or action" },
        "401": { description: "Unauthorized" },
        "404": { description: "Client not connected" },
        "500": { description: "Execution error or command timed out" },
      },
    },
  },
  "/api/control/messages": {
    post: {
      tags: ["Control Plane"],
      summary: "Post Control Message",
      description: "Sends an inbound control protocol message to the server.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["type"],
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                payload: { type: "object" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Message processed",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "received" },
                  reply: { type: "object" },
                },
              },
            },
          },
        },
        "400": { description: "Invalid control message payload" },
        "401": { description: "Unauthorized" },
      },
    },
  },
  "/api/control/events": {
    get: {
      tags: ["Control Plane"],
      summary: "Server-Sent Events Stream",
      description:
        "Subscribes to real-time control plane events via text/event-stream.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      parameters: [
        {
          name: "clientId",
          in: "query",
          description: "Client ID identifying the stream receiver",
          required: false,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "Active SSE event stream",
          content: {
            "text/event-stream": {
              schema: { type: "string" },
            },
          },
        },
        "401": { description: "Unauthorized" },
      },
    },
  },
};
