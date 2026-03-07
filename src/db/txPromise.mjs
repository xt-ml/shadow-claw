import { getDb } from "./db.mjs";

/**
 * @typedef {import("./db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Execute a transaction and return result
 *
 * @template T
 *
 * @param {ShadowClawDatabase} db
 * @param {string} storeName
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest<T>} fn
 *
 * @returns {Promise<T>}
 */
export function txPromise(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db?.transaction(storeName, mode);
    if (!tx) {
      throw new Error("failed to get transaction, cannot update task.");
    }

    const store = tx.objectStore(storeName);
    const request = fn(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Execute multiple requests in a transaction
 *
 * @template T
 *
 * @param {string} storeName
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest<T>[]} fn
 *
 * @returns {Promise<T[]>}
 */
export function txPromiseAll(storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = getDb()?.transaction(storeName, mode);

    if (!tx) {
      throw new Error("failed to get transaction, cannot update task.");
    }

    const store = tx.objectStore(storeName);
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
  });
}
