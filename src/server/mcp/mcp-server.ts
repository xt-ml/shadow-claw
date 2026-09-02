/**
 * ShadowClaw — Stateless MCP Server Core Engine
 *
 * Implements the 2026-07-28 Stateless Model Context Protocol specification,
 * supporting header-based routing, cacheable results, MRTR input requests,
 * and dual-mode backward compatibility for legacy initialization handshakes.
 */

import {
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION_2026_07_28,
  MCP_PROTOCOL_VERSION_2024_11_05,
  SUPPORTED_PROTOCOL_VERSIONS,
  type JsonRpcError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
  type McpHttpHeaders,
  type McpInputRequiredResult,
  type McpServerCapabilities,
  type McpServerInfo,
  type McpTool,
  type McpToolCallResult,
  type McpToolsListResult,
  type ServerDiscoverResult,
} from "./types.js";

export type McpToolHandler = (
  args: Record<string, unknown>,
  meta?: Record<string, unknown>,
  inputResponses?: Record<string, unknown>,
) => Promise<McpToolCallResult | { content: any[]; isError?: boolean }>;

export interface McpServerOptions {
  name?: string;
  version?: string;
  tools?: McpTool[];
  toolProvider?: () => Promise<McpTool[]> | McpTool[];
}

export class McpServer {
  private readonly _name: string;
  private readonly _version: string;
  private readonly _tools: Map<string, McpTool> = new Map();
  private readonly _handlers: Map<string, McpToolHandler> = new Map();
  private _toolProvider?: () => Promise<McpTool[]> | McpTool[];

  constructor(options: McpServerOptions = {}) {
    this._name = options.name || "shadow-claw";
    this._version = options.version || "1.25.0";
    this._toolProvider = options.toolProvider;

    if (options.tools) {
      for (const tool of options.tools) {
        this.registerTool(tool);
      }
    }
  }

  public get serverInfo(): McpServerInfo {
    return {
      name: this._name,
      version: this._version,
    };
  }

  public get capabilities(): McpServerCapabilities {
    return {
      tools: {
        listChanged: true,
      },
      extensions: {
        "io.modelcontextprotocol/tasks": {},
      },
    };
  }

  public registerTool(tool: McpTool, handler?: McpToolHandler): void {
    this._tools.set(tool.name, tool);
    if (handler) {
      this._handlers.set(tool.name, handler);
    }
  }

  public registerToolHandler(name: string, handler: McpToolHandler): void {
    this._handlers.set(name, handler);
  }

  public setToolProvider(provider: () => Promise<McpTool[]> | McpTool[]): void {
    this._toolProvider = provider;
  }

  public async getTools(): Promise<McpTool[]> {
    const toolMap = new Map<string, McpTool>(this._tools);

    if (this._toolProvider) {
      try {
        const dynamicTools = await this._toolProvider();
        if (Array.isArray(dynamicTools)) {
          for (const tool of dynamicTools) {
            toolMap.set(tool.name, tool);
          }
        }
      } catch (err) {
        console.warn("[McpServer] Error fetching dynamic tools:", err);
      }
    }

    // Return in deterministic alphabetical order per 2026-07-28 spec
    return Array.from(toolMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  /**
   * Handle an incoming JSON-RPC request with optional HTTP headers.
   * Returns a JSON-RPC response, or null if the message was a notification.
   */
  public async handleRequest(
    request: JsonRpcRequest,
    headers?: McpHttpHeaders,
  ): Promise<JsonRpcResponse | null> {
    const isNotification = request.id === undefined || request.id === null;
    const reqId = request.id ?? null;

    // 1. Header validations per 2026-07-28 Streamable HTTP spec
    if (headers) {
      const protoVersion = headers["mcp-protocol-version"];
      if (
        protoVersion &&
        !SUPPORTED_PROTOCOL_VERSIONS.includes(protoVersion as any)
      ) {
        return this._makeError(
          reqId,
          MCP_ERROR_CODES.UnsupportedProtocolVersion,
          `Unsupported protocol version: '${protoVersion}'. Supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`,
        );
      }

      const mcpMethod = headers["mcp-method"];
      if (mcpMethod && mcpMethod !== request.method) {
        return this._makeError(
          reqId,
          MCP_ERROR_CODES.HeaderMismatch,
          `Mcp-Method header '${mcpMethod}' does not match body method '${request.method}'`,
        );
      }

      const mcpName = headers["mcp-name"];
      if (
        mcpName &&
        request.method === "tools/call" &&
        request.params?.name &&
        mcpName !== request.params.name
      ) {
        return this._makeError(
          reqId,
          MCP_ERROR_CODES.HeaderMismatch,
          `Mcp-Name header '${mcpName}' does not match params.name '${request.params.name}'`,
        );
      }
    }

    // 2. Dispatch based on method
    switch (request.method) {
      case "server/discover": {
        const result: ServerDiscoverResult = {
          protocolVersion: MCP_PROTOCOL_VERSION_2026_07_28,
          supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
          capabilities: this.capabilities,
          serverInfo: this.serverInfo,
          _meta: {
            "io.modelcontextprotocol/serverInfo": this.serverInfo,
          },
        };
        return this._makeSuccess(reqId, result);
      }

      case "initialize": {
        // Legacy handshake support (2024-11-05 / 2025-11-25)
        const requestedVersion =
          request.params?.protocolVersion || MCP_PROTOCOL_VERSION_2024_11_05;
        const result = {
          protocolVersion: requestedVersion,
          capabilities: this.capabilities,
          serverInfo: this.serverInfo,
        };
        return this._makeSuccess(reqId, result);
      }

      case "notifications/initialized": {
        // Legacy handshake notification
        return null;
      }

      case "tools/list": {
        const tools = await this.getTools();
        const result: McpToolsListResult = {
          resultType: "complete",
          ttlMs: 5000,
          cacheScope: "private",
          tools,
          _meta: {
            "io.modelcontextprotocol/serverInfo": this.serverInfo,
          },
        };
        return this._makeSuccess(reqId, result);
      }

      case "tools/call": {
        const toolName = request.params?.name;
        if (!toolName || typeof toolName !== "string") {
          return this._makeError(
            reqId,
            MCP_ERROR_CODES.InvalidParams,
            "Missing required parameter 'name'",
          );
        }

        let handler = this._handlers.get(toolName);
        if (!handler && this._toolProvider) {
          try {
            await this.getTools();
            handler = this._handlers.get(toolName);
          } catch (_) {}
        }

        if (!handler) {
          return this._makeError(
            reqId,
            MCP_ERROR_CODES.InvalidParams,
            `Tool not found: '${toolName}'`,
          );
        }

        try {
          const rawResult = await handler(
            request.params?.arguments || {},
            request.params?._meta,
            request.params?.inputResponses,
          );

          // Check if MRTR input_required
          if (
            typeof rawResult === "object" &&
            rawResult !== null &&
            (rawResult as any).resultType === "input_required"
          ) {
            const inputRequired = rawResult as McpInputRequiredResult;
            inputRequired._meta = {
              "io.modelcontextprotocol/serverInfo": this.serverInfo,
              ...(inputRequired._meta || {}),
            };
            return this._makeSuccess(reqId, inputRequired);
          }

          // Complete result
          const content = (rawResult as any).content || [];
          const completeResult: McpToolCallResult = {
            resultType: "complete",
            content,
            isError: (rawResult as any).isError || false,
            _meta: {
              "io.modelcontextprotocol/serverInfo": this.serverInfo,
            },
          };
          return this._makeSuccess(reqId, completeResult);
        } catch (err: any) {
          return this._makeSuccess(reqId, {
            resultType: "complete",
            content: [
              {
                type: "text",
                text: `Error executing tool '${toolName}': ${err.message || String(err)}`,
              },
            ],
            isError: true,
            _meta: {
              "io.modelcontextprotocol/serverInfo": this.serverInfo,
            },
          });
        }
      }

      case "tasks/get": {
        const taskId = request.params?.taskId;
        if (!taskId) {
          return this._makeError(
            reqId,
            MCP_ERROR_CODES.InvalidParams,
            "Missing taskId parameter",
          );
        }
        return this._makeSuccess(reqId, {
          resultType: "complete",
          task: {
            taskId,
            status: "completed",
          },
          _meta: {
            "io.modelcontextprotocol/serverInfo": this.serverInfo,
          },
        });
      }

      case "tasks/update": {
        const taskId = request.params?.taskId;
        return this._makeSuccess(reqId, {
          resultType: "complete",
          task: {
            taskId: taskId || "unknown",
            status: "running",
          },
          _meta: {
            "io.modelcontextprotocol/serverInfo": this.serverInfo,
          },
        });
      }

      default: {
        if (isNotification) {
          return null;
        }
        return this._makeError(
          reqId,
          MCP_ERROR_CODES.MethodNotFound,
          `Method not found: '${request.method}'`,
        );
      }
    }
  }

  private _makeSuccess<T>(
    id: string | number | null,
    result: T,
  ): JsonRpcSuccess<T> {
    return {
      jsonrpc: "2.0",
      id,
      result,
    };
  }

  private _makeError(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown,
  ): JsonRpcError {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data !== undefined ? { data } : {}),
      },
    };
  }
}
