import { getGroupDir } from "./getGroupDir.js";
import { parsePath } from "./parsePath.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Delete a file from a group's workspace.
 */
export async function deleteGroupFile(
  db: ShadowClawDatabase,
  groupId: string,
  filePath: string,
): Promise<void> {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  await dir.removeEntry(filename);
}
