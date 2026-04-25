import { getDb, ShadowClawDatabase } from "./db.js";

/**
 * Update task last run timestamp
 */
export function updateTaskLastRun(
  id: string,
  timestamp: number,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const tx: ShadowClawDatabase = await getDb();

      if (!tx) {
        return reject(
          new Error("failed to get transaction, cannot update task last run."),
        );
      }

      const transactionStore = tx.transaction("tasks", "readwrite");
      if (!transactionStore) {
        return reject(new Error("failed to get transaction"));
      }

      const store = transactionStore.objectStore("tasks");
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
    } catch (err) {
      reject(err);
    }
  });
}
