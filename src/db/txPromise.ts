import { getDb } from "./db.js";
import type { ShadowClawDatabase } from "./types.js";
import { isSqliteDatabase } from "./sqlite/types.js";
import type { ShadowClawSqliteDatabase } from "./sqlite/types.js";

/**
 * Execute a SQLite operation that mirrors an IDB object store method.
 *
 * We intercept the IDBObjectStore calls by proxying them through a minimal
 * fake store object that translates to SQL. The `fn` callback receives the
 * fake store and returns a value which we resolve immediately (all SQLite ops
 * are synchronous via DatabaseSync).
 */
/**
 * Build a minimal fake IDBObjectStore proxy that dispatches to SQL.
 */
function buildSqliteFakeStore<T>(raw: any, storeName: string): any {
  return {
    // store.get(key) → SELECT
    get(key: any) {
      let result: any;
      if (storeName === "config") {
        result =
          raw.prepare("SELECT key, value FROM config WHERE key = ?").get(key) ??
          undefined;
      } else if (storeName === "tasks") {
        const row = raw
          .prepare("SELECT * FROM tasks WHERE id = ?")
          .get(key) as any;
        if (row) {
          result = {
            ...row,
            enabled: !!row.enabled,
            tools: row.tools ? JSON.parse(row.tools) : undefined,
          };
        }
      } else if (storeName === "messages") {
        result =
          raw.prepare("SELECT * FROM messages WHERE id = ?").get(key) ??
          undefined;
      } else {
        result =
          raw.prepare(`SELECT * FROM ${storeName} WHERE id = ?`).get(key) ??
          undefined;
      }
      return {
        result,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<T>;
    },

    // store.getAll() → SELECT *
    getAll() {
      let rows: any[];
      if (storeName === "config") {
        rows = (raw
          .prepare("SELECT key, value FROM config ORDER BY key")
          .all() ?? []) as any[];
      } else if (storeName === "tasks") {
        rows = (
          (raw.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all() ??
            []) as any[]
        ).map((r: any) => ({
          ...r,
          enabled: !!r.enabled,
          tools: r.tools ? JSON.parse(r.tools) : undefined,
        }));
      } else {
        rows = (raw.prepare(`SELECT * FROM ${storeName}`).all() ?? []) as any[];
      }
      return {
        result: rows,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<T>;
    },

    // store.put(record) → INSERT OR REPLACE
    put(record: any) {
      if (storeName === "config") {
        raw
          .prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)")
          .run(
            record.key,
            typeof record.value === "string"
              ? record.value
              : JSON.stringify(record.value),
          );
      } else if (storeName === "tasks") {
        raw
          .prepare(
            `INSERT OR REPLACE INTO tasks
           (id, groupId, enabled, schedule, prompt, tools, lastRun, createdAt, type, freshContext, subagent, name, task_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            record.id,
            record.groupId,
            record.enabled ? 1 : 0,
            record.schedule ?? null,
            record.prompt ?? "",
            record.tools ? JSON.stringify(record.tools) : null,
            record.lastRun ?? null,
            record.createdAt,
            record.type ?? null,
            record.freshContext ? 1 : null,
            record.subagent ? 1 : null,
            record.name ?? null,
            record.order ?? null,
          );
      } else if (storeName === "messages") {
        raw
          .prepare(
            `INSERT OR REPLACE INTO messages
           (id, groupId, timestamp, content, sender, channel, isFromMe, isTrigger, attachments, a2uiAction, a2uiEnvelopes, freshContext, subagent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            record.id,
            record.groupId,
            record.timestamp,
            record.content,
            record.sender,
            record.channel ?? "chat",
            record.isFromMe ? 1 : 0,
            record.isTrigger ? 1 : 0,
            record.attachments ? JSON.stringify(record.attachments) : null,
            record.a2uiAction ? JSON.stringify(record.a2uiAction) : null,
            record.a2uiEnvelopes ? JSON.stringify(record.a2uiEnvelopes) : null,
            record.freshContext ? 1 : null,
            record.subagent ? 1 : null,
          );
      } else {
        // Generic fallback (e.g., pendingShares, sessions)
        const cols = Object.keys(record);
        const placeholders = cols.map(() => "?").join(", ");
        const vals = cols.map((c) => {
          const v = record[c];
          return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
        });
        raw
          .prepare(
            `INSERT OR REPLACE INTO ${storeName} (${cols.join(", ")}) VALUES (${placeholders})`,
          )
          .run(...vals);
      }
      return {
        result: undefined,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<T>;
    },

    // store.delete(key) → DELETE
    delete(key: any) {
      if (storeName === "config") {
        raw.prepare("DELETE FROM config WHERE key = ?").run(key);
      } else if (storeName === "tasks") {
        raw.prepare("DELETE FROM tasks WHERE id = ?").run(key);
      } else {
        raw.prepare(`DELETE FROM ${storeName} WHERE id = ?`).run(key);
      }
      return {
        result: undefined,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<T>;
    },
  };
}

function sqliteTxPromise<T>(
  db: ShadowClawSqliteDatabase,
  storeName: string,
  _mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      const fakeStore = buildSqliteFakeStore<T>(db.db, storeName);
      const fakeRequest = fn(fakeStore);
      // Synchronous result — resolve immediately
      const onsuccess = (fakeRequest as any).onsuccess;
      if (typeof onsuccess === "function") onsuccess();
      resolve((fakeRequest as any).result as T);
    } catch (err) {
      reject(err);
    }
  });
}

function sqliteTxPromiseAll<T>(
  db: ShadowClawSqliteDatabase,
  storeName: string,
  _mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>[],
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const fakeStore = buildSqliteFakeStore<T>(db.db, storeName);
      const requests = fn(fakeStore);
      const results = requests.map((req: any) => {
        const onsuccess = req?.onsuccess;
        if (typeof onsuccess === "function") onsuccess();
        return req?.result;
      });
      resolve(results);
    } catch (err) {
      reject(err);
    }
  });
}

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

  if (isSqliteDatabase(db)) {
    return sqliteTxPromise(db, storeName, mode, fn);
  }

  return new Promise((resolve, reject) => {
    try {
      const transactionStore = (db as IDBDatabase).transaction(storeName, mode);
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

      if (isSqliteDatabase(tx)) {
        return sqliteTxPromiseAll(tx, storeName, mode, fn).then(
          resolve,
          reject,
        );
      }

      const idb = tx as IDBDatabase;
      const transactionStore = idb.transaction(storeName, mode);
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
