import { txPromise } from "../db/txPromise.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Set a config value
 *
 * @param {ShadowClawDatabase} db
 * @param {string} key
 * @param {string} value
 *
 * @returns {Promise<void>}
 */
export function setConfig(db, key, value) {
  return txPromise(db, "config", "readwrite", (store) =>
    store.put({ key, value }),
  ).then(() => undefined);
}
