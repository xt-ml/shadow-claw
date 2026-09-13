import { isHeadlessMode } from "../config/headless.js";
import { getNestedDir } from "./getNestedDir.js";
import { getStorageRoot } from "./storage.js";
import type { ShadowClawDatabase } from "../db/types.js";

/**
 * Get the group workspace directory.
 * In headless mode, the storage root is the workspace directory directly.
 */
export async function getGroupDir(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<FileSystemDirectoryHandle> {
  const root = await getStorageRoot(db);
  if (isHeadlessMode()) {
    return root;
  }
  // Sanitize groupId for filesystem: replace colons with dashes
  const safeId = groupId.replace(/:/g, "-");

  return getNestedDir(root, "groups", safeId);
}
