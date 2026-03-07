import { txPromise } from "../db/txPromise.mjs";

/** @typedef {import("../types.mjs").Task} Task */

/**
 * Get a task by ID
 *
 * @param {string} id
 *
 * @returns {Promise<Task|undefined>}
 */
export function getTask(id) {
  return txPromise("tasks", "readonly", (store) => store.get(id)).then((t) =>
    t ? { ...t, enabled: !!t.enabled } : undefined,
  );
}
