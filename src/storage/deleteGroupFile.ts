import { getGroupDir } from "./getGroupDir.js";
import { parsePath } from "./parsePath.js";
import { setMainGroupMemorySuppressed } from "./ensureMainGroupMemory.js";
import { setMainGroupIndexSuppressed } from "./ensureMainGroupIndex.js";
import { DEFAULT_GROUP_ID } from "../config.js";
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

  if (groupId === DEFAULT_GROUP_ID && dirs.length === 0) {
    if (filename === "MEMORY.md") {
      await setMainGroupMemorySuppressed(db, true);
    } else if (filename === "index.html") {
      await setMainGroupIndexSuppressed(db, true);
    }
  }
}
