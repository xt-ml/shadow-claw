import { getDb } from "./db.mjs";

/**
 * Update task last run timestamp
 *
 * @param {string} id
 * @param {number} timestamp
 *
 * @returns {Promise<void>}
 */
export function updateTaskLastRun(id, timestamp) {
  return new Promise((resolve, reject) => {
    const tx = getDb()?.transaction("tasks", "readwrite");
    if (!tx) {
      throw new Error("failed to get transaction, cannot update task.");
    }

    const store = tx.objectStore("tasks");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const task = getReq.result;
      if (!task) {
        resolve();

        return;
      }

      task.lastRun = timestamp;
      const putReq = store.put(task);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}
