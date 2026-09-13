import { getDb } from "./db.js";
import { isSqliteDatabase } from "./sqlite/types.js";
import type { ShadowClawDatabase } from "./types.js";

/**
 * Update task last run timestamp.
 *
 * Accepts an optional `db` parameter for headless/SQLite usage. When omitted,
 * falls back to the singleton `getDb()` (browser IDB path).
 */
export function updateTaskLastRun(
  dbOrId: ShadowClawDatabase | string,
  idOrTimestamp: string | number,
  maybeTimestamp?: number,
): Promise<void> {
  let db: ShadowClawDatabase | null = null;
  let id: string;
  let timestamp: number;

  if (typeof dbOrId === "string") {
    id = dbOrId;
    timestamp = idOrTimestamp as number;
  } else {
    db = dbOrId;
    id = idOrTimestamp as string;
    timestamp = maybeTimestamp!;
  }

  // SQLite fast path
  if (db && isSqliteDatabase(db)) {
    return Promise.resolve().then(() => {
      db!.db
        .prepare("UPDATE tasks SET lastRun = ? WHERE id = ?")
        .run(timestamp, id);
    });
  }

  return new Promise(async (resolve, reject) => {
    try {
      const tx: ShadowClawDatabase = db ?? (await getDb());

      if (!tx) {
        return reject(
          new Error("failed to get transaction, cannot update task last run."),
        );
      }

      const transactionStore = (tx as IDBDatabase).transaction(
        "tasks",
        "readwrite",
      );
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
