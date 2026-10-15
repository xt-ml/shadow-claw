import { getDb } from "./db.js";
import { isSqliteDatabase } from "./sqlite/types.js";
import type { ShadowClawDatabase, Task } from "./types.js";

/**
 * Get all enabled tasks.
 *
 * Accepts an optional `db` parameter for headless/SQLite usage. When omitted,
 * falls back to the singleton `getDb()` (browser IDB path).
 */
export function getEnabledTasks(db?: ShadowClawDatabase): Promise<Task[]> {
  // SQLite fast path
  if (db && isSqliteDatabase(db)) {
    return Promise.resolve().then(() => {
      const rows = (db.db
        .prepare("SELECT * FROM tasks WHERE enabled = 1")
        .all() ?? []) as any[];
      return rows.map((r) => ({
        ...r,
        enabled: true,
        tools: r.tools ? JSON.parse(r.tools) : undefined,
      }));
    });
  }

  return new Promise(async (resolve, reject) => {
    try {
      const tx: ShadowClawDatabase = db ?? (await getDb());

      if (!tx) {
        return reject(
          new Error("failed to get transaction, cannot get enabled tasks."),
        );
      }

      const transactionStore = (tx as IDBDatabase).transaction(
        "tasks",
        "readonly",
      );
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
