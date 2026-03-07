/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { getNestedDir } from "./getNestedDir.mjs";
import { getStorageRoot } from "./storage.mjs";

/**
 * Get the group workspace directory.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 *
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function getGroupDir(db, groupId) {
  const root = await getStorageRoot(db);
  // Sanitize groupId for filesystem: replace colons with dashes
  const safeId = groupId.replace(/:/g, "-");

  return getNestedDir(root, "groups", safeId);
}
