import { formatListToolsOutput } from "./utils/formatListToolsOutput.js";
import { isMcpReauthError } from "./utils/isMcpReauthError.js";
import { requestMcpReauthAndWait } from "./utils/requestMcpReauthAndWait.js";

import type { ShadowClawDatabase } from "../../../db/types.js";

export interface RemoteMcpTool {
  name: string;
  description?: string;
}

export interface McpReauthErrorLike {
  name?: string;
}

export interface RemoteMcpDeps {
  listRemoteMcpTools: (
    db: ShadowClawDatabase,
    connectionId: string,
  ) => Promise<RemoteMcpTool[]>;
  callRemoteMcpTool: (
    db: ShadowClawDatabase,
    connectionId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  McpReauthRequiredError: new (...args: any[]) => Error;
  post: (message: {
    type: "mcp-reauth-required";
    payload: { connectionId: string; groupId: string };
  }) => void;
}

/** Pending MCP OAuth reauth requests awaiting main-thread result. */
export const pendingReauthRequests = new Map<
  string,
  (success: boolean) => void
>();

/**
 * In-flight reauth promises keyed by connectionId. When multiple tool calls
 * fail for the same connection, they share one promise instead of posting
 * duplicate reauth requests.
 */
export const inflightReauthPromises = new Map<string, Promise<boolean>>();
/** Timeout handles keyed by connectionId. */
export const reauthTimeoutHandles = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

/** Timeout for waiting on main-thread OAuth reauth (90 seconds). */
export const REAUTH_TIMEOUT_MS = 90_000;

export async function executeRemoteMcpListTools(
  db: ShadowClawDatabase,
  input: Record<string, unknown>,
  groupId: string,
  deps: RemoteMcpDeps,
): Promise<string> {
  if (!input.connection_id || typeof input.connection_id !== "string") {
    return "Error: remote_mcp_list_tools requires connection_id.";
  }

  try {
    const tools = await deps.listRemoteMcpTools(db, input.connection_id);

    return formatListToolsOutput(input.connection_id, tools);
  } catch (err) {
    if (isMcpReauthError(err, deps.McpReauthRequiredError)) {
      const reconnected = await requestMcpReauthAndWait(
        input.connection_id,
        groupId,
        deps.post,
      );

      if (reconnected) {
        const tools = await deps.listRemoteMcpTools(db, input.connection_id);

        return formatListToolsOutput(input.connection_id, tools);
      }
    }

    throw err;
  }
}

export async function executeRemoteMcpCallTool(
  db: ShadowClawDatabase,
  input: Record<string, unknown>,
  groupId: string,
  deps: RemoteMcpDeps,
): Promise<string> {
  if (!input.connection_id || typeof input.connection_id !== "string") {
    return "Error: remote_mcp_call_tool requires connection_id.";
  }

  if (!input.tool_name || typeof input.tool_name !== "string") {
    return "Error: remote_mcp_call_tool requires tool_name.";
  }

  const args =
    input.arguments && typeof input.arguments === "object"
      ? (input.arguments as Record<string, unknown>)
      : {};

  try {
    const result = await deps.callRemoteMcpTool(
      db,
      input.connection_id,
      input.tool_name,
      args,
    );

    return JSON.stringify(result, null, 2);
  } catch (err) {
    if (isMcpReauthError(err, deps.McpReauthRequiredError)) {
      const reconnected = await requestMcpReauthAndWait(
        input.connection_id,
        groupId,
        deps.post,
      );

      if (reconnected) {
        const result = await deps.callRemoteMcpTool(
          db,
          input.connection_id,
          input.tool_name,
          args,
        );

        return JSON.stringify(result, null, 2);
      }
    }

    throw err;
  }
}
