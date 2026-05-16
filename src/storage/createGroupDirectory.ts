import { getGroupDir } from "./getGroupDir.js";
import { invalidateStorageRoot, isStaleHandleError } from "./storage.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Create a directory (and any missing parent directories) in a group's workspace.
 */
export async function createGroupDirectory(
  db: ShadowClawDatabase,
  groupId: string,
  dirPath: string,
): Promise<void> {
  const normalized = dirPath
    .replace(/\\/g, "/")
    .replace(/^\/home\/user\//, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Empty directory path");
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let dir = await getGroupDir(db, groupId);
      for (const segment of parts) {
        dir = await dir.getDirectoryHandle(segment, { create: true });
      }

      return;
    } catch (err) {
      if (attempt === 0 && isStaleHandleError(err)) {
        invalidateStorageRoot();

        continue;
      }

      throw err;
    }
  }
}
