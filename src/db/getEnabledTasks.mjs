import { getDb } from "./db.mjs";

/** @typedef {import("../types.mjs").Task} Task */

/**
 * Get all enabled tasks
 *
 * @returns {Promise<Task[]>}
 */
export function getEnabledTasks() {
  return new Promise((resolve, reject) => {
    const tx = getDb()?.transaction("tasks", "readonly");

    if (!tx) {
      throw new Error("failed to get transaction, cannot update task.");
    }

    const store = tx.objectStore("tasks");
    const index = store.index("by-enabled");
    const request = index.getAll(1); // enabled = true (stored as 1)
    request.onsuccess = () => {
      // Convert numeric `enabled` back to boolean
      const tasks = request.result.map((t) => ({ ...t, enabled: true }));

      resolve(tasks);
    };

    request.onerror = () => reject(request.error);
  });
}
