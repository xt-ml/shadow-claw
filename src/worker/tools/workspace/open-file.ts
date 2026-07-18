import { ShadowClawDatabase } from "../../../db/types.js";
import { groupFileExists } from "../../../storage/groupFileExists.js";

import { post } from "../../post.js";

export async function executeOpenFile(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  if (!input.path || typeof input.path !== "string") {
    return "Error: open_file requires a valid path string.";
  }

  const exists = await groupFileExists(db, groupId, input.path);
  if (!exists) {
    return `Error: file not found: ${input.path}`;
  }

  post({
    type: "open-file",
    payload: { groupId, path: input.path },
  });

  return `Opening file in viewer: ${input.path}`;
}
