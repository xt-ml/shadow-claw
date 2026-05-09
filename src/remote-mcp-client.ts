import { resolveRemoteMcpConnectionAuth } from "./mcp-connection-auth.js";

import type { ShadowClawDatabase } from "./types.js";

interface RemoteMcpSession {
  sessionId: string;
  protocolVersion?: string;
  lastUsedAt: number;
}

const remoteMcpSessions: Map<string, RemoteMcpSession> = new Map();

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: string;
  result: T;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: string;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

interface JsonRpcServerRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

function isServerRequest(msg: unknown): msg is JsonRpcServerRequest {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "method" in msg &&
    "id" in msg &&
    !("result" in msg) &&
    !("error" in msg)
  );
}

function buildElicitationDefaults(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const schema = (params.requestedSchema || {}) as Record<string, unknown>;
  const properties = (schema.properties || {}) as Record<
    string,
    Record<string, unknown>
  >;
  const defaults: Record<string, unknown> = {};

  for (const [key, prop] of Object.entries(properties)) {
    if ("default" in prop) {
      defaults[key] = prop.default;
    } else if (prop.type === "boolean") {
      defaults[key] = true;
    }
  }

  return defaults;
}

interface ToolListResult {
  tools?: Array<{ name: string; description?: string }>;
}

interface ToolCallResult {
  content?: unknown[];
  isError?: boolean;
}

interface JsonRpcInitializeResult {
  protocolVersion?: string;
}

class InvalidRemoteMcpSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRemoteMcpSessionError";
  }
}

class HttpRemoteMcpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpRemoteMcpError";
    this.status = status;
  }
}

export class McpReauthRequiredError extends Error {
  connectionId: string;
  constructor(connectionId: string) {
    super("OAuth reconnect required for remote MCP connection");
    this.name = "McpReauthRequiredError";
    this.connectionId = connectionId;
  }
}

interface HttpLikeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
  headers?: {
    get?: (name: string) => string | null;
  };
}

function getHeader(response: HttpLikeResponse, name: string): string | null {
  if (!response.headers || typeof response.headers.get !== "function") {
    return null;
  }

  return response.headers.get(name);
}

function isInvalidSessionMessage(message: string): boolean {
  return /no valid session id provided/i.test(message);
}

function toError(
  response: HttpLikeResponse,
  payload: JsonRpcResponse<unknown> | null,
): Error {
  const jsonRpcMessage =
    payload && "error" in payload
      ? payload.error.message || "Remote MCP JSON-RPC error"
      : "";

  if (isInvalidSessionMessage(jsonRpcMessage)) {
    return new InvalidRemoteMcpSessionError(jsonRpcMessage);
  }

  if (!response.ok) {
    return new HttpRemoteMcpError(
      response.status,
      jsonRpcMessage
        ? `Remote MCP HTTP error: ${response.status} (${jsonRpcMessage})`
        : `Remote MCP HTTP error: ${response.status}`,
    );
  }

  return new Error(jsonRpcMessage || "Remote MCP JSON-RPC error");
}

function parseJsonRpcFromSseText<T>(raw: string): JsonRpcResponse<T> | null {
  if (!raw) {
    return null;
  }

  let lastJsonRpc: JsonRpcResponse<T> | null = null;
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }

    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") {
      continue;
    }

    try {
      const parsed = JSON.parse(data) as JsonRpcResponse<T>;
      if (parsed && typeof parsed === "object" && "jsonrpc" in parsed) {
        lastJsonRpc = parsed;
      }
    } catch {
      // Ignore malformed SSE data chunks and keep scanning.
    }
  }

  return lastJsonRpc;
}

function parseJsonRpcFromText<T>(raw: string): JsonRpcResponse<T> | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as JsonRpcResponse<T>;
  } catch {
    return null;
  }
}

async function postJsonRpc<T>(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<{
  response: HttpLikeResponse;
  payload: JsonRpcResponse<T> | null;
}> {
  const response = (await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  })) as HttpLikeResponse;

  const contentType = (getHeader(response, "content-type") || "").toLowerCase();
  let payload: JsonRpcResponse<T> | null = null;

  if (typeof response.text === "function") {
    const raw = await response.text();
    payload = contentType.includes("text/event-stream")
      ? parseJsonRpcFromSseText<T>(raw)
      : parseJsonRpcFromText<T>(raw);
  } else {
    try {
      payload = (await response.json()) as JsonRpcResponse<T>;
    } catch {
      payload = null;
    }
  }

  return { response, payload };
}

async function sendInitializedNotification(
  serverUrl: string,
  headers: Record<string, string>,
  sessionId: string,
): Promise<void> {
  const { response, payload } = await postJsonRpc<unknown>(
    serverUrl,
    {
      ...headers,
      "mcp-session-id": sessionId,
    },
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    },
  );

  if (!response.ok || (payload && "error" in payload)) {
    throw toError(response, payload);
  }
}

async function ensureRemoteMcpSession(
  connectionId: string,
  serverUrl: string,
  headers: Record<string, string>,
): Promise<RemoteMcpSession> {
  const existing = remoteMcpSessions.get(connectionId);
  if (existing?.sessionId) {
    return existing;
  }

  const { response, payload } = await postJsonRpc<JsonRpcInitializeResult>(
    serverUrl,
    headers,
    {
      jsonrpc: "2.0",
      id: `initialize-${Date.now().toString(36)}`,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {
          elicitation: {},
        },
        clientInfo: {
          name: "shadowclaw-remote-mcp-client",
          version: "1.0.0",
        },
      },
    },
  );

  if (!response.ok) {
    throw toError(response, payload);
  }

  if (payload && "error" in payload) {
    throw toError(response, payload);
  }

  const sessionId = getHeader(response, "mcp-session-id") || "";
  if (!sessionId) {
    throw new Error("Remote MCP initialize response missing mcp-session-id");
  }

  const session: RemoteMcpSession = {
    sessionId,
    protocolVersion:
      getHeader(response, "mcp-protocol-version") ||
      (payload as { result?: { protocolVersion?: string } } | null)?.result
        ?.protocolVersion,
    lastUsedAt: Date.now(),
  };

  await sendInitializedNotification(serverUrl, headers, sessionId);
  remoteMcpSessions.set(connectionId, session);

  return session;
}

async function callRemoteMcpWithSession<T>(
  connectionId: string,
  serverUrl: string,
  headers: Record<string, string>,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  let session = await ensureRemoteMcpSession(connectionId, serverUrl, headers);

  const doRequest = async (activeSessionId: string) => {
    const body = {
      jsonrpc: "2.0",
      id: Date.now().toString(),
      method,
      params: params || {},
    };

    const sessionHeaders = {
      ...headers,
      "mcp-session-id": activeSessionId,
    };

    let { response, payload } = await postJsonRpc<T>(
      serverUrl,
      sessionHeaders,
      body,
    );

    // Handle server-initiated requests (e.g., elicitation/create).
    // The gateway may ask the client to confirm before completing a tool call.
    let elicitationAttempts = 0;
    while (isServerRequest(payload) && elicitationAttempts < 5) {
      elicitationAttempts++;

      if (payload.method === "elicitation/create") {
        const elicitationParams = (payload.params || {}) as Record<
          string,
          unknown
        >;
        const defaults = buildElicitationDefaults(elicitationParams);

        ({ response, payload } = await postJsonRpc<T>(
          serverUrl,
          sessionHeaders,
          {
            jsonrpc: "2.0",
            id: payload.id,
            result: {
              action: "accept",
              content: defaults,
            },
          },
        ));
      } else {
        break;
      }
    }

    if (isServerRequest(payload)) {
      throw new Error(
        `Unsupported server request: ${(payload as JsonRpcServerRequest).method}`,
      );
    }

    if (!response.ok || !payload || "error" in payload) {
      throw toError(response, payload);
    }

    return payload.result;
  };

  try {
    const result = await doRequest(session.sessionId);
    session.lastUsedAt = Date.now();
    remoteMcpSessions.set(connectionId, session);

    return result;
  } catch (err) {
    if (!(err instanceof InvalidRemoteMcpSessionError)) {
      throw err;
    }

    // Session expired or unknown on server side; refresh once and retry.
    remoteMcpSessions.delete(connectionId);
    session = await ensureRemoteMcpSession(connectionId, serverUrl, headers);
    const result = await doRequest(session.sessionId);
    session.lastUsedAt = Date.now();
    remoteMcpSessions.set(connectionId, session);

    return result;
  }
}

export function clearRemoteMcpSession(connectionId: string): void {
  if (!connectionId) {
    return;
  }

  remoteMcpSessions.delete(connectionId);
}

export function clearAllRemoteMcpSessions(): void {
  remoteMcpSessions.clear();
}

async function callRemoteMcp<T>(
  db: ShadowClawDatabase,
  connectionId: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const resolved = await resolveRemoteMcpConnectionAuth(db, connectionId);
  if (!resolved) {
    throw new Error("Remote MCP connection not found");
  }

  if (resolved.reauthRequired) {
    throw new McpReauthRequiredError(connectionId);
  }

  const { connection, authType, headers } = resolved;

  if (connection.transport !== "streamable_http") {
    throw new Error("Unsupported remote MCP transport");
  }

  try {
    return await callRemoteMcpWithSession<T>(
      connectionId,
      connection.serverUrl,
      headers,
      method,
      params,
    );
  } catch (err) {
    if (
      !(err instanceof HttpRemoteMcpError) ||
      err.status !== 401 ||
      authType !== "oauth"
    ) {
      throw err;
    }

    // 401 with OAuth — force-refresh token and retry once.
    clearRemoteMcpSession(connectionId);

    const refreshed = await resolveRemoteMcpConnectionAuth(db, connectionId, {
      forceRefresh: true,
    });

    if (!refreshed || refreshed.reauthRequired) {
      throw new McpReauthRequiredError(connectionId);
    }

    try {
      return await callRemoteMcpWithSession<T>(
        connectionId,
        refreshed.connection.serverUrl,
        refreshed.headers,
        method,
        params,
      );
    } catch (retryErr) {
      if (retryErr instanceof HttpRemoteMcpError && retryErr.status === 401) {
        throw new McpReauthRequiredError(connectionId);
      }

      throw retryErr;
    }
  }
}

export async function listRemoteMcpTools(
  db: ShadowClawDatabase,
  connectionId: string,
): Promise<Array<{ name: string; description?: string }>> {
  const result = await callRemoteMcp<ToolListResult>(
    db,
    connectionId,
    "tools/list",
  );

  return Array.isArray(result.tools) ? result.tools : [];
}

export async function callRemoteMcpTool(
  db: ShadowClawDatabase,
  connectionId: string,
  name: string,
  argumentsInput: Record<string, unknown> = {},
): Promise<ToolCallResult> {
  return callRemoteMcp<ToolCallResult>(db, connectionId, "tools/call", {
    name,
    arguments: argumentsInput,
  });
}

export interface McpConnectionTestStep {
  step: string;
  status: "ok" | "error" | "skipped";
  detail?: string;
}

export interface McpConnectionTestResult {
  success: boolean;
  error: string | null;
  toolCount: number;
  toolNames: string[];
  steps: McpConnectionTestStep[];
}

export async function testRemoteMcpConnection(
  db: ShadowClawDatabase,
  connectionId: string,
): Promise<McpConnectionTestResult> {
  const steps: McpConnectionTestStep[] = [];

  // Step 1: Resolve auth
  let resolved;
  try {
    resolved = await resolveRemoteMcpConnectionAuth(db, connectionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push({
      step: "Resolve authentication",
      status: "error",
      detail: message,
    });

    return {
      success: false,
      error: message,
      toolCount: 0,
      toolNames: [],
      steps,
    };
  }

  if (!resolved) {
    steps.push({
      step: "Resolve authentication",
      status: "error",
      detail: "Connection not found",
    });

    return {
      success: false,
      error: "Connection not found",
      toolCount: 0,
      toolNames: [],
      steps,
    };
  }

  if (resolved.reauthRequired) {
    const detail =
      "OAuth token expired or revoked — re-authenticate in Settings";
    steps.push({ step: "Resolve authentication", status: "error", detail });

    return {
      success: false,
      error: detail,
      toolCount: 0,
      toolNames: [],
      steps,
    };
  }

  steps.push({
    step: "Resolve authentication",
    status: "ok",
    detail: `Auth type: ${resolved.authType}`,
  });

  let { connection, authType, headers } = resolved;

  if (connection.transport !== "streamable_http") {
    const detail = `Unsupported transport: ${connection.transport}`;
    steps.push({ step: "Establish MCP session", status: "error", detail });

    return {
      success: false,
      error: detail,
      toolCount: 0,
      toolNames: [],
      steps,
    };
  }

  // Step 2: Establish session (clear any stale session first)
  clearRemoteMcpSession(connectionId);

  try {
    await ensureRemoteMcpSession(connectionId, connection.serverUrl, headers);
    steps.push({
      step: "Establish MCP session",
      status: "ok",
      detail: "Session established",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push({
      step: "Establish MCP session",
      status: "error",
      detail: message,
    });

    // If 401 with OAuth, try force-refreshing the token and retrying.
    if (
      err instanceof HttpRemoteMcpError &&
      err.status === 401 &&
      authType === "oauth"
    ) {
      clearRemoteMcpSession(connectionId);

      const refreshed = await resolveRemoteMcpConnectionAuth(db, connectionId, {
        forceRefresh: true,
      });

      if (refreshed && !refreshed.reauthRequired) {
        steps.push({
          step: "Refresh OAuth token",
          status: "ok",
          detail: "Token refreshed, retrying",
        });

        connection = refreshed.connection;
        headers = refreshed.headers;

        try {
          await ensureRemoteMcpSession(
            connectionId,
            connection.serverUrl,
            headers,
          );
          steps.push({
            step: "Establish MCP session",
            status: "ok",
            detail: "Session established",
          });
        } catch (retryErr) {
          const retryMessage =
            retryErr instanceof Error ? retryErr.message : String(retryErr);
          const isStill401 =
            retryErr instanceof HttpRemoteMcpError && retryErr.status === 401;
          const detail = isStill401
            ? `${retryMessage} — re-authorize in Settings → Accounts`
            : retryMessage;
          steps.push({
            step: "Establish MCP session",
            status: "error",
            detail,
          });

          return {
            success: false,
            error: detail,
            toolCount: 0,
            toolNames: [],
            steps,
          };
        }
      } else {
        steps.push({
          step: "Refresh OAuth token",
          status: "error",
          detail: "Token refresh failed — re-authenticate in Settings",
        });

        return {
          success: false,
          error: message,
          toolCount: 0,
          toolNames: [],
          steps,
        };
      }
    } else {
      return {
        success: false,
        error: message,
        toolCount: 0,
        toolNames: [],
        steps,
      };
    }
  }

  // Step 3: Discover tools
  try {
    const result = await callRemoteMcpWithSession<ToolListResult>(
      connectionId,
      connection.serverUrl,
      headers,
      "tools/list",
    );

    const tools = Array.isArray(result.tools) ? result.tools : [];
    const toolNames = tools.map((t) => t.name);
    steps.push({
      step: "Discover tools",
      status: "ok",
      detail: `${tools.length} tool${tools.length === 1 ? "" : "s"} available`,
    });

    return {
      success: true,
      error: null,
      toolCount: tools.length,
      toolNames,
      steps,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push({ step: "Discover tools", status: "error", detail: message });

    return {
      success: false,
      error: message,
      toolCount: 0,
      toolNames: [],
      steps,
    };
  }
}
