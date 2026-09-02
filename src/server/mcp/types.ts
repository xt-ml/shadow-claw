/**
 * ShadowClaw — Stateless MCP Specification (2026-07-28) Protocol Types
 *
 * Defines request, response, tool, cache, and error types conforming to the
 * 2026-07-28 Model Context Protocol specification, with backward-compatibility
 * primitives for 2025-11-25 and 2024-11-05 clients.
 */

export const MCP_PROTOCOL_VERSION_2026_07_28 = "2026-07-28";
export const MCP_PROTOCOL_VERSION_2025_11_25 = "2025-11-25";
export const MCP_PROTOCOL_VERSION_2024_11_05 = "2024-11-05";

export const SUPPORTED_PROTOCOL_VERSIONS = [
  MCP_PROTOCOL_VERSION_2026_07_28,
  MCP_PROTOCOL_VERSION_2025_11_25,
  MCP_PROTOCOL_VERSION_2024_11_05,
] as const;

export type SupportedProtocolVersion =
  (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];

// Standard JSON-RPC and MCP error codes
export const MCP_ERROR_CODES = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  // 2026-07-28 allocated server-error range (-32020 to -32099)
  HeaderMismatch: -32020,
  MissingRequiredClientCapability: -32021,
  UnsupportedProtocolVersion: -32022,
} as const;

// ---------------------------------------------------------------------------
// Standard Request & Response Envelopes
// ---------------------------------------------------------------------------

export interface McpClientInfo {
  name: string;
  version: string;
  [key: string]: unknown;
}

export interface McpServerInfo {
  name: string;
  version: string;
  [key: string]: unknown;
}

export interface McpClientCapabilities {
  tools?: {
    listChanged?: boolean;
    [key: string]: unknown;
  };
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface McpServerCapabilities {
  tools?: {
    listChanged?: boolean;
    [key: string]: unknown;
  };
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface McpMeta {
  "io.modelcontextprotocol/protocolVersion"?: string;
  "io.modelcontextprotocol/clientInfo"?: McpClientInfo;
  "io.modelcontextprotocol/clientCapabilities"?: McpClientCapabilities;
  "io.modelcontextprotocol/serverInfo"?: McpServerInfo;
  "io.modelcontextprotocol/logLevel"?: string;
  "io.modelcontextprotocol/subscriptionId"?: string;
  [key: string]: unknown;
}

export interface JsonRpcRequest<T = any> {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: T;
}

export interface JsonRpcSuccess<T = any> {
  jsonrpc: "2.0";
  id: string | number | null;
  result: T;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<T = any> = JsonRpcSuccess<T> | JsonRpcError;

// ---------------------------------------------------------------------------
// Cacheable Results (SEP-2549)
// ---------------------------------------------------------------------------

export interface CacheableResult {
  ttlMs?: number;
  cacheScope?: "public" | "private";
}

// ---------------------------------------------------------------------------
// Discovery RPC (server/discover)
// ---------------------------------------------------------------------------

export interface ServerDiscoverResult {
  protocolVersion: string;
  supportedProtocolVersions: string[];
  capabilities: McpServerCapabilities;
  serverInfo: McpServerInfo;
  _meta?: McpMeta;
}

// ---------------------------------------------------------------------------
// Tools RPCs
// ---------------------------------------------------------------------------

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface McpToolsListResult extends CacheableResult {
  resultType: "complete";
  tools: McpTool[];
  _meta?: McpMeta;
}

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
  _meta?: McpMeta;
  inputResponses?: Record<string, unknown>;
}

export interface McpToolContentItem {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  [key: string]: unknown;
}

export interface McpToolCompleteResult {
  resultType: "complete";
  content: McpToolContentItem[];
  isError?: boolean;
  _meta?: McpMeta;
}

// ---------------------------------------------------------------------------
// Multi Round-Trip Requests (MRTR) (SEP-2322)
// ---------------------------------------------------------------------------

export interface McpInputRequest {
  id: string;
  type: string;
  message?: string;
  requestedSchema?: Record<string, unknown>;
}

export interface McpInputRequiredResult {
  resultType: "input_required";
  inputRequests: McpInputRequest[];
  requestState?: string;
  _meta?: McpMeta;
}

export type McpToolCallResult = McpToolCompleteResult | McpInputRequiredResult;

// ---------------------------------------------------------------------------
// Tasks Extension (io.modelcontextprotocol/tasks) (SEP-2663)
// ---------------------------------------------------------------------------

export interface McpTaskStatus {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  result?: unknown;
  error?: string;
  progress?: number;
  message?: string;
}

export interface McpTasksGetResult {
  resultType: "complete";
  task: McpTaskStatus;
  _meta?: McpMeta;
}

export interface McpTasksUpdateResult {
  resultType: "complete";
  task: McpTaskStatus;
  _meta?: McpMeta;
}

// ---------------------------------------------------------------------------
// Standard HTTP Request Headers
// ---------------------------------------------------------------------------

export interface McpHttpHeaders {
  "mcp-protocol-version"?: string;
  "mcp-method"?: string;
  "mcp-name"?: string;
  [header: string]: string | undefined;
}
