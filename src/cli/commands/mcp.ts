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
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CliControlClient,
  type ControlClientOptions,
} from "../utils/control-client.js";

const __mcp_dirname = path.dirname(fileURLToPath(import.meta.url));
function getCliVersion(): string {
  try {
    const pkgPath = path.resolve(__mcp_dirname, "../../../package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.version) return pkg.version;
    }
  } catch {}
  return "1.27.1";
}

export const MCP_CLIENT_TOOL_PREFIX = "shadowclaw_client_";
export const MCP_SERVER_TOOL_PREFIX = "shadowclaw_server_";
export const MCP_LOCAL_TOOL_PREFIX = "shadowclaw_local_";

import {
  getClientRawToolName,
  toClientExposedToolName,
} from "../../server/mcp/tools/client-tool-names.js";
import {
  BUILTIN_TOOL_DEFINITIONS,
  resolveTargetClientId,
} from "../../server/mcp/tools/built-in-tool-definitions.js";
import type { McpTool } from "../../server/mcp/types.js";
import { getAgentCore } from "../utils/agent-core.js";
import { bootstrapHeadlessAgent } from "./agent-bootstrap.js";
import { BROWSER_ONLY_TOOLS } from "../../config/headless.js";

export type McpToolDefinition = McpTool;

export const CLI_BUILTIN_TOOLS: McpToolDefinition[] = BUILTIN_TOOL_DEFINITIONS;

export function formatLocalToolName(
  name: string,
  target: "raw" | "exposed",
  prefix: string = MCP_LOCAL_TOOL_PREFIX,
): string {
  if (typeof name !== "string") {
    return name;
  }
  if (target === "raw") {
    if (name.startsWith(MCP_LOCAL_TOOL_PREFIX)) {
      return name.slice(MCP_LOCAL_TOOL_PREFIX.length);
    }
    if (name.startsWith("shadowclaw_")) {
      return name.slice("shadowclaw_".length);
    }
    return name;
  }
  return !name.startsWith(prefix) ? `${prefix}${name}` : name;
}

export function toLocalMcpTool(
  def: any,
  prefix: string = MCP_LOCAL_TOOL_PREFIX,
): McpToolDefinition {
  const rawSchema = def.inputSchema || def.input_schema;
  const inputSchema =
    rawSchema && typeof rawSchema === "object"
      ? {
          ...rawSchema,
          type: rawSchema.type || "object",
          properties: rawSchema.properties || {},
        }
      : { type: "object", properties: {} };

  const exposedName = prefix ? `${prefix}${def.name}` : def.name;

  return {
    name: exposedName,
    description: def.description || `CLI agent tool: ${def.name}`,
    inputSchema,
    annotations: def.annotations,
  };
}

export function formatLocalToolResult(
  output: any,
  serverInfo: any,
  reqId: any,
): any {
  let isError = false;
  let content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }> = [];

  if (Array.isArray(output)) {
    content = output.map((item) => {
      if (item && typeof item === "object") {
        if (item.type === "image") {
          return {
            type: "image",
            data: item.data || "",
            mimeType: item.media_type || item.mimeType || "image/png",
          };
        }
        if (item.type === "text") {
          return {
            type: "text",
            text: String(item.text ?? ""),
          };
        }
        return {
          type: "text",
          text: JSON.stringify(item, null, 2),
        };
      }
      return {
        type: "text",
        text: String(item ?? ""),
      };
    });
  } else if (typeof output === "string") {
    if (
      output.toLowerCase().startsWith("error") ||
      output.toLowerCase().startsWith("tool error") ||
      output.includes("SecurityError") ||
      (output.startsWith('Tool "') && output.includes("is not allowed")) ||
      (output.startsWith('Tool "') && output.includes("is not available"))
    ) {
      isError = true;
    }
    content = [{ type: "text", text: output }];
  } else if (output && typeof output === "object") {
    if (output.error || output.success === false) {
      isError = true;
    }
    content = [{ type: "text", text: JSON.stringify(output, null, 2) }];
  } else {
    content = [{ type: "text", text: String(output ?? "") }];
  }

  return {
    jsonrpc: "2.0",
    id: reqId,
    result: {
      resultType: "complete",
      isError,
      content,
      _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
    },
  };
}

export interface CliMcpEngineOptions extends ControlClientOptions {
  client?: any;
  relayClientTools?: boolean;
  targetClientId?: string;
  clientTarget?: string;
  version?: string;
  localTools?: boolean;
  toolPrefix?: "local" | "none" | "shadowclaw" | string;
  workspace?: string;
  workspaceDir?: string;
  databaseDir?: string;
  cacheDir?: string;
  group?: string;
  tools?: string;
  toolsProfile?: string;
  allowInternet?: boolean;
  internetAccess?: boolean;
  core?: any;
  db?: any;
  [key: string]: any;
}

export interface CliMcpEngine {
  handleMessage: (request: any, headers?: Record<string, any>) => Promise<any>;
  getActiveClientId: () => string;
  setActiveClientId: (id: string) => void;
  close?: () => Promise<void>;
}

export function createCliMcpEngine(
  options: CliMcpEngineOptions = {},
): CliMcpEngine {
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

  async function resolveTargetId(requestedId?: string): Promise<string> {
    const candidate = requestedId || activeClientId || targetClientId;
    try {
      const clients = await client.listClients();
      return resolveTargetClientId(
        { getConnectedClients: () => clients },
        candidate,
      );
    } catch (_) {}
    return resolveTargetClientId(client, candidate);
  }

  const toolSupportingClientsMap = new Map<string, any[]>();
  const toolDefMap = new Map<string, any>();

  const localTools = options.localTools !== false;
  const toolPrefix = options.toolPrefix ?? "local";
  const prefixStr =
    toolPrefix === "none" || toolPrefix === ""
      ? ""
      : toolPrefix === "shadowclaw"
        ? "shadowclaw_"
        : MCP_LOCAL_TOOL_PREFIX;

  const localToolDefMap = new Map<string, any>();
  let headlessContextPromise: Promise<{
    db: any;
    workspaceDir: string;
    core: any;
  } | null> | null = null;

  async function getHeadlessContext(): Promise<{
    db: any;
    workspaceDir: string;
    core: any;
  } | null> {
    if (!headlessContextPromise) {
      headlessContextPromise = (async () => {
        if (options.core && options.db) {
          let fallbackWs: string;
          if (options.workspaceDir || options.workspace) {
            fallbackWs = (options.workspaceDir || options.workspace)!;
          } else {
            const baseTmp = path.join(tmpdir(), "shadow-claw");
            await mkdir(baseTmp, { recursive: true });
            fallbackWs = await mkdtemp(path.join(baseTmp, "workspace-"));
          }
          return {
            db: options.db,
            workspaceDir: fallbackWs,
            core: options.core,
          };
        }
        const core = options.core || (await getAgentCore());
        const explicitWorkspace = options.workspaceDir || options.workspace;
        let targetWorkspace: string | null = null;
        let targetCacheDir: string | null = null;
        let targetDbDir: string | null = null;

        if (explicitWorkspace) {
          targetWorkspace = path.resolve(explicitWorkspace);
          targetCacheDir = options.cacheDir
            ? path.resolve(options.cacheDir)
            : path.join(targetWorkspace, ".cache");
          targetDbDir = options.databaseDir
            ? path.resolve(options.databaseDir)
            : path.join(targetCacheDir, "database");
        } else {
          // No explicit workspace: use a unique process-isolated tmp dir that can't be traversed backwards
          try {
            const baseTmp = path.join(tmpdir(), "shadow-claw");
            await mkdir(baseTmp, { recursive: true });
            const hostAgnosticTmp = await mkdtemp(
              path.join(baseTmp, "workspace-"),
            );
            targetWorkspace = hostAgnosticTmp;
            targetCacheDir = options.cacheDir
              ? path.resolve(options.cacheDir)
              : await mkdtemp(path.join(baseTmp, "cache-"));
            targetDbDir = options.databaseDir
              ? path.resolve(options.databaseDir)
              : path.join(targetCacheDir, "database");
            await mkdir(targetCacheDir, { recursive: true });
            await mkdir(targetDbDir, { recursive: true });
          } catch (err: any) {
            console.error(
              `[ShadowClaw MCP] Warning: No --workspace provided and failed to initialize temporary fallback workspace (${err.message}). Local workspace tools are disabled.`,
            );
            return null;
          }
        }

        try {
          const bootstrapResult = await bootstrapHeadlessAgent({
            ...options,
            workspace: targetWorkspace,
            cacheDir: targetCacheDir,
            databaseDir: targetDbDir,
            yes: true,
            quiet: true,
            isTTY: false,
            core,
          });

          return {
            db: bootstrapResult.db,
            workspaceDir: bootstrapResult.workspaceDir,
            core: bootstrapResult.core,
          };
        } catch (err: any) {
          console.error(
            `[ShadowClaw MCP] Warning: Failed to bootstrap headless agent context (${err.message}). Local workspace tools are disabled.`,
          );
          return null;
        }
      })();
    }
    return headlessContextPromise;
  }

  async function getLocalAgentTools(): Promise<McpToolDefinition[]> {
    if (!localTools) {
      return [];
    }

    let ctx: any;
    try {
      ctx = await getHeadlessContext();
    } catch (err: any) {
      console.error(
        `[ShadowClaw MCP] Failed to initialize local agent context: ${err.message}`,
      );
      return [];
    }

    if (!ctx) {
      return [];
    }

    const { db, core } = ctx;
    const groupId =
      options.group || core.DEFAULT_SERVER_GROUP_ID || "server:main";

    let profileToolNames: Set<string> | null = null;
    if (options.toolsProfile || options.profile) {
      const target = String(options.toolsProfile || options.profile)
        .trim()
        .toLowerCase();
      const defaultBuiltinProfile = core.DEFAULT_BUILTIN_PROFILE || null;
      let dbProfiles: any[] = [];
      if (typeof core.getConfig === "function") {
        try {
          const raw = await core.getConfig(
            db,
            core.CONFIG_KEYS?.TOOL_PROFILES || "tool_profiles",
          );
          if (typeof raw === "string") dbProfiles = JSON.parse(raw);
          else if (Array.isArray(raw)) dbProfiles = raw;
        } catch {}
      }
      const allProfiles = [defaultBuiltinProfile, ...dbProfiles].filter(
        Boolean,
      );
      const matched = allProfiles.find(
        (p: any) =>
          (p.id && String(p.id).toLowerCase() === target) ||
          (p.name && String(p.name).toLowerCase() === target),
      );
      if (matched) {
        profileToolNames = new Set(matched.enabledToolNames || []);
      }
    }

    let allowedExplicitTools: Set<string> | null = null;
    if (
      options.tools &&
      typeof options.tools === "string" &&
      options.tools.trim()
    ) {
      const list = options.tools
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      allowedExplicitTools = new Set(list);
    }

    const allTools = [...(core.TOOL_DEFINITIONS || [])];
    if (typeof core.loadDeclarativeTools === "function") {
      try {
        const decl = await core.loadDeclarativeTools(db, groupId);
        if (decl && Array.isArray(decl.tools)) {
          for (const dt of decl.tools) {
            if (!allTools.some((t: any) => t.name === dt.name)) {
              allTools.push(dt);
            }
          }
        }
      } catch {}
    }

    const browserOnly = core.BROWSER_ONLY_TOOLS || BROWSER_ONLY_TOOLS;
    localToolDefMap.clear();

    const resultTools: McpToolDefinition[] = [];

    for (const def of allTools) {
      if (!def || !def.name) continue;
      if (browserOnly && browserOnly.has(def.name)) continue;
      if (allowedExplicitTools && !allowedExplicitTools.has(def.name)) continue;
      if (profileToolNames && !profileToolNames.has(def.name)) continue;

      const mcpTool = toLocalMcpTool(def, prefixStr);
      localToolDefMap.set(def.name, def);
      localToolDefMap.set(`shadowclaw_local_${def.name}`, def);
      localToolDefMap.set(`shadowclaw_${def.name}`, def);

      resultTools.push(mcpTool);
    }

    return resultTools;
  }

  async function executeLocalTool(
    toolDef: any,
    toolArgs: Record<string, any>,
    reqId: any,
  ): Promise<any> {
    try {
      const ctx = await getHeadlessContext();
      if (!ctx) {
        return {
          jsonrpc: "2.0",
          id: reqId,
          result: {
            resultType: "complete",
            isError: true,
            content: [
              {
                type: "text",
                text: "Error: Local workspace tools are not initialized.",
              },
            ],
            _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
          },
        };
      }
      const groupId =
        options.group || ctx.core.DEFAULT_SERVER_GROUP_ID || "server:main";
      let invokeContext: any = undefined;
      try {
        const { resolveAgentProvider } = await import("./agent.js");
        const resolved = await resolveAgentProvider(
          ctx.db,
          ctx.core,
          ctx.workspaceDir,
          {
            ...options,
            interactive: false,
          },
        );
        invokeContext = {
          db: ctx.db,
          provider: resolved.providerId,
          model: resolved.model,
          apiKey: resolved.apiKey,
        };
      } catch {}

      console.error(
        `[ShadowClaw MCP] Executing local tool '${toolDef.name}' in workspace: ${ctx.workspaceDir}`,
      );

      const output = await ctx.core.executeTool(
        ctx.db,
        toolDef.name,
        toolArgs,
        groupId,
        {
          invokeContext,
        },
      );

      return formatLocalToolResult(output, serverInfo, reqId);
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id: reqId,
        result: {
          resultType: "complete",
          isError: true,
          content: [
            {
              type: "text",
              text: `Error executing local tool '${toolDef.name}': ${err.message || String(err)}`,
            },
          ],
          _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
        },
      };
    }
  }

  async function getRelayedTools(): Promise<McpToolDefinition[]> {
    if (!relayClientTools) {
      return [];
    }
    let clients: any[] = [];
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
            const rawName = getClientRawToolName(t.name);
            if (
              rawName === "send_notification" ||
              (rawName.startsWith("shadowclaw_") &&
                !rawName.startsWith("shadowclaw_client_"))
            ) {
              continue;
            }
            if (!toolDefMap.has(rawName)) {
              toolDefMap.set(rawName, t);
              toolSupportingClientsMap.set(rawName, []);
            }
            toolSupportingClientsMap.get(rawName)!.push(c);
          }
        }
      } catch (_) {}
    }

    const activeTargetId = await resolveTargetId();
    const relayedTools: McpToolDefinition[] = [];

    for (const [rawToolName, t] of toolDefMap.entries()) {
      const supportingClients = toolSupportingClientsMap.get(rawToolName) || [];
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

      const exposedName = toClientExposedToolName(rawToolName);

      relayedTools.push({
        name: exposedName,
        description:
          (t.description ||
            `Relayed tool '${rawToolName}' from connected client.`) +
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

  async function handleMessage(
    request: any,
    headers: Record<string, any> = {},
  ): Promise<any> {
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
        let pushClients: any[] = [];
        try {
          if (typeof client.listPushClients === "function") {
            pushClients = await client.listPushClients();
          } else if (typeof client.listPushSubscriptions === "function") {
            const subs = await client.listPushSubscriptions();
            if (Array.isArray(subs)) {
              const map = new Map<string, any>();
              for (const sub of subs) {
                const cid =
                  (sub.client_id || "").trim() ||
                  (sub.id ? String(sub.id) : "");
                if (cid && !map.has(cid)) {
                  map.set(cid, {
                    clientId: cid,
                    deviceLabel: sub.device_label || undefined,
                  });
                }
              }
              pushClients = Array.from(map.values());
            }
          }
        } catch (_) {}

        const sortedPushClients = Array.isArray(pushClients)
          ? [...pushClients].sort((a, b) =>
              (a.clientId || "").localeCompare(b.clientId || ""),
            )
          : [];
        const pushClientIds = sortedPushClients
          .map((c) => c.clientId)
          .filter(Boolean);

        const relayed = await getRelayedTools();
        const localToolsList = await getLocalAgentTools();
        const combined = new Map<string, McpToolDefinition>();
        for (const t of CLI_BUILTIN_TOOLS) {
          combined.set(t.name, t);
        }
        for (const t of localToolsList) {
          if (!combined.has(t.name)) {
            combined.set(t.name, t);
          }
        }
        for (const t of relayed) {
          if (!combined.has(t.name)) {
            combined.set(t.name, t);
          }
        }

        if (pushClientIds.length > 0) {
          for (const targetName of [
            "shadowclaw_server_send_notification",
            "shadowclaw_send_notification",
          ]) {
            const existing = combined.get(targetName);
            if (existing) {
              combined.set(targetName, {
                ...existing,
                inputSchema: {
                  ...existing.inputSchema,
                  type: "object",
                  properties: {
                    ...(existing.inputSchema?.properties || {}),
                    clientId: {
                      type: "string",
                      description: `Target client ID, prefix, or device label of a specific client registered for push notifications (optional; if omitted, broadcasts to all subscribed devices). Available on: ${sortedPushClients.map((c) => `${c.clientId} (${c.deviceLabel || "Client"})`).join(", ")}`,
                      enum: pushClientIds,
                    },
                  },
                },
              });
            }
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
        if (
          toolName === "shadowclaw_server_list_clients" ||
          toolName === "shadowclaw_list_clients"
        ) {
          try {
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
          } catch (err: any) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Error listing clients: ${err.message}`,
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
        }

        if (
          toolName === "shadowclaw_server_set_active_client" ||
          toolName === "shadowclaw_set_active_client"
        ) {
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

        if (
          toolName === "shadowclaw_server_send_message" ||
          toolName === "shadowclaw_send_message"
        ) {
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
          try {
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
          } catch (err: any) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Error sending message: ${err.message}`,
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
        }

        if (
          toolName === "shadowclaw_server_read_state" ||
          toolName === "shadowclaw_read_state"
        ) {
          const targetId = await resolveTargetId(args.clientId);
          try {
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
          } catch (err: any) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Error reading state: ${err.message}`,
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
        }

        if (
          toolName === "shadowclaw_server_list_tasks" ||
          toolName === "shadowclaw_list_tasks"
        ) {
          const targetId = await resolveTargetId(args.clientId);
          try {
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
          } catch (err: any) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Error listing tasks: ${err.message}`,
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
        }

        if (
          toolName === "shadowclaw_server_manage_backup" ||
          toolName === "shadowclaw_manage_backup"
        ) {
          const action = args.action || "trigger";
          const targetId = await resolveTargetId(args.clientId);
          try {
            if (action === "list") {
              const backups = await client.listBackups(targetId);
              return {
                jsonrpc: "2.0",
                id: reqId,
                result: {
                  resultType: "complete",
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({ backups }, null, 2),
                    },
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
                  content: [
                    { type: "text", text: JSON.stringify(res, null, 2) },
                  ],
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
          } catch (err: any) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Error managing backup: ${err.message}`,
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
        }

        if (
          toolName === "shadowclaw_server_status" ||
          toolName === "shadowclaw_status"
        ) {
          try {
            const clients = await client.listClients();
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        server: "ShadowClaw",
                        version: serverInfo.version,
                        connectedClients: clients.length,
                        status: "healthy",
                      },
                      null,
                      2,
                    ),
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          } catch (err: any) {
            return {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Error querying server status: ${err.message}`,
                  },
                ],
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
              },
            };
          }
        }

        if (
          toolName === "shadowclaw_server_send_notification" ||
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
            let msg: string;

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
          } catch (err: any) {
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

        const rawToolName = getClientRawToolName(toolName);

        // Relayed interactive ask_user tool with MRTR response fulfillment if provided
        if (
          (rawToolName === "ask_user" || toolName === "ask_user") &&
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

        // Check local tools
        if (localTools && localToolDefMap.size === 0) {
          await getLocalAgentTools();
        }

        const isLocalPrefix = toolName.startsWith(MCP_LOCAL_TOOL_PREFIX);
        const isClientPrefix = toolName.startsWith(MCP_CLIENT_TOOL_PREFIX);

        let localDef = localToolDefMap.get(toolName);
        if (!localDef && isLocalPrefix) {
          localDef = localToolDefMap.get(
            toolName.slice(MCP_LOCAL_TOOL_PREFIX.length),
          );
        }
        if (
          !localDef &&
          toolName.startsWith("shadowclaw_") &&
          !isClientPrefix
        ) {
          localDef = localToolDefMap.get(toolName.slice("shadowclaw_".length));
        }

        // If explicitly called with shadowclaw_local_ prefix, execute locally
        if (isLocalPrefix && localDef) {
          const localArgs = { ...args };
          delete localArgs.clientId;
          return await executeLocalTool(localDef, localArgs, reqId);
        }

        // Relayed client tools (invoke-tool)
        if (relayClientTools && toolDefMap.size === 0) {
          await getRelayedTools();
        }

        const supportingClients =
          toolSupportingClientsMap.get(rawToolName) ||
          toolSupportingClientsMap.get(toolName) ||
          [];
        const supportingClientIds = supportingClients
          .map((cl) => cl.clientId || cl.id)
          .filter(Boolean);

        let connectedClients: any[] = [];
        try {
          connectedClients = await client.listClients();
        } catch (_) {}

        // If unprefixed tool was requested:
        // When toolPrefix === "none", local tools take precedence if no clientId was specified.
        // If connected clients are present and relayClientTools is enabled, proxy to client (backward compatibility);
        // otherwise if localDef exists, execute locally!
        if (!isClientPrefix && localDef) {
          if (toolPrefix === "none" && !args.clientId) {
            const localArgs = { ...args };
            delete localArgs.clientId;
            return await executeLocalTool(localDef, localArgs, reqId);
          }
          if (
            !relayClientTools ||
            !Array.isArray(connectedClients) ||
            connectedClients.length === 0
          ) {
            const localArgs = { ...args };
            delete localArgs.clientId;
            return await executeLocalTool(localDef, localArgs, reqId);
          }
        }

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
            `[ShadowClaw MCP] Executing '${rawToolName}' on client: ${targetId}`,
          );
          const toolArgs = { ...args };
          delete toolArgs.clientId;
          const isInteractive = rawToolName === "ask_user";
          const res = isInteractive
            ? await client.sendCommand(
                targetId,
                "invoke-tool",
                {
                  toolName: rawToolName,
                  input: toolArgs,
                },
                300000,
              )
            : await client.sendCommand(targetId, "invoke-tool", {
                toolName: rawToolName,
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
        } catch (err: any) {
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
    setActiveClientId: (id: string) => {
      activeClientId = id;
    },
    close: async () => {
      if (headlessContextPromise) {
        try {
          const ctx = await headlessContextPromise;
          if (typeof ctx?.core?.closeSqliteDatabase === "function") {
            ctx.core.closeSqliteDatabase();
          }
        } catch {}
      }
    },
  };
}

export interface McpCommandOptions extends Omit<CliMcpEngineOptions, "port"> {
  mcpTransport?: "http" | "stdio";
  http?: boolean;
  port?: number | string;
  host?: string;
}

export async function runMcpCommand(
  options: McpCommandOptions = {},
): Promise<void> {
  const mcpTransport =
    options.mcpTransport || (options.http ? "http" : "stdio");

  if (mcpTransport === "http") {
    const port = parseInt(
      String(options.port || process.env.MCP_PORT || "8888"),
      10,
    );
    const host = options.host || "127.0.0.1";
    const engine = createCliMcpEngine(options as any);

    const server = http.createServer(async (req, res) => {
      if (req.method !== "POST" || req.url?.split("?")[0] !== "/mcp") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", async () => {
        let body: any;
        try {
          body = JSON.parse(data);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Parse error" },
            }),
          );
          return;
        }

        try {
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
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: body?.id ?? null,
              error: {
                code: -32603,
                message: err?.message || "Internal error",
              },
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
  console.log = (...args: any[]) => console.error(...args);
  console.info = (...args: any[]) => console.error(...args);

  const engine = createCliMcpEngine(options as any);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let request: any;
    try {
      request = JSON.parse(trimmed);
    } catch {
      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      };
      process.stdout.write(JSON.stringify(errorResponse) + "\n");
      return;
    }

    try {
      const response = await engine.handleMessage(request);
      if (response !== null) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    } catch (err: any) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: request?.id ?? null,
        error: { code: -32603, message: err?.message || "Internal error" },
      };
      process.stdout.write(JSON.stringify(errorResponse) + "\n");
    }
  });

  rl.on("close", async () => {
    await engine.close?.();
  });

  console.error("[ShadowClaw MCP] STDIO MCP server active (2026-07-28)");
}
