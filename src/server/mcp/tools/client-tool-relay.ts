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
}

export function createClientToolRelay(
  controlPlane: any,
  options: ClientToolRelayOptions = {},
): ClientToolRelay {
  const { targetClientId, cacheTtlMs = 3000 } = options;

  let cachedTools: McpTool[] = [];
  let cacheTime = 0;
  const registeredHandlers = new Set<string>();

  async function discoverTools(): Promise<McpTool[]> {
    const now = Date.now();
    if (cachedTools.length > 0 && now - cacheTime < cacheTtlMs) {
      return cachedTools;
    }

    const clientId = resolveTargetClientId(controlPlane, targetClientId);
    if (!clientId) {
      return [];
    }

    try {
      const res = await controlPlane.sendCommand(clientId, "list-tools", {});
      if (
        res &&
        res.success &&
        res.data?.tools &&
        Array.isArray(res.data.tools)
      ) {
        cachedTools = res.data.tools.map((t: any) => ({
          name: t.name,
          description:
            t.description || `Relayed tool '${t.name}' from connected client.`,
          inputSchema: t.inputSchema || { type: "object", properties: {} },
          annotations: t.annotations,
        }));
        cacheTime = now;
        return cachedTools;
      }
    } catch (err) {
      console.warn(
        `[ClientToolRelay] Failed to query tools from client ${clientId}:`,
        err,
      );
    }

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
    const clientId = resolveTargetClientId(controlPlane, targetClientId);
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
      };
    }

    // Standard tool execution via Control Plane invoke-tool command
    try {
      const res = await controlPlane.sendCommand(clientId, "invoke-tool", {
        toolName,
        input: args,
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
      };
    }
  }

  return {
    discoverTools,
    attachToServer,
  };
}
