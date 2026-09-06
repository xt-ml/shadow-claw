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

  const clientIdProp: any = {
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

export function getDynamicSendNotificationTool(
  controlPlane?: any,
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
              (c: any) => (c.clientId || c.id) === pc.clientId,
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

export const SHADOWCLAW_BUILTIN_TOOLS: McpTool[] = [
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
    name: "shadowclaw_server_status",
    description:
      "Query ShadowClaw Node server status, version, and active client count.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  buildSendNotificationTool(),
];

export function resolveTargetClientId(
  controlPlane: any,
  requestedId?: unknown,
): string {
  try {
    const clients =
      typeof controlPlane.getConnectedClients === "function"
        ? controlPlane.getConnectedClients()
        : typeof controlPlane.listClients === "function"
          ? controlPlane.listClients()
          : [];

    if (Array.isArray(clients) && clients.length > 0) {
      if (typeof requestedId === "string" && requestedId.trim()) {
        const trimmed = requestedId.trim();
        const exact = clients.find(
          (c: any) => (c.clientId || c.id) === trimmed,
        );
        if (exact) return exact.clientId || exact.id;

        const idx = parseInt(trimmed, 10);
        if (!isNaN(idx) && idx >= 0 && idx < clients.length) {
          return clients[idx].clientId || clients[idx].id;
        }

        const prefix = clients.find(
          (c: any) =>
            (c.clientId || c.id || "").startsWith(trimmed) ||
            (c.clientId || "").replace(/^client-/, "").startsWith(trimmed),
        );
        if (prefix) return prefix.clientId || prefix.id;

        const byLabel = clients.find((c: any) =>
          c.deviceLabel?.toLowerCase().includes(trimmed.toLowerCase()),
        );
        if (byLabel) return byLabel.clientId || byLabel.id;

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

export function registerBuiltInTools(
  server: McpServer,
  controlPlane: any,
): void {
  server.setToolProvider(async () => {
    return [getDynamicSendNotificationTool(controlPlane)];
  });

  for (const tool of SHADOWCLAW_BUILTIN_TOOLS) {
    const handler = async (args: Record<string, any>) => {
      switch (tool.name) {
        case "shadowclaw_server_list_clients":
        case "shadowclaw_list_clients": {
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

        case "shadowclaw_server_send_message":
        case "shadowclaw_send_message": {
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

          const targetId = resolveTargetClientId(controlPlane, args.clientId);
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

          const res = await controlPlane.sendCommand(targetId, "send-message", {
            text,
            groupId: args.groupId,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(res.data || res, null, 2),
              },
            ],
            isError: !res.success,
          };
        }

        case "shadowclaw_server_read_state":
        case "shadowclaw_read_state": {
          const targetId = resolveTargetClientId(controlPlane, args.clientId);
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

          const res = await controlPlane.sendCommand(
            targetId,
            "read-state",
            {},
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(res.data || res, null, 2),
              },
            ],
            isError: !res.success,
          };
        }

        case "shadowclaw_server_list_tasks":
        case "shadowclaw_list_tasks": {
          const targetId = resolveTargetClientId(controlPlane, args.clientId);
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

          const res = await controlPlane.sendCommand(targetId, "list-tasks", {
            groupId: args.groupId,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(res.data || res, null, 2),
              },
            ],
            isError: !res.success,
          };
        }

        case "shadowclaw_server_manage_backup":
        case "shadowclaw_manage_backup": {
          const action = String(args.action || "trigger").toLowerCase();
          const targetId = resolveTargetClientId(controlPlane, args.clientId);

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

            const res = await controlPlane.sendCommand(
              targetId,
              "trigger-backup",
              {
                groupId: args.groupId,
              },
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(res.data || res, null, 2),
                },
              ],
              isError: !res.success,
            };
          }

          if (action === "list") {
            if (typeof controlPlane.listBackups === "function") {
              const backups = await controlPlane.listBackups(targetId);
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ backups }, null, 2),
                  },
                ],
              };
            }
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
              const res = await controlPlane.deleteBackup(
                args.backupId,
                targetId,
              );
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(res, null, 2),
                  },
                ],
              };
            }
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

        case "shadowclaw_server_set_active_client":
        case "shadowclaw_set_active_client": {
          const targetId = resolveTargetClientId(controlPlane, args.clientId);
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

        case "shadowclaw_server_status":
        case "shadowclaw_status": {
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
                    connectedClients: clients.length,
                    status: "healthy",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "shadowclaw_server_send_notification":
        case "shadowclaw_send_notification":
        case "send_notification": {
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
          } catch (err: any) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Failed to send push notification: ${err.message}`,
                },
              ],
            };
          }
        }

        default:
          return {
            isError: true,
            content: [{ type: "text", text: `Unknown tool: '${tool.name}'` }],
          };
      }
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
