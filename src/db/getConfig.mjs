import { txPromise } from "../db/txPromise.mjs";

/**
 * @typedef {import("./db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Get a config value
 *
 * @param {ShadowClawDatabase} db
 * @param {string} key
 *
 * @returns {Promise<string|undefined>}
 */
export function getConfig(db, key) {
  return txPromise(db, "config", "readonly", (store) => store.get(key)).then(
    (entry) => entry?.value,
  );
}
