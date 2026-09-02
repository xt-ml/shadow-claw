/**
 * ShadowClaw CLI — `mcp` command
 *
 * Runs an official Stateless Model Context Protocol (2026-07-28) server
 * via STDIO or Streamable HTTP, exposing ShadowClaw CLI capabilities
 * and dynamically relayed tools from connected browser clients.
 */

import readline from "node:readline";
import http from "node:http";
import { CliControlClient } from "../utils/control-client.mjs";

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
];

export function createCliMcpEngine(options = {}) {
  const client = options.client || new CliControlClient(options);
  const relayClientTools = options.relayClientTools !== false;
  const targetClientId = options.targetClientId || options.clientTarget;

  const serverInfo = {
    name: "shadow-claw",
    version: "1.25.0",
  };

  const capabilities = {
    tools: { listChanged: true },
    extensions: { "io.modelcontextprotocol/tasks": {} },
  };

  async function resolveTargetId(requestedId) {
    if (requestedId && typeof requestedId === "string" && requestedId.trim()) {
      return requestedId.trim();
    }
    if (targetClientId) {
      return targetClientId;
    }
    try {
      const clients = await client.listClients();
      if (Array.isArray(clients) && clients.length > 0) {
        return clients[0].clientId || clients[0].id || "";
      }
    } catch (_) {}
    return "";
  }

  async function getRelayedTools() {
    if (!relayClientTools) {
      return [];
    }
    const clientId = await resolveTargetId();
    if (!clientId) {
      return [];
    }
    try {
      const res = await client.sendCommand(clientId, "list-tools", {});
      if (
        res &&
        res.success &&
        res.data?.tools &&
        Array.isArray(res.data.tools)
      ) {
        return res.data.tools.map((t) => ({
          name: t.name,
          description:
            t.description || `Relayed tool '${t.name}' from connected client.`,
          inputSchema: t.inputSchema || { type: "object", properties: {} },
          annotations: t.annotations,
        }));
      }
    } catch (_) {}
    return [];
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
          combined.set(t.name, t);
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

        // Relayed interactive ask_user tool (MRTR)
        if (toolName === "ask_user") {
          if (!inputResponses || !inputResponses["response"]) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "input_required",
                inputRequests: [
                  {
                    id: "response",
                    type: "prompt",
                    message:
                      args.question || args.prompt || "User input requested",
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
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
        const targetId = await resolveTargetId(args.clientId);
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

        try {
          const res = await client.sendCommand(targetId, "invoke-tool", {
            toolName,
            input: args,
          });

          const rawResult =
            res.data?.result !== undefined ? res.data.result : res.data;
          const textOutput =
            typeof rawResult === "string"
              ? rawResult
              : JSON.stringify(rawResult, null, 2);

          return {
            jsonrpc: "2.0",
            id: reqId,
            result: {
              resultType: "complete",
              isError: !res.success,
              content: [{ type: "text", text: textOutput || "" }],
              _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
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
              _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
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
