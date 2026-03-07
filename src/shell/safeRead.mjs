import { readGroupFile } from "../storage/readGroupFile.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Helper to safely read a file
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {string} path
 *
 * @returns {Promise<string|null>}
 */
export async function safeRead(db, groupId, path) {
  try {
    return await readGroupFile(db, groupId, path);
  } catch {
    return null;
  }
}
