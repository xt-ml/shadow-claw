import { pendingReauthRequests, reauthTimeoutHandles } from "../remote-mcp.js";

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
