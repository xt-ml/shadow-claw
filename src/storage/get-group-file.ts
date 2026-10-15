import { getGroupDir } from "./get-group-dir.js";
import { parsePath } from "./parse-path.js";
import type { ShadowClawDatabase } from "../db/types.js";

/**
 * Get a native File object from a file in a group's workspace.
 */
export async function getGroupFile(
  db: ShadowClawDatabase,
  groupId: string,
  filePath: string,
): Promise<File> {
  const groupDir = await getGroupDir(db, groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  const fileHandle = await dir.getFileHandle(filename);

  return await fileHandle.getFile();
}
