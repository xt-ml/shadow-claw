import { txPromise } from "../db/txPromise.mjs";

/**
 * @typedef {import ("../types.mjs").Session} Session
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Save a session
 *
 * @param {ShadowClawDatabase} db
 * @param {import('../types.mjs').Session} session
 *
 * @returns {Promise<void>}
 */
export function saveSession(db, session) {
  return txPromise(db, "sessions", "readwrite", (store) =>
    store.put(session),
  ).then(() => undefined);
}
