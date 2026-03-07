import { txPromise } from "../db/txPromise.mjs";

/**
 * @typedef {import("../types.mjs").Task} Task
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Save a task to the database
 *
 * @param {ShadowClawDatabase} db
 * @param {Task} task
 *
 * @returns {Promise<void>}
 */
export function saveTask(db, task) {
  // Store `enabled` as 0/1 so the IndexedDB 'by-enabled' index works
  const record = { ...task, enabled: task.enabled ? 1 : 0 };
  return txPromise(db, "tasks", "readwrite", (store) => store.put(record)).then(
    () => undefined,
  );
}
