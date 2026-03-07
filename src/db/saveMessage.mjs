import { txPromise } from "../db/txPromise.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 * @typedef {import("../types.mjs").StoredMessage} StoredMessage
 */

/**
 * Save a message to the database
 *
 * @param {ShadowClawDatabase} db
 * @param {StoredMessage} msg
 *
 * @returns {Promise<void>}
 */
export function saveMessage(db, msg) {
  return txPromise(db, "messages", "readwrite", (store) => store.put(msg)).then(
    () => undefined,
  );
}
