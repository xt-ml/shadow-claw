import type { OpenApiPathItem } from "../types.js";

export const schedulePaths: Record<string, OpenApiPathItem> = {
  "/schedule/tasks": {
    get: {
      tags: ["Scheduled Tasks"],
      summary: "List Scheduled Tasks",
      description:
        "Retrieves all registered scheduled tasks, optionally filtered by groupId and subscriberId.",
      parameters: [
        {
          name: "groupId",
          in: "query",
          description: "Optional workspace group filter",
          required: false,
          schema: { type: "string" },
        },
        {
          name: "subscriberId",
          in: "query",
          description: "Optional push subscriber ID filter",
          required: false,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "List of scheduled tasks",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    group_id: { type: "string" },
                    schedule: {
                      type: "string",
                      description: "Cron expression",
                    },
                    type: { type: "string", enum: ["prompt", "tools"] },
                    prompt: { type: "string" },
                    enabled: { type: "boolean" },
                    created_at: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Scheduled Tasks"],
      summary: "Upsert Scheduled Task",
      description:
        "Creates or updates a scheduled task to be triggered by the server-side cron scheduler.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["id", "groupId", "schedule"],
              properties: {
                id: { type: "string", description: "Task unique identifier" },
                groupId: { type: "string", description: "Workspace group ID" },
                schedule: { type: "string", description: "Cron expression" },
                type: {
                  type: "string",
                  enum: ["prompt", "tools"],
                  default: "prompt",
                },
                prompt: { type: "string" },
                tools: { type: "array", items: { type: "object" } },
                enabled: { type: "boolean", default: true },
                channel: { type: "string" },
                subscriberId: { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Scheduled task saved" },
        "400": { description: "Missing required fields" },
      },
    },
  },
  "/schedule/tasks/{id}": {
    get: {
      tags: ["Scheduled Tasks"],
      summary: "Get Scheduled Task",
      description:
        "Retrieves details of a single scheduled task by its unique ID.",
      parameters: [
        {
          name: "id",
          in: "path",
          description: "Scheduled task ID",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "Scheduled task details",
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
        "404": { description: "Task not found" },
      },
    },
    delete: {
      tags: ["Scheduled Tasks"],
      summary: "Delete Scheduled Task",
      description:
        "Removes a scheduled task from the server-side schedule store.",
      parameters: [
        {
          name: "id",
          in: "path",
          description: "Scheduled task ID",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "subscriberId",
          in: "query",
          description: "Optional subscriber ID for ownership verification",
          required: false,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": { description: "Scheduled task deleted" },
        "404": { description: "Task not found" },
      },
    },
  },
  "/schedule/tasks/{id}/enable": {
    patch: {
      tags: ["Scheduled Tasks"],
      summary: "Enable Scheduled Task",
      description: "Enables execution for the designated scheduled task.",
      parameters: [
        {
          name: "id",
          in: "path",
          description: "Scheduled task ID",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": { description: "Task enabled" },
        "404": { description: "Task not found" },
      },
    },
  },
  "/schedule/tasks/{id}/disable": {
    patch: {
      tags: ["Scheduled Tasks"],
      summary: "Disable Scheduled Task",
      description:
        "Disables execution for the designated scheduled task without deleting it.",
      parameters: [
        {
          name: "id",
          in: "path",
          description: "Scheduled task ID",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": { description: "Task disabled" },
        "404": { description: "Task not found" },
      },
    },
  },
};
