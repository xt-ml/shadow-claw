import { txPromise } from "../db/txPromise.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Delete a config value
 *
 * @param {ShadowClawDatabase} db
 * @param {string} key
 *
 * @returns {Promise<void>}
 */
export function deleteConfig(db, key) {
  return txPromise(db, "config", "readwrite", (store) =>
    store.delete(key),
  ).then(() => undefined);
}
