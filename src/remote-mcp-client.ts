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
    return new Error(
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
        capabilities: {},
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

    const { response, payload } = await postJsonRpc<T>(
      serverUrl,
      {
        ...headers,
        "mcp-session-id": activeSessionId,
      },
      body,
    );

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
    throw new Error("OAuth reconnect required for remote MCP connection");
  }

  const { connection, headers } = resolved;

  if (connection.transport !== "streamable_http") {
    throw new Error("Unsupported remote MCP transport");
  }

  return callRemoteMcpWithSession<T>(
    connectionId,
    connection.serverUrl,
    headers,
    method,
    params,
  );
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
