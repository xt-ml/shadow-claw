import type { OpenApiPathItem } from "../types.js";

export const pushPaths: Record<string, OpenApiPathItem> = {
  "/push/vapid-public-key": {
    get: {
      tags: ["Push Notifications"],
      summary: "Get VAPID Public Key",
      description:
        "Returns the server's VAPID public key needed by browser clients to register for Web Push.",
      responses: {
        "200": {
          description: "VAPID public key",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  publicKey: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/push/subscribe": {
    post: {
      tags: ["Push Notifications"],
      summary: "Register Push Subscription",
      description: "Registers a browser Web Push subscription with the server.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["endpoint", "keys"],
              properties: {
                endpoint: { type: "string" },
                keys: {
                  type: "object",
                  properties: {
                    p256dh: { type: "string" },
                    auth: { type: "string" },
                  },
                },
                clientId: { type: "string" },
                deviceLabel: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Subscription saved" },
        "400": { description: "Invalid subscription object" },
      },
    },
    delete: {
      tags: ["Push Notifications"],
      summary: "Remove Push Subscription",
      description: "Unregisters a push subscription by its endpoint URL.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["endpoint"],
              properties: {
                endpoint: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Subscription removed" },
        "400": { description: "Missing endpoint" },
      },
    },
  },
  "/push/subscriptions": {
    get: {
      tags: ["Push Notifications"],
      summary: "List Push Subscriptions",
      description: "Retrieves all currently stored Web Push subscriptions.",
      responses: {
        "200": {
          description: "List of stored subscriptions",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { type: "object" },
              },
            },
          },
        },
      },
    },
  },
  "/push/send": {
    post: {
      tags: ["Push Notifications"],
      summary: "Send Push Notification",
      description:
        "Sends a Web Push notification to a specific registered endpoint.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["endpoint"],
              properties: {
                endpoint: { type: "string" },
                payload: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Notification sent" },
        "400": { description: "Missing endpoint" },
        "404": { description: "Subscription not found" },
        "410": { description: "Subscription expired" },
        "500": { description: "Web push dispatch error" },
      },
    },
  },
  "/push/subscription/{id}": {
    delete: {
      tags: ["Push Notifications"],
      summary: "Delete Subscription by Row ID",
      description:
        "Deletes a stored push subscription by its internal database row ID.",
      parameters: [
        {
          name: "id",
          in: "path",
          description: "Database row ID of the subscription",
          required: true,
          schema: { type: "integer" },
        },
      ],
      responses: {
        "200": { description: "Subscription deleted" },
        "400": { description: "Invalid subscription ID" },
      },
    },
  },
  "/push/broadcast": {
    post: {
      tags: ["Push Notifications"],
      summary: "Broadcast Notification",
      description: "Sends a Web Push notification to all active subscribers.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["body"],
              properties: {
                title: { type: "string", default: "ShadowClaw" },
                body: { type: "string" },
                clientId: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Broadcast completed",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  sent: { type: "number" },
                  failed: { type: "number" },
                },
              },
            },
          },
        },
        "400": { description: "Missing body" },
        "500": { description: "Broadcast error" },
      },
    },
  },
  "/push/command": {
    post: {
      tags: ["Push Notifications"],
      summary: "Broadcast Push Command",
      description:
        "Dispatches a remote command payload via Web Push to wake dormant clients.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["action"],
              properties: {
                action: { type: "string" },
                clientId: { type: "string" },
                args: { type: "object" },
                prompt: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Push command broadcasted",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  sent: { type: "number" },
                  failed: { type: "number" },
                },
              },
            },
          },
        },
        "400": { description: "Missing action" },
        "500": { description: "Command broadcast failed" },
      },
    },
  },
};
