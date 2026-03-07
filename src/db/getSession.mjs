import { txPromise } from "../db/txPromise.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 * @typedef {import("../types.mjs").Session} Session
 */

/**
 * Get session for a group
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 *
 * @returns {Promise<Session|undefined>}
 */
export function getSession(db, groupId) {
  return txPromise(db, "sessions", "readonly", (store) => store.get(groupId));
}
