import { getDb } from "./db.js";
import type { ShadowClawDatabase, Task } from "../types.js";

/**
 * Get all enabled tasks
 */
export function getEnabledTasks(): Promise<Task[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const tx: ShadowClawDatabase = await getDb();

      if (!tx) {
        return reject(
          new Error("failed to get transaction, cannot get enabled tasks."),
        );
      }

      const transactionStore = tx.transaction("tasks", "readonly");
      if (!transactionStore) {
        return reject(new Error("failed to get transaction"));
      }

      const store = transactionStore.objectStore("tasks");
      const index = store.index("by-enabled");
      const request = index.getAll(1); // enabled = true (stored as 1)

      request.onsuccess = () => {
        // Convert numeric `enabled` back to boolean
        const tasks: Task[] = (request.result as any[]).map((t) => ({
          ...t,
          enabled: true,
        }));

        resolve(tasks);
      };

      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}
