/**
 * iframe-storage-proxy.ts
 *
 * Parent-side storage implementation for the iframe storage bridge.
 * Provides a namespaced IndexedDB key-value store that the parent frame
 * uses to proxy storage operations on behalf of sandboxed iframes that
 * lack direct storage access due to opaque-origin isolation.
 *
 * Each page gets its own namespace to prevent cross-page data leakage.
 */

const DB_NAME = "shadow-claw-iframe-storage";
const DB_VERSION = 1;
const STORE_NAME = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Build a composite key from a namespace and item key.
 */
function compositeKey(namespace: string, key: string): string {
  return `${namespace}\0${key}`;
}

/**
 * Set a value in the namespaced store.
 */
export async function iframeStorageSet(
  namespace: string,
  key: string,
  value: unknown,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, compositeKey(namespace, key));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a single value from the namespaced store.
 */
export async function iframeStorageGet(
  namespace: string,
  key: string,
): Promise<unknown> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(compositeKey(namespace, key));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all values for a namespace as a key-value object.
 */
export async function iframeStorageGetAll(
  namespace: string,
): Promise<Record<string, unknown>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const result: Record<string, unknown> = {};
    const prefix = `${namespace}\0`;
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve(result);
        return;
      }
      const cursorKey =
        typeof cursor.key === "string" ? cursor.key : String(cursor.key);
      if (cursorKey.startsWith(prefix)) {
        result[cursorKey.slice(prefix.length)] = cursor.value;
      }
      cursor.continue();
    };

    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

/**
 * Delete a single value from the namespaced store.
 */
export async function iframeStorageDelete(
  namespace: string,
  key: string,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(compositeKey(namespace, key));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clear all values for a namespace.
 */
export async function iframeStorageClear(namespace: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const prefix = `${namespace}\0`;
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve();
        return;
      }
      const cursorKey =
        typeof cursor.key === "string" ? cursor.key : String(cursor.key);
      if (cursorKey.startsWith(prefix)) {
        cursor.delete();
      }
      cursor.continue();
    };

    cursorReq.onerror = () => reject(cursorReq.error);
  });
}
