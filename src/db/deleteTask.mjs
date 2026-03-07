import { txPromise } from "../db/txPromise.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Delete a task
 *
 * @param {ShadowClawDatabase} db
 * @param {string} id
 *
 * @returns {Promise<void>}
 */
export function deleteTask(db, id) {
  return txPromise(db, "tasks", "readwrite", (store) => store.delete(id)).then(
    () => undefined,
  );
}
