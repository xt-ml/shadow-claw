import type { ShadowClawDatabase } from "../../types.js";

interface McpReauthErrorLike {
  name?: string;
}

interface RemoteMcpTool {
  name: string;
  description?: string;
}

interface RemoteMcpDeps {
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
const pendingReauthRequests = new Map<string, (success: boolean) => void>();

/**
 * In-flight reauth promises keyed by connectionId. When multiple tool calls
 * fail for the same connection, they share one promise instead of posting
 * duplicate reauth requests.
 */
const inflightReauthPromises = new Map<string, Promise<boolean>>();
/** Timeout handles keyed by connectionId. */
const reauthTimeoutHandles = new Map<string, ReturnType<typeof setTimeout>>();

/** Timeout for waiting on main-thread OAuth reauth (90 seconds). */
const REAUTH_TIMEOUT_MS = 90_000;

export function resolveMcpReauth(connectionId: string, success: boolean): void {
  const timeoutHandle = reauthTimeoutHandles.get(connectionId);
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    reauthTimeoutHandles.delete(connectionId);
  }

  const resolve = pendingReauthRequests.get(connectionId);
  if (resolve) {
    resolve(success);
    pendingReauthRequests.delete(connectionId);
  }
}

async function requestMcpReauthAndWait(
  connectionId: string,
  groupId: string,
  postMessage: RemoteMcpDeps["post"],
): Promise<boolean> {
  const existing = inflightReauthPromises.get(connectionId);
  if (existing) {
    return existing;
  }

  const promise = new Promise<boolean>((resolve) => {
    pendingReauthRequests.set(connectionId, resolve);

    const handle = setTimeout(() => {
      reauthTimeoutHandles.delete(connectionId);
      if (pendingReauthRequests.has(connectionId)) {
        pendingReauthRequests.delete(connectionId);
        resolve(false);
      }
    }, REAUTH_TIMEOUT_MS);
    reauthTimeoutHandles.set(connectionId, handle);
  }).finally(() => {
    inflightReauthPromises.delete(connectionId);
    reauthTimeoutHandles.delete(connectionId);
  });

  inflightReauthPromises.set(connectionId, promise);

  postMessage({
    type: "mcp-reauth-required",
    payload: { connectionId, groupId },
  });

  return promise;
}

function formatListToolsOutput(
  connectionId: string,
  tools: RemoteMcpTool[],
): string {
  if (!tools.length) {
    return `No tools exposed by remote MCP connection ${connectionId}.`;
  }

  return tools
    .map(
      (tool) =>
        `- ${tool.name}${tool.description ? `: ${tool.description}` : ""}`,
    )
    .join("\n");
}

function isMcpReauthError(
  err: unknown,
  ReauthErrorCtor: RemoteMcpDeps["McpReauthRequiredError"],
): err is Error {
  if (err instanceof ReauthErrorCtor) {
    return true;
  }

  return (
    !!err &&
    typeof err === "object" &&
    (err as McpReauthErrorLike).name === "McpReauthRequiredError"
  );
}

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
