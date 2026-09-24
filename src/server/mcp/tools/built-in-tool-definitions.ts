import type { McpTool } from "../types.js";

export const BUILTIN_TOOL_DEFINITIONS: McpTool[] = [
  {
    name: "shadowclaw_server_list_clients",
    description:
      "List connected browser and Electron clients, including device type, ID, and active capabilities.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "shadowclaw_server_send_message",
    description:
      "Send a message or prompt to a connected ShadowClaw client's active AI orchestrator queue.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The prompt or message text to dispatch.",
        },
        clientId: {
          type: "string",
          description:
            "Target client ID. If omitted, targets the first available connected client.",
        },
        groupId: {
          type: "string",
          description:
            "Target conversation group ID (e.g. 'br:main'). If omitted, targets the active group.",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "shadowclaw_server_read_state",
    description:
      "Read the current orchestrator state (idle, responding, etc.), active group ID, and capabilities from a connected client.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description:
            "Target client ID (defaults to first available connected client).",
        },
      },
    },
  },
  {
    name: "shadowclaw_server_list_tasks",
    description:
      "List scheduled background tasks configured on a connected client (optionally filtered by conversation group).",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description:
            "Target client ID (defaults to first available connected client).",
        },
        groupId: {
          type: "string",
          description: "Optional conversation group ID filter.",
        },
      },
    },
  },
  {
    name: "shadowclaw_server_set_active_client",
    description:
      "Set the active default connected client used when no clientId is explicitly provided in tool calls.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description:
            "Target client ID (or index '0', '1', prefix, or device label) to make active.",
        },
      },
      required: ["clientId"],
    },
  },
  {
    name: "shadowclaw_server_manage_backup",
    description:
      "Trigger or manage OPFS workspace file backups for a connected client (trigger, list, or delete).",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["trigger", "list", "delete"],
          description: "Backup action to perform (default: 'trigger').",
          default: "trigger",
        },
        clientId: {
          type: "string",
          description: "Target client ID.",
        },
        backupId: {
          type: "string",
          description: "Backup snapshot ID (required for 'delete').",
        },
        groupId: {
          type: "string",
          description: "Optional workspace conversation group ID.",
        },
      },
    },
  },
  {
    name: "shadowclaw_server_status",
    description:
      "Query ShadowClaw Node server status, version, and active client count.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "shadowclaw_server_send_notification",
    description:
      "Broadcast an OS-level push notification to subscribed devices via Web Push (VAPID), or send to a specific registered client. Works even when the client browser tab is closed, asleep, or running in the background.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Notification title (default: 'ShadowClaw').",
        },
        body: {
          type: "string",
          description: "The notification body message text.",
        },
        clientId: {
          type: "string",
          description:
            "Target client ID, prefix, or device label of a specific client that has registered in the past. If omitted, broadcasts to all subscribed devices.",
        },
      },
      required: ["body"],
    },
  },
];

export interface McpClientLike {
  id?: string;
  clientId?: string;
  deviceLabel?: string;
  [key: string]: unknown;
}

export interface McpControlPlaneLike {
  getConnectedClients?: () => McpClientLike[];
  listClients?: () => Promise<McpClientLike[]> | McpClientLike[];
  getActiveClientId?: () => string | undefined;
  [key: string]: unknown;
}

export function resolveTargetClientId(
  controlPlane: McpControlPlaneLike,
  requestedId?: unknown,
): string {
  try {
    const clients =
      typeof controlPlane.getConnectedClients === "function"
        ? controlPlane.getConnectedClients()
        : typeof controlPlane.listClients === "function"
          ? (controlPlane.listClients() as McpClientLike[])
          : [];

    if (Array.isArray(clients) && clients.length > 0) {
      if (typeof requestedId === "string" && requestedId.trim()) {
        const trimmed = requestedId.trim();
        const exact = clients.find((c) => (c.clientId || c.id) === trimmed);
        if (exact) return exact.clientId || exact.id || "";

        const idx = parseInt(trimmed, 10);
        if (!isNaN(idx) && idx >= 0 && idx < clients.length) {
          return clients[idx].clientId || clients[idx].id || "";
        }

        const prefix = clients.find(
          (c) =>
            (c.clientId || c.id || "").startsWith(trimmed) ||
            (c.clientId || c.id || "")
              .replace(/^client-/, "")
              .startsWith(trimmed),
        );
        if (prefix) return prefix.clientId || prefix.id || "";

        const byLabel = clients.find((c) =>
          c.deviceLabel?.toLowerCase().includes(trimmed.toLowerCase()),
        );
        if (byLabel) return byLabel.clientId || byLabel.id || "";

        return trimmed;
      }

      if (typeof controlPlane.getActiveClientId === "function") {
        const active = controlPlane.getActiveClientId();
        if (active) return active;
      }

      return clients[0].clientId || clients[0].id || "";
    }
  } catch (_) {}

  return typeof requestedId === "string" ? requestedId.trim() : "";
}
