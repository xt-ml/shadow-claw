import { txPromise } from "../db/txPromise.mjs";

/**
 * @typedef {import("../types.mjs").Task} Task
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Get all tasks
 *
 * @param {ShadowClawDatabase} db
 *
 * @returns {Promise<Task[]>}
 */
export function getAllTasks(db) {
  return txPromise(db, "tasks", "readonly", (store) => store.getAll()).then(
    (tasks) => tasks.map((t) => ({ ...t, enabled: !!t.enabled })),
  );
}
