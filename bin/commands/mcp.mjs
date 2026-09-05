/**
 * ShadowClaw CLI — `mcp` command
 *
 * Runs an official Stateless Model Context Protocol (2026-07-28) server
 * via STDIO or Streamable HTTP, exposing ShadowClaw CLI capabilities
 * and dynamically relayed tools from connected browser clients.
 */

import readline from "node:readline";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliControlClient } from "../utils/control-client.mjs";

const __mcp_dirname = path.dirname(fileURLToPath(import.meta.url));
function getCliVersion() {
  try {
    const pkgPath = path.resolve(__mcp_dirname, "../../package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.version) return pkg.version;
    }
  } catch {}
  return "1.27.1";
}

export const CLI_BUILTIN_TOOLS = [
  {
    name: "shadowclaw_list_clients",
    description:
      "List connected browser and Electron clients, including device type, ID, and active capabilities.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "shadowclaw_send_message",
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
    name: "shadowclaw_read_state",
    description:
      "Read the current orchestrator state, active group ID, and capabilities from a connected client.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "Target client ID.",
        },
      },
    },
  },
  {
    name: "shadowclaw_list_tasks",
    description:
      "List scheduled background tasks configured on a connected client.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        groupId: { type: "string" },
      },
    },
  },
  {
    name: "shadowclaw_set_active_client",
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
    name: "shadowclaw_manage_backup",
    description:
      "Trigger or manage OPFS workspace backups for a connected client (trigger, list, or delete).",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["trigger", "list", "delete"],
          default: "trigger",
        },
        clientId: { type: "string" },
        backupId: { type: "string" },
        groupId: { type: "string" },
      },
    },
  },
  {
    name: "shadowclaw_send_notification",
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

export function createCliMcpEngine(options = {}) {
  const client = options.client || new CliControlClient(options);
  const relayClientTools = options.relayClientTools !== false;
  const targetClientId = options.targetClientId || options.clientTarget;
  let activeClientId = targetClientId || "";

  const serverInfo = {
    name: "shadow-claw",
    version: options.version || getCliVersion(),
  };

  const capabilities = {
    tools: { listChanged: true },
    extensions: { "io.modelcontextprotocol/tasks": {} },
  };

  async function resolveTargetId(requestedId) {
    const candidate = requestedId || activeClientId || targetClientId;
    try {
      const clients = await client.listClients();
      if (Array.isArray(clients) && clients.length > 0) {
        if (candidate && typeof candidate === "string" && candidate.trim()) {
          const trimmed = candidate.trim();
          const exact = clients.find((c) => (c.clientId || c.id) === trimmed);
          if (exact) return exact.clientId || exact.id;

          const idx = parseInt(trimmed, 10);
          if (!isNaN(idx) && idx >= 0 && idx < clients.length) {
            return clients[idx].clientId || clients[idx].id;
          }

          const prefix = clients.find(
            (c) =>
              (c.clientId || c.id || "").startsWith(trimmed) ||
              (c.clientId || "").replace(/^client-/, "").startsWith(trimmed),
          );
          if (prefix) return prefix.clientId || prefix.id;

          const byLabel = clients.find((c) =>
            c.deviceLabel?.toLowerCase().includes(trimmed.toLowerCase()),
          );
          if (byLabel) return byLabel.clientId || byLabel.id;

          return trimmed;
        }

        return clients[0].clientId || clients[0].id || "";
      }
    } catch (_) {}
    return typeof candidate === "string" ? candidate.trim() : "";
  }

  const toolSupportingClientsMap = new Map();
  const toolDefMap = new Map();

  async function getRelayedTools() {
    if (!relayClientTools) {
      return [];
    }
    let clients = [];
    try {
      clients = await client.listClients();
    } catch (_) {}

    if (!Array.isArray(clients) || clients.length === 0) {
      toolSupportingClientsMap.clear();
      toolDefMap.clear();
      return [];
    }

    toolSupportingClientsMap.clear();
    toolDefMap.clear();

    for (const c of clients) {
      const cid = c.clientId || c.id;
      if (!cid) continue;

      try {
        const res = await client.sendCommand(cid, "list-tools", {});
        if (
          res &&
          res.success &&
          res.data?.tools &&
          Array.isArray(res.data.tools)
        ) {
          for (const t of res.data.tools) {
            if (
              t.name === "send_notification" ||
              t.name.startsWith("shadowclaw_")
            ) {
              continue;
            }
            if (!toolDefMap.has(t.name)) {
              toolDefMap.set(t.name, t);
              toolSupportingClientsMap.set(t.name, []);
            }
            toolSupportingClientsMap.get(t.name).push(c);
          }
        }
      } catch (_) {}
    }

    const activeTargetId = await resolveTargetId();
    const relayedTools = [];

    for (const [toolName, t] of toolDefMap.entries()) {
      const supportingClients = toolSupportingClientsMap.get(toolName) || [];
      const supportingClientIds = supportingClients
        .map((cl) => cl.clientId || cl.id)
        .filter(Boolean);

      const preferredClient =
        supportingClients.find(
          (cl) => (cl.clientId || cl.id) === activeTargetId,
        ) || supportingClients[0];
      const toolDefaultId =
        preferredClient?.clientId || preferredClient?.id || "";
      const toolDefaultLabel = preferredClient?.deviceLabel || "Client";

      const existingSchema =
        t.inputSchema && typeof t.inputSchema === "object"
          ? t.inputSchema
          : { type: "object", properties: {} };

      const properties = {
        ...(existingSchema.properties || {}),
        clientId: {
          type: "string",
          description: `Target ShadowClaw client ID (optional; defaults to ${toolDefaultId} [${toolDefaultLabel}]). Available on: ${supportingClients.map((cl) => `${cl.clientId || cl.id} (${cl.deviceLabel || "Client"})`).join(", ")}`,
          enum: supportingClientIds,
        },
      };

      const clientNote =
        clients.length > 1
          ? supportingClients.length > 1
            ? ` [Default: ${toolDefaultLabel} (${toolDefaultId.slice(0, 14)}...)]`
            : ` [Client: ${toolDefaultLabel} (${toolDefaultId.slice(0, 14)}...)]`
          : "";

      relayedTools.push({
        name: t.name,
        description:
          (t.description || `Relayed tool '${t.name}' from connected client.`) +
          clientNote,
        inputSchema: {
          ...existingSchema,
          type: "object",
          properties,
        },
        annotations: t.annotations,
      });
    }

    return relayedTools;
  }

  async function handleMessage(request, headers = {}) {
    const isNotification = request.id === undefined || request.id === null;
    const reqId = request.id ?? null;

    // Header validation (2026-07-28 Streamable HTTP)
    if (headers["mcp-method"] && headers["mcp-method"] !== request.method) {
      return {
        jsonrpc: "2.0",
        id: reqId,
        error: {
          code: -32020,
          message: `Mcp-Method header '${headers["mcp-method"]}' does not match '${request.method}'`,
        },
      };
    }

    switch (request.method) {
      case "server/discover": {
        return {
          jsonrpc: "2.0",
          id: reqId,
          result: {
            protocolVersion: "2026-07-28",
            supportedProtocolVersions: [
              "2026-07-28",
              "2025-11-25",
              "2024-11-05",
            ],
            capabilities,
            serverInfo,
            _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
          },
        };
      }

      case "initialize": {
        return {
          jsonrpc: "2.0",
          id: reqId,
          result: {
            protocolVersion: request.params?.protocolVersion || "2024-11-05",
            capabilities,
            serverInfo,
          },
        };
      }

      case "notifications/initialized": {
        return null;
      }

      case "tools/list": {
        const relayed = await getRelayedTools();
        const combined = new Map();
        for (const t of CLI_BUILTIN_TOOLS) {
          combined.set(t.name, t);
        }
        for (const t of relayed) {
          if (!combined.has(t.name)) {
            combined.set(t.name, t);
          }
        }

        const sortedTools = Array.from(combined.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        return {
          jsonrpc: "2.0",
          id: reqId,
          result: {
            resultType: "complete",
            ttlMs: 5000,
            cacheScope: "private",
            tools: sortedTools,
            _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
          },
        };
      }

      case "tools/call": {
        const toolName = request.params?.name;
        const args = request.params?.arguments || {};
        const inputResponses = request.params?.inputResponses;

        if (!toolName) {
          return {
            jsonrpc: "2.0",
            id: reqId,
            error: {
              code: -32602,
              message: "Missing required parameter 'name'",
            },
          };
        }

        // Built-in tools
        if (toolName === "shadowclaw_list_clients") {
          const clients = await client.listClients();
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              content: [
                { type: "text", text: JSON.stringify({ clients }, null, 2) },
              ],
              _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
            },
          };
        }

        if (toolName === "shadowclaw_set_active_client") {
          const targetId = await resolveTargetId(args.clientId);
          if (!targetId) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Error: Client '${args.clientId}' not found among connected clients.`,
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
          activeClientId = targetId;
          console.error(
            `[ShadowClaw MCP] Active default client set to: ${activeClientId}`,
          );
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              content: [
                {
                  type: "text",
                  text: `Active default client set to: ${activeClientId}`,
                },
              ],
              _meta: {
                activeClientId,
                "io.modelcontextprotocol/serverInfo": serverInfo,
              },
            },
          };
        }

        if (toolName === "shadowclaw_send_message") {
          const targetId = await resolveTargetId(args.clientId);
          if (!targetId) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: "Error: No connected client available.",
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
          const res = await client.sendCommand(targetId, "send-message", {
            text: args.text,
            groupId: args.groupId,
          });
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              isError: !res.success,
              content: [
                {
                  type: "text",
                  text: JSON.stringify(res.data || res, null, 2),
                },
              ],
              _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
            },
          };
        }

        if (toolName === "shadowclaw_read_state") {
          const targetId = await resolveTargetId(args.clientId);
          const res = await client.sendCommand(targetId, "read-state", {});
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              isError: !res.success,
              content: [
                {
                  type: "text",
                  text: JSON.stringify(res.data || res, null, 2),
                },
              ],
              _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
            },
          };
        }

        if (toolName === "shadowclaw_list_tasks") {
          const targetId = await resolveTargetId(args.clientId);
          const res = await client.sendCommand(targetId, "list-tasks", {
            groupId: args.groupId,
          });
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              isError: !res.success,
              content: [
                {
                  type: "text",
                  text: JSON.stringify(res.data || res, null, 2),
                },
              ],
              _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
            },
          };
        }

        if (toolName === "shadowclaw_manage_backup") {
          const action = args.action || "trigger";
          const targetId = await resolveTargetId(args.clientId);
          if (action === "list") {
            const backups = await client.listBackups(targetId);
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                content: [
                  { type: "text", text: JSON.stringify({ backups }, null, 2) },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
          if (action === "delete") {
            const res = await client.deleteBackup(args.backupId, targetId);
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
          const res = await client.sendCommand(targetId, "trigger-backup", {
            groupId: args.groupId,
          });
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              isError: !res.success,
              content: [
                {
                  type: "text",
                  text: JSON.stringify(res.data || res, null, 2),
                },
              ],
              _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
            },
          };
        }

        if (
          toolName === "shadowclaw_send_notification" ||
          toolName === "send_notification"
        ) {
          const body = String(args.body || "").trim();
          if (!body) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: "Error: Notification 'body' parameter cannot be empty.",
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }

          const title = String(args.title || "ShadowClaw").trim();
          const targetClientId =
            typeof args.clientId === "string" && args.clientId.trim()
              ? args.clientId.trim()
              : undefined;

          try {
            const res = await client.broadcastNotification({
              title,
              body,
              ...(targetClientId ? { clientId: targetClientId } : {}),
            });
            const sentCount = res?.sent ?? 0;
            const failedCount = res?.failed ?? 0;
            let msg;

            if (res?.notFound) {
              msg = `Warning: No push subscriptions found for client '${targetClientId}'. Ensure push notifications were registered by this client in ShadowClaw Settings.`;
            } else if (res?.noSubscribers) {
              msg =
                "Warning: Push notification broadcast completed, but no devices are currently subscribed to push notifications. Ensure push notifications are enabled in ShadowClaw Settings on the client first.";
            } else if (targetClientId) {
              msg = `Push notification sent to client '${targetClientId}': ${sentCount} recipient(s) delivered, ${failedCount} failed.`;
            } else {
              msg = `Push notification broadcast sent: ${sentCount} recipient(s) delivered, ${failedCount} failed.`;
            }

            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: false,
                content: [{ type: "text", text: msg }],
                _meta: {
                  ...res,
                  ...(targetClientId ? { targetClientId } : {}),
                  "io.modelcontextprotocol/serverInfo": serverInfo,
                },
              },
            };
          } catch (err) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Failed to send push notification: ${err.message}`,
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
        }

        // Relayed interactive ask_user tool with MRTR response fulfillment if provided
        if (
          toolName === "ask_user" &&
          inputResponses &&
          inputResponses["response"]
        ) {
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              content: [
                { type: "text", text: String(inputResponses["response"]) },
              ],
              _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
            },
          };
        }

        // Relayed client tools (invoke-tool)
        if (toolDefMap.size === 0) {
          await getRelayedTools();
        }

        const supportingClients = toolSupportingClientsMap.get(toolName) || [];
        const supportingClientIds = supportingClients
          .map((cl) => cl.clientId || cl.id)
          .filter(Boolean);

        let targetId = "";
        if (args.clientId) {
          targetId = await resolveTargetId(args.clientId);
        } else {
          const activeSessionId = await resolveTargetId();
          if (supportingClientIds.includes(activeSessionId)) {
            targetId = activeSessionId;
          } else if (supportingClientIds.length > 0) {
            targetId = supportingClientIds[0];
          } else {
            targetId = activeSessionId;
          }
        }

        if (!targetId) {
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              isError: true,
              content: [
                { type: "text", text: "Error: No connected client available." },
              ],
              _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
            },
          };
        }

        if (
          supportingClientIds.length > 0 &&
          !supportingClientIds.includes(targetId)
        ) {
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Error: Tool '${toolName}' is not enabled or available on client '${targetId}'. (Available on: ${supportingClientIds.join(", ")})`,
                },
              ],
              _meta: {
                clientId: targetId,
                "io.modelcontextprotocol/serverInfo": serverInfo,
              },
            },
          };
        }

        try {
          console.error(
            `[ShadowClaw MCP] Executing '${toolName}' on client: ${targetId}`,
          );
          const toolArgs = { ...args };
          delete toolArgs.clientId;
          const isInteractive = toolName === "ask_user";
          const res = isInteractive
            ? await client.sendCommand(
                targetId,
                "invoke-tool",
                {
                  toolName,
                  input: toolArgs,
                },
                300000,
              )
            : await client.sendCommand(targetId, "invoke-tool", {
                toolName,
                input: toolArgs,
              });

          const rawResult =
            res.data?.result !== undefined ? res.data.result : res.data;
          const textOutput =
            typeof rawResult === "string"
              ? rawResult
              : JSON.stringify(rawResult, null, 2);

          const errorMessage =
            res.error ||
            (res.data && res.data.error) ||
            "Unknown tool execution error";

          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              isError: !res.success,
              content: [
                {
                  type: "text",
                  text: res.success
                    ? textOutput || ""
                    : textOutput && textOutput !== "null" && textOutput !== "{}"
                      ? `${textOutput}\n${errorMessage}`
                      : `Tool execution error: ${errorMessage}`,
                },
              ],
              _meta: {
                clientId: targetId,
                "io.modelcontextprotocol/serverInfo": serverInfo,
              },
            },
          };
        } catch (err) {
          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              isError: true,
              content: [{ type: "text", text: `Tool error: ${err.message}` }],
              _meta: {
                clientId: targetId,
                "io.modelcontextprotocol/serverInfo": serverInfo,
              },
            },
          };
        }
      }

      case "tasks/get": {
        return {
          jsonrpc: "2.0",
          id: reqId,
          result: {
            resultType: "complete",
            task: {
              taskId: request.params?.taskId || "task-1",
              status: "completed",
            },
            _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
          },
        };
      }

      default: {
        if (isNotification) {
          return null;
        }
        return {
          jsonrpc: "2.0",
          id: reqId,
          error: {
            code: -32601,
            message: `Method not found: '${request.method}'`,
          },
        };
      }
    }
  }

  return {
    handleMessage,
    getActiveClientId: () => activeClientId,
    setActiveClientId: (id) => {
      activeClientId = id;
    },
  };
}

export async function runMcpCommand(options = {}) {
  const mcpTransport =
    options.mcpTransport || (options.http ? "http" : "stdio");

  if (mcpTransport === "http") {
    const port = parseInt(options.port || process.env.MCP_PORT || "8888", 10);
    const host = options.host || "127.0.0.1";
    const engine = createCliMcpEngine(options);

    const server = http.createServer(async (req, res) => {
      if (req.method !== "POST" || req.url?.split("?")[0] !== "/mcp") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", async () => {
        try {
          const body = JSON.parse(data);
          const headers = {
            "mcp-protocol-version": req.headers["mcp-protocol-version"],
            "mcp-method": req.headers["mcp-method"],
            "mcp-name": req.headers["mcp-name"],
          };

          const reply = await engine.handleMessage(body, headers);
          if (reply === null) {
            res.writeHead(202);
            res.end();
            return;
          }

          res.writeHead(200, {
            "Content-Type": "application/json",
            "MCP-Protocol-Version": "2026-07-28",
          });
          res.end(JSON.stringify(reply));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Parse error" },
            }),
          );
        }
      });
    });

    server.listen(port, host, () => {
      console.error(
        `[ShadowClaw MCP] HTTP MCP server listening at http://${host}:${port}/mcp (2026-07-28)`,
      );
    });

    return;
  }

  // Default: STDIO transport
  // Redirect console.log to stderr so JSON-RPC framing on stdout is undisturbed
  console.log = (...args) => console.error(...args);
  console.info = (...args) => console.error(...args);

  const engine = createCliMcpEngine(options);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const request = JSON.parse(trimmed);
      const response = await engine.handleMessage(request);
      if (response !== null) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    } catch (err) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      };
      process.stdout.write(JSON.stringify(errorResponse) + "\n");
    }
  });

  console.error("[ShadowClaw MCP] STDIO MCP server active (2026-07-28)");
}
