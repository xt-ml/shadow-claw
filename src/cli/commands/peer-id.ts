/**
 * ShadowClaw CLI — `peer-id` command
 * Manages the WebRTC CLI peer ID stored in .cache/cli-peer-id.
 */

import {
  getCliPeerIdFilePath,
  getOrCreateCliPeerId,
  readCliPeerId,
  renewCliPeerId,
} from "../utils/webrtc-control-client.js";

export interface RunPeerIdCommandOptions {
  cacheDir?: string;
  renew?: boolean;
  set?: string;
  id?: string;
  quiet?: boolean;
  json?: boolean;
  [key: string]: any;
}

export interface RunPeerIdCommandResult {
  peerId: string;
  filePath: string;
  isRenewed: boolean;
}

export async function runPeerIdCommand(
  action = "get",
  options: RunPeerIdCommandOptions = {},
): Promise<RunPeerIdCommandResult> {
  const cacheDir = options.cacheDir;
  const filePath = getCliPeerIdFilePath(cacheDir);

  const shouldRenew = Boolean(
    options.renew ||
    action === "renew" ||
    action === "generate" ||
    action === "new",
  );
  const customSetId =
    options.set || (action === "set" && options.id ? options.id : null);

  let peerId = "";
  let isRenewed = false;

  if (customSetId) {
    peerId = renewCliPeerId(customSetId, cacheDir);
    isRenewed = true;
  } else if (shouldRenew) {
    peerId = renewCliPeerId(undefined, cacheDir);
    isRenewed = true;
  } else {
    const existing = readCliPeerId(cacheDir);
    if (existing) {
      peerId = existing;
      isRenewed = false;
    } else {
      peerId = getOrCreateCliPeerId(undefined, cacheDir);
      isRenewed = true;
    }
  }

  if (options.quiet) {
    console.log(peerId);
    return { peerId, filePath, isRenewed };
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          peerId,
          filePath,
          renewed: isRenewed,
        },
        null,
        2,
      ),
    );
    return { peerId, filePath, isRenewed };
  }

  if (customSetId) {
    console.log(`WebRTC CLI Peer ID set to: ${peerId}`);
  } else if (isRenewed) {
    console.log(`WebRTC CLI Peer ID created/renewed: ${peerId}`);
  } else {
    console.log(`WebRTC CLI Peer ID: ${peerId}`);
  }
  console.log(`Stored in: ${filePath}`);

  return { peerId, filePath, isRenewed };
}
