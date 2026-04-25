import { getGroupDir } from "./getGroupDir.js";
import { parsePath } from "./parsePath.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Delete a directory recursively from a group's workspace.
 */
export async function deleteGroupDirectory(
  db: ShadowClawDatabase,
  groupId: string,
  dirPath: string,
): Promise<void> {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename: dirName } = parsePath(dirPath.replace(/\/$/, ""));

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  // recursive: true makes it delete non-empty directories
  await dir.removeEntry(dirName, { recursive: true });
}
