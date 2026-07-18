import { ShadowClawDatabase } from "../../../db/types.js";
import { groupFileExists } from "../../../storage/groupFileExists.js";
import { hasPathTraversal } from "./utils/hasPathTraversal.js";
import { normalizeWorkspacePath } from "./utils/normalizeWorkspacePath.js";

import { post } from "../../post.js";

export async function executeSendFile(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  if (!input.path || typeof input.path !== "string") {
    return "Error: send_file requires a valid path string.";
  }

  if (!groupId.startsWith("peer:")) {
    return "Error: send_file only works in peer conversations (groupId must start with 'peer:'). The current conversation is not a peer session.";
  }

  const sfPath = normalizeWorkspacePath(input.path);
  if (!sfPath) {
    return "Error: send_file received an empty file path.";
  }

  if (hasPathTraversal(sfPath)) {
    return "Error: send_file path cannot contain '..' segments.";
  }

  const sfExists = await groupFileExists(db, groupId, sfPath);
  if (!sfExists) {
    return `Error: send_file could not find ${sfPath} in the workspace.`;
  }

  post({
    payload: { groupId, path: sfPath },
    type: "send-file",
  });

  return `Sending file to peer: ${sfPath}. The transfer will proceed in the background — you can continue chatting.`;
}
