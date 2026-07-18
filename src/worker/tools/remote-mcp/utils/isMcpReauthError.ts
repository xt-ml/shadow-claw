import type { McpReauthErrorLike, RemoteMcpDeps } from "../remote-mcp.js";

export function isMcpReauthError(
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
