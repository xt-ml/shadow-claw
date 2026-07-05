import { getNestedDir } from "./getNestedDir.js";
import { getStorageRoot } from "./storage.js";
import type { ShadowClawDatabase } from "../db/types.js";

/**
 * Get the group workspace directory.
 */
export async function getGroupDir(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<FileSystemDirectoryHandle> {
  const root = await getStorageRoot(db);
  // Sanitize groupId for filesystem: replace colons with dashes
  const safeId = groupId.replace(/:/g, "-");

  return getNestedDir(root, "groups", safeId);
}
