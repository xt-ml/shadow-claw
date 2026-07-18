import {
  inflightReauthPromises,
  pendingReauthRequests,
  REAUTH_TIMEOUT_MS,
  reauthTimeoutHandles,
} from "../remote-mcp.js";

import type { RemoteMcpDeps } from "../remote-mcp.js";

export async function requestMcpReauthAndWait(
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
