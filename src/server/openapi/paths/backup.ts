import type { OpenApiPathItem } from "../types.js";

export const backupPaths: Record<string, OpenApiPathItem> = {
  "/api/backup/upload": {
    post: {
      tags: ["Backups"],
      summary: "Upload Backup File",
      description:
        "Uploads a single file chunk or file content as part of a backup snapshot.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["clientId", "backupId", "path"],
              properties: {
                clientId: {
                  type: "string",
                  description: "Identifier of the client",
                },
                backupId: {
                  type: "string",
                  description: "Target backup snapshot identifier",
                },
                path: {
                  type: "string",
                  description: "Relative file path within workspace",
                },
                content: { type: "string", description: "File content" },
                encoding: {
                  type: "string",
                  enum: ["utf-8", "base64"],
                  default: "utf-8",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "File uploaded successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  path: { type: "string" },
                  bytesWritten: { type: "number" },
                },
              },
            },
          },
        },
        "400": { description: "Invalid path or missing required fields" },
        "401": { description: "Unauthorized" },
        "500": { description: "Filesystem write error" },
      },
    },
  },
  "/api/backup/complete": {
    post: {
      tags: ["Backups"],
      summary: "Finalize Backup Snapshot",
      description:
        "Finalizes an uploaded backup snapshot and records its metadata manifest in SQLite.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["clientId", "backupId"],
              properties: {
                clientId: { type: "string" },
                backupId: { type: "string" },
                fileCount: { type: "number" },
                totalBytes: { type: "number" },
                manifest: { type: "object" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Backup finalized and recorded",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  backupId: { type: "string" },
                  clientId: { type: "string" },
                  timestamp: { type: "integer" },
                  fileCount: { type: "number" },
                  totalBytes: { type: "number" },
                },
              },
            },
          },
        },
        "400": { description: "Missing clientId or backupId" },
        "401": { description: "Unauthorized" },
        "500": { description: "Failed to complete backup" },
      },
    },
  },
  "/api/backup/list": {
    get: {
      tags: ["Backups"],
      summary: "List Backup Snapshots",
      description:
        "Retrieves metadata for recorded backup snapshots, optionally filtered by clientId.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      parameters: [
        {
          name: "clientId",
          in: "query",
          description: "Optional filter by client identifier",
          required: false,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "List of backups",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  backups: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        clientId: { type: "string" },
                        fileCount: { type: "number" },
                        totalBytes: { type: "number" },
                        timestamp: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "401": { description: "Unauthorized" },
      },
    },
  },
  "/api/backup/{id}": {
    delete: {
      tags: ["Backups"],
      summary: "Delete Backup Snapshot",
      description:
        "Removes a backup snapshot record and cleans up associated filesystem storage.",
      security: [{ ControlTokenAuth: [] }, { BearerAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          description: "Backup snapshot ID",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "clientId",
          in: "query",
          description: "Optional client ID owning the backup snapshot",
          required: false,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "Backup snapshot deleted",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  deleted: { type: "string" },
                },
              },
            },
          },
        },
        "400": { description: "Missing backup ID" },
        "401": { description: "Unauthorized" },
        "500": { description: "Deletion error" },
      },
    },
  },
};
