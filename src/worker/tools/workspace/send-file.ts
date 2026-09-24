import { ShadowClawDatabase } from "../../../db/types.js";
import { groupFileExists } from "../../../storage/groupFileExists.js";
import { hasPathTraversal } from "../../../utils/hasPathTraversal.js";
import { normalizeWorkspacePath } from "../../../utils/normalizeWorkspacePath.js";

import { post } from "../../utils/post.js";

export async function executeSendFile(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  if (!input.path || typeof input.path !== "string") {
    return "Error: send_file requires a valid path string.";
  }

  const explicitPeerId =
    input.peer_id && typeof input.peer_id === "string" && input.peer_id.trim()
      ? input.peer_id.trim()
      : "";
  const targetGroupId = explicitPeerId
    ? explicitPeerId.startsWith("peer:")
      ? explicitPeerId
      : `peer:${explicitPeerId}`
    : groupId;

  const isPeer = targetGroupId.startsWith("peer:");
  const isRoom = targetGroupId.startsWith("room:");
  if (!isPeer && !isRoom) {
    return "Error: send_file only works in peer or room conversations (groupId must start with 'peer:' or 'room:') or when peer_id is specified.";
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
    payload: { groupId: targetGroupId, path: sfPath },
    type: "send-file",
  });

  const targetLabel = isRoom ? "room" : "peer";
  return `Sending file to ${targetLabel}: ${sfPath}. The transfer will proceed in the background — you can continue chatting.`;
}
