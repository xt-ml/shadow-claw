import { getDb } from "./db.js";
import type { ShadowClawDatabase } from "../types.js";

/**
 * Execute a transaction and return result
 */
export function txPromise<T>(
  db: ShadowClawDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  if (!db) {
    return Promise.reject(
      new Error("failed to get database, cannot update task."),
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const transactionStore = db.transaction(storeName, mode);
      if (!transactionStore) {
        return reject(new Error("failed to get transaction"));
      }

      const store = transactionStore.objectStore(storeName);
      const request = fn(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Execute multiple requests in a transaction
 */
export function txPromiseAll<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>[],
): Promise<T[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const tx: ShadowClawDatabase = await getDb();

      if (!tx) {
        return reject(
          new Error("failed to get transaction, cannot update task."),
        );
      }

      const transactionStore = tx.transaction(storeName, mode);
      if (!transactionStore) {
        return reject(new Error("failed to get transaction"));
      }

      const store = transactionStore.objectStore(storeName);
      const requests = fn(store);
      const results = new Array(requests.length);

      let completed = 0;
      for (let i = 0; i < requests.length; i++) {
        requests[i].onsuccess = () => {
          results[i] = requests[i].result;

          if (++completed === requests.length) {
            resolve(results);
          }
        };

        requests[i].onerror = () => reject(requests[i].error);
      }

      if (requests.length === 0) {
        resolve([]);
      }
    } catch (err) {
      reject(err);
    }
  });
}
