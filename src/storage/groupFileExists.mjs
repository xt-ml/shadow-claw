/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

import { readGroupFile } from "./readGroupFile.mjs";

/**
 * Check if a file exists in a group's workspace.
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} filePath
 *
 * @returns {Promise<boolean>}
 */
export async function groupFileExists(db, groupId, filePath) {
  try {
    await readGroupFile(db, groupId, filePath);

    return true;
  } catch {
    return false;
  }
}
