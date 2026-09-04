/**
 * ShadowClaw — Client Tool Relay
 *
 * Dynamically queries connected browser/Electron clients for their live WebMCP
 * and worker tools (read_file, write_file, bash, git_*, etc.), exposes them as
 * discoverable tools via MCP, and relays execution bidirectionally.
 */

import type { McpServer } from "../mcp-server.js";
import type { McpTool, McpToolCallResult } from "../types.js";
import { resolveTargetClientId } from "./built-in-tools.js";

export interface ClientToolRelayOptions {
  targetClientId?: string;
  cacheTtlMs?: number;
}

export interface ClientToolRelay {
  discoverTools: () => Promise<McpTool[]>;
  attachToServer: (server: McpServer) => void;
  getActiveClientId?: () => string;
  setActiveClientId?: (id: string) => void;
}

export function createClientToolRelay(
  controlPlane: any,
  options: ClientToolRelayOptions = {},
): ClientToolRelay {
  const { targetClientId, cacheTtlMs = 3000 } = options;

  let cachedTools: McpTool[] = [];
  let cacheTime = 0;
  let activeClientId = targetClientId || "";
  const registeredHandlers = new Set<string>();
  const toolSupportingClientsMap = new Map<string, any[]>();
  const toolDefMap = new Map<string, any>();

  async function discoverTools(): Promise<McpTool[]> {
    const now = Date.now();
    if (cachedTools.length > 0 && now - cacheTime < cacheTtlMs) {
      return cachedTools;
    }

    let clients: any[] = [];
    try {
      clients =
        typeof controlPlane.getConnectedClients === "function"
          ? controlPlane.getConnectedClients()
          : typeof controlPlane.listClients === "function"
            ? await controlPlane.listClients()
            : [];
    } catch (_) {}

    if (!Array.isArray(clients) || clients.length === 0) {
      toolSupportingClientsMap.clear();
      toolDefMap.clear();
      return [];
    }

    toolSupportingClientsMap.clear();
    toolDefMap.clear();

    for (const c of clients) {
      const cid = (c as any).clientId || (c as any).id;
      if (!cid) continue;

      try {
        const res = await controlPlane.sendCommand(cid, "list-tools", {});
        if (
          res &&
          res.success &&
          res.data?.tools &&
          Array.isArray(res.data.tools)
        ) {
          for (const t of res.data.tools) {
            if (!toolDefMap.has(t.name)) {
              toolDefMap.set(t.name, t);
              toolSupportingClientsMap.set(t.name, []);
            }
            toolSupportingClientsMap.get(t.name)!.push(c);
          }
        }
      } catch (err) {
        console.warn(
          `[ClientToolRelay] Failed to query tools from client ${cid}:`,
          err,
        );
      }
    }

    const targetId = resolveTargetClientId(
      controlPlane,
      activeClientId || targetClientId,
    );
    const toolMap = new Map<string, McpTool>();

    for (const [toolName, t] of toolDefMap.entries()) {
      const supportingClients = toolSupportingClientsMap.get(toolName) || [];
      const supportingClientIds = supportingClients
        .map((cl: any) => cl.clientId || cl.id)
        .filter(Boolean);

      const preferredClient =
        supportingClients.find(
          (cl: any) => (cl.clientId || cl.id) === targetId,
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
          description: `Target ShadowClaw client ID (optional; defaults to ${toolDefaultId} [${toolDefaultLabel}]). Available on: ${supportingClients.map((cl: any) => `${cl.clientId || cl.id} (${cl.deviceLabel || "Client"})`).join(", ")}`,
          enum: supportingClientIds,
        },
      };

      const clientNote =
        clients.length > 1
          ? supportingClients.length > 1
            ? ` [Default: ${toolDefaultLabel} (${toolDefaultId.slice(0, 14)}...)]`
            : ` [Client: ${toolDefaultLabel} (${toolDefaultId.slice(0, 14)}...)]`
          : "";

      toolMap.set(toolName, {
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

    cachedTools = Array.from(toolMap.values());
    cacheTime = now;
    return cachedTools;
  }

  function attachToServer(server: McpServer): void {
    // Dynamic tool provider for tools/list
    server.setToolProvider(async () => {
      const tools = await discoverTools();
      for (const tool of tools) {
        if (!registeredHandlers.has(tool.name)) {
          registeredHandlers.add(tool.name);
          server.registerToolHandler(
            tool.name,
            async (args, meta, inputResponses) => {
              return executeRelayedTool(tool.name, args, meta, inputResponses);
            },
          );
        }
      }
      return tools;
    });
  }

  async function executeRelayedTool(
    toolName: string,
    args: Record<string, unknown>,
    _meta?: Record<string, unknown>,
    inputResponses?: Record<string, unknown>,
  ): Promise<McpToolCallResult> {
    const connectedClients =
      typeof controlPlane.getConnectedClients === "function"
        ? controlPlane.getConnectedClients()
        : typeof controlPlane.listClients === "function"
          ? await controlPlane.listClients()
          : [];
    if (!Array.isArray(connectedClients) || connectedClients.length === 0) {
      return {
        resultType: "complete",
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: No connected ShadowClaw client available to execute tool.",
          },
        ],
      };
    }

    if (toolDefMap.size === 0) {
      await discoverTools();
    }

    const supportingClients = toolSupportingClientsMap.get(toolName) || [];
    const supportingClientIds = supportingClients
      .map((cl: any) => cl.clientId || cl.id)
      .filter(Boolean);

    let resolvedClientCandidate = args.clientId as string | undefined;
    if (!resolvedClientCandidate) {
      const activeCandidate = activeClientId || targetClientId;
      const activeId = resolveTargetClientId(controlPlane, activeCandidate);
      if (supportingClientIds.includes(activeId)) {
        resolvedClientCandidate = activeId;
      } else if (supportingClientIds.length > 0) {
        resolvedClientCandidate = supportingClientIds[0];
      }
    }

    const clientId = resolveTargetClientId(
      controlPlane,
      resolvedClientCandidate,
    );
    if (!clientId) {
      return {
        resultType: "complete",
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: No connected ShadowClaw client available to execute tool.",
          },
        ],
      };
    }

    if (
      supportingClientIds.length > 0 &&
      !supportingClientIds.includes(clientId)
    ) {
      return {
        resultType: "complete",
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: Tool '${toolName}' is not enabled or available on client '${clientId}'. (Available on: ${supportingClientIds.join(", ")})`,
          },
        ],
        _meta: { clientId },
      };
    }

    // Interactive tool handling: ask_user via MRTR
    if (toolName === "ask_user") {
      if (!inputResponses || !inputResponses["response"]) {
        const question =
          (args.question as string) ||
          (args.prompt as string) ||
          "Please provide user response:";

        return {
          resultType: "input_required",
          inputRequests: [
            {
              id: "response",
              type: "prompt",
              message: question,
              requestedSchema: {
                type: "object",
                properties: {
                  response: { type: "string", description: "Your answer" },
                },
              },
            },
          ],
        };
      }

      // Input provided via MRTR retry
      const userResponse = inputResponses["response"];
      return {
        resultType: "complete",
        content: [
          {
            type: "text",
            text:
              typeof userResponse === "string"
                ? userResponse
                : JSON.stringify(userResponse),
          },
        ],
        _meta: {
          clientId,
        },
      };
    }

    // Standard tool execution via Control Plane invoke-tool command
    try {
      const toolArgs = { ...args };
      delete toolArgs.clientId;
      const res = await controlPlane.sendCommand(clientId, "invoke-tool", {
        toolName,
        input: toolArgs,
      });

      if (!res.success) {
        return {
          resultType: "complete",
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool execution error: ${res.error || "Unknown client execution error"}`,
            },
          ],
          _meta: {
            clientId,
          },
        };
      }

      const rawResult =
        res.data?.result !== undefined ? res.data.result : res.data;
      const textOutput =
        typeof rawResult === "string"
          ? rawResult
          : JSON.stringify(rawResult, null, 2);

      return {
        resultType: "complete",
        content: [
          {
            type: "text",
            text: textOutput,
          },
        ],
        _meta: {
          clientId,
        },
      };
    } catch (err: any) {
      return {
        resultType: "complete",
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to dispatch tool '${toolName}' to client: ${err.message || String(err)}`,
          },
        ],
        _meta: {
          clientId,
        },
      };
    }
  }

  return {
    discoverTools,
    attachToServer,
    getActiveClientId: () =>
      activeClientId || resolveTargetClientId(controlPlane, targetClientId),
    setActiveClientId: (id: string) => {
      activeClientId = id;
    },
  };
}
