/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Get the workspace subdirectory for a group.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 *
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function getWorkspaceDir(db, groupId) {
  const groupDir = await getGroupDir(db, groupId);

  return groupDir.getDirectoryHandle("workspace", { create: true });
}
