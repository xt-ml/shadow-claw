/**
 * ShadowClaw — Built-in MCP Tools
 *
 * Exposes core CLI and server capabilities (client listing, prompt dispatch,
 * state inspection, task listing, backup management) as native MCP tools.
 */

import type { McpServer } from "../mcp-server.js";
import type { McpTool } from "../types.js";
import {
  broadcastPush,
  getRegisteredPushClients,
  type PushClientRecord,
} from "../../../subsystems/notifications/push-routes.js";
import { getPackageVersion } from "../../utils/packageVersion.js";

export function buildSendNotificationTool(
  pushClients: Array<
    PushClientRecord | { clientId: string; deviceLabel?: string }
  > = [],
  name: string = "shadowclaw_server_send_notification",
): McpTool {
  const sortedPushClients = [...pushClients].sort((a, b) =>
    a.clientId.localeCompare(b.clientId),
  );
  const pushClientIds = sortedPushClients
    .map((c) => c.clientId)
    .filter(Boolean);

  const baseDescription =
    "Broadcast an OS-level push notification to subscribed devices via Web Push (VAPID), or send to a specific registered client. Works even when the client browser tab is closed, asleep, or running in the background.";

  const clientIdProp: { type: "string"; description: string; enum?: string[] } =
    {
      type: "string",
      description:
        pushClientIds.length > 0
          ? `Target client ID, prefix, or device label of a specific client registered for push notifications (optional; if omitted, broadcasts to all subscribed devices). Available on: ${sortedPushClients.map((c) => `${c.clientId} (${c.deviceLabel || "Client"})`).join(", ")}`
          : "Target client ID, prefix, or device label of a specific client that has registered in the past. If omitted, broadcasts to all subscribed devices.",
    };

  if (pushClientIds.length > 0) {
    clientIdProp.enum = pushClientIds;
  }

  return {
    name,
    description: baseDescription,
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Notification title (default: 'ShadowClaw').",
        },
        body: {
          type: "string",
          description: "Notification body message text.",
        },
        clientId: clientIdProp,
      },
      required: ["body"],
    },
  };
}

export interface McpControlPlane {
  sendCommand?: (
    targetId: string,
    action: string,
    payload: Record<string, unknown>,
  ) => Promise<{ success?: boolean; data?: unknown; [key: string]: unknown }>;
  getConnectedClients?: () => Array<{
    id?: string;
    clientId?: string;
    deviceLabel?: string;
    [key: string]: unknown;
  }>;
  listClients?: () => Promise<
    Array<{
      id?: string;
      clientId?: string;
      deviceLabel?: string;
      [key: string]: unknown;
    }>
  >;
  listBackups?: () => Promise<unknown[]>;
  deleteBackup?: (backupId: unknown, targetId?: string) => Promise<unknown>;
  getBackupStatus?: () => Promise<unknown>;
  setActiveClientId?: (targetId: string) => void;
  activeClientId?: string;
  [key: string]: unknown;
}

export interface BuiltInToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

export function getDynamicSendNotificationTool(
  controlPlane?: McpControlPlane,
  name: string = "shadowclaw_server_send_notification",
): McpTool {
  let pushClients: PushClientRecord[] = [];
  try {
    pushClients = getRegisteredPushClients();
  } catch (_) {}

  if (controlPlane && Array.isArray(pushClients) && pushClients.length > 0) {
    try {
      const connected =
        typeof controlPlane.getConnectedClients === "function"
          ? controlPlane.getConnectedClients()
          : typeof controlPlane.listClients === "function"
            ? controlPlane.listClients()
            : [];
      if (Array.isArray(connected)) {
        for (const pc of pushClients) {
          if (!pc.deviceLabel) {
            const match = connected.find(
              (c) => (c.clientId || c.id) === pc.clientId,
            );
            if (match && match.deviceLabel) {
              pc.deviceLabel = match.deviceLabel;
            }
          }
        }
      }
    } catch (_) {}
  }

  return buildSendNotificationTool(pushClients, name);
}
import {
  BUILTIN_TOOL_DEFINITIONS,
  resolveTargetClientId,
} from "./built-in-tool-definitions.js";

export const SHADOWCLAW_BUILTIN_TOOLS: McpTool[] = BUILTIN_TOOL_DEFINITIONS;
export { resolveTargetClientId };

type BuiltInToolHandler = (
  controlPlane: McpControlPlane,
  args: Record<string, unknown>,
) => Promise<BuiltInToolResult>;

async function handleListClients(
  controlPlane: McpControlPlane,
): Promise<BuiltInToolResult> {
  const clients =
    typeof controlPlane.getConnectedClients === "function"
      ? controlPlane.getConnectedClients()
      : typeof controlPlane.listClients === "function"
        ? await controlPlane.listClients()
        : [];

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ clients }, null, 2),
      },
    ],
  };
}

async function handleSendMessage(
  controlPlane: McpControlPlane,
  args: Record<string, unknown>,
): Promise<BuiltInToolResult> {
  const text = String(args.text || "").trim();
  if (!text) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Error: Message 'text' parameter cannot be empty.",
        },
      ],
    };
  }

  const targetId = resolveTargetClientId(
    controlPlane,
    typeof args.clientId === "string" ? args.clientId : undefined,
  );
  if (!targetId) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Error: No active ShadowClaw browser or Electron clients connected.",
        },
      ],
    };
  }

  const res = (await controlPlane.sendCommand?.(targetId, "send-message", {
    text,
    groupId: args.groupId,
  })) as { success?: boolean; data?: unknown } | undefined;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(res?.data || res, null, 2),
      },
    ],
    isError: !res?.success,
  };
}

async function handleReadState(
  controlPlane: McpControlPlane,
  args: Record<string, unknown>,
): Promise<BuiltInToolResult> {
  const targetId = resolveTargetClientId(
    controlPlane,
    typeof args.clientId === "string" ? args.clientId : undefined,
  );
  if (!targetId) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Error: No active ShadowClaw clients connected.",
        },
      ],
    };
  }

  const res = (await controlPlane.sendCommand?.(targetId, "read-state", {})) as
    | { success?: boolean; data?: unknown }
    | undefined;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(res?.data || res, null, 2),
      },
    ],
    isError: !res?.success,
  };
}

async function handleListTasks(
  controlPlane: McpControlPlane,
  args: Record<string, unknown>,
): Promise<BuiltInToolResult> {
  const targetId = resolveTargetClientId(
    controlPlane,
    typeof args.clientId === "string" ? args.clientId : undefined,
  );
  if (!targetId) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Error: No active ShadowClaw clients connected.",
        },
      ],
    };
  }

  const res = (await controlPlane.sendCommand?.(targetId, "list-tasks", {
    groupId: args.groupId,
  })) as { success?: boolean; data?: unknown } | undefined;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(res?.data || res, null, 2),
      },
    ],
    isError: !res?.success,
  };
}

async function handleManageBackup(
  controlPlane: McpControlPlane,
  args: Record<string, unknown>,
): Promise<BuiltInToolResult> {
  const action = String(args.action || "trigger").toLowerCase();
  const targetId = resolveTargetClientId(
    controlPlane,
    typeof args.clientId === "string" ? args.clientId : undefined,
  );

  if (action === "trigger") {
    if (!targetId) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: No active ShadowClaw clients connected.",
          },
        ],
      };
    }

    const res = (await controlPlane.sendCommand?.(
      targetId,
      "trigger-backup",
      {},
    )) as { success?: boolean; data?: unknown } | undefined;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(res?.data || res, null, 2),
        },
      ],
      isError: !res?.success,
    };
  }

  if (action === "list") {
    if (typeof controlPlane.listBackups === "function") {
      const backups = await controlPlane.listBackups();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ backups }, null, 2),
          },
        ],
      };
    }

    if (!targetId) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: No active ShadowClaw clients connected.",
          },
        ],
      };
    }

    const res = (await controlPlane.sendCommand?.(
      targetId,
      "list-backups",
      {},
    )) as { success?: boolean; data?: unknown } | undefined;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(res?.data || res, null, 2),
        },
      ],
      isError: !res?.success,
    };
  }

  if (action === "delete") {
    if (!args.backupId) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: 'backupId' required for delete action.",
          },
        ],
      };
    }
    if (typeof controlPlane.deleteBackup === "function") {
      const res = await controlPlane.deleteBackup(args.backupId, targetId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    if (!targetId) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: No active ShadowClaw clients connected.",
          },
        ],
      };
    }

    const res = (await controlPlane.sendCommand?.(targetId, "delete-backup", {
      backupId: args.backupId,
    })) as { success?: boolean; data?: unknown } | undefined;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(res?.data || res, null, 2),
        },
      ],
      isError: !res?.success,
    };
  }

  if (action === "status") {
    if (typeof controlPlane.getBackupStatus === "function") {
      const status = await controlPlane.getBackupStatus();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    }

    if (!targetId) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: No active ShadowClaw clients connected.",
          },
        ],
      };
    }

    const res = (await controlPlane.sendCommand?.(
      targetId,
      "get-backup-status",
      {},
    )) as { success?: boolean; data?: unknown } | undefined;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(res?.data || res, null, 2),
        },
      ],
      isError: !res?.success,
    };
  }

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `Unsupported backup action: '${action}'`,
      },
    ],
  };
}

async function handleSetActiveClient(
  controlPlane: McpControlPlane,
  args: Record<string, unknown>,
): Promise<BuiltInToolResult> {
  const clientId =
    typeof args.clientId === "string" ? args.clientId : undefined;
  const targetId = resolveTargetClientId(controlPlane, clientId);
  if (!targetId) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: Client '${args.clientId}' not found among connected clients.`,
        },
      ],
    };
  }

  if (typeof controlPlane.setActiveClientId === "function") {
    controlPlane.setActiveClientId(targetId);
  }

  return {
    content: [
      {
        type: "text",
        text: `Active default client set to: ${targetId}`,
      },
    ],
    _meta: {
      activeClientId: targetId,
    },
  };
}

async function handleStatus(
  controlPlane: McpControlPlane,
): Promise<BuiltInToolResult> {
  const clients =
    typeof controlPlane.getConnectedClients === "function"
      ? controlPlane.getConnectedClients()
      : [];

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            server: "ShadowClaw",
            version: getPackageVersion(),
            connectedClients: clients?.length || 0,
            status: "healthy",
          },
          null,
          2,
        ),
      },
    ],
  };
}

async function handleSendNotification(
  _controlPlane: McpControlPlane,
  args: Record<string, unknown>,
): Promise<BuiltInToolResult> {
  const body = String(args.body || "").trim();
  if (!body) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Error: Notification 'body' parameter cannot be empty.",
        },
      ],
    };
  }

  const title = String(args.title || "ShadowClaw").trim();
  const targetClientId =
    typeof args.clientId === "string" && args.clientId.trim()
      ? args.clientId.trim()
      : undefined;

  try {
    const res = await broadcastPush(
      { title, body },
      targetClientId ? { clientId: targetClientId } : undefined,
    );
    const sentCount = res?.sent ?? 0;
    const failedCount = res?.failed ?? 0;
    let msg: string;

    if (res?.notFound) {
      msg = `Warning: No push subscriptions found for client '${targetClientId}'. Ensure push notifications were registered by this client in ShadowClaw Settings.`;
    } else if (res?.noSubscribers) {
      msg =
        "Warning: Push notification broadcast completed, but no devices are currently subscribed to push notifications. Enable push notifications in ShadowClaw Settings on the client first.";
    } else if (targetClientId) {
      msg = `Push notification sent to client '${targetClientId}': ${sentCount} recipient(s) delivered, ${failedCount} failed.`;
    } else {
      msg = `Push notification broadcast sent: ${sentCount} recipient(s) delivered, ${failedCount} failed.`;
    }

    return {
      content: [{ type: "text", text: msg }],
      _meta: {
        ...res,
        ...(targetClientId ? { targetClientId } : {}),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Failed to send push notification: ${message}`,
        },
      ],
    };
  }
}

const BUILT_IN_TOOL_HANDLERS = new Map<string, BuiltInToolHandler>([
  ["shadowclaw_server_list_clients", handleListClients],
  ["shadowclaw_list_clients", handleListClients],
  ["shadowclaw_server_send_message", handleSendMessage],
  ["shadowclaw_send_message", handleSendMessage],
  ["shadowclaw_server_read_state", handleReadState],
  ["shadowclaw_read_state", handleReadState],
  ["shadowclaw_server_list_tasks", handleListTasks],
  ["shadowclaw_list_tasks", handleListTasks],
  ["shadowclaw_server_manage_backup", handleManageBackup],
  ["shadowclaw_manage_backup", handleManageBackup],
  ["shadowclaw_server_set_active_client", handleSetActiveClient],
  ["shadowclaw_set_active_client", handleSetActiveClient],
  ["shadowclaw_server_status", handleStatus],
  ["shadowclaw_status", handleStatus],
  ["shadowclaw_server_send_notification", handleSendNotification],
  ["shadowclaw_send_notification", handleSendNotification],
  ["send_notification", handleSendNotification],
]);

export function registerBuiltInTools(
  server: McpServer,
  controlPlane: McpControlPlane,
): void {
  server.setToolProvider(async () => {
    return [getDynamicSendNotificationTool(controlPlane)];
  });

  for (const tool of SHADOWCLAW_BUILTIN_TOOLS) {
    const handler = async (
      args: Record<string, unknown>,
    ): Promise<BuiltInToolResult> => {
      const toolHandler = BUILT_IN_TOOL_HANDLERS.get(tool.name);
      if (!toolHandler) {
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown tool: '${tool.name}'` }],
        };
      }
      return await toolHandler(controlPlane, args);
    };

    server.registerTool(tool, handler);

    if (tool.name.startsWith("shadowclaw_server_")) {
      const legacyAlias = `shadowclaw_${tool.name.slice("shadowclaw_server_".length)}`;
      server.registerToolHandler(legacyAlias, handler);
    }
    if (
      tool.name === "shadowclaw_server_send_notification" ||
      tool.name === "shadowclaw_send_notification"
    ) {
      server.registerToolHandler("shadowclaw_send_notification", handler);
      server.registerToolHandler("send_notification", handler);
    }
  }
}
