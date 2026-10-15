import { getDb } from "./db.js";
import { isSqliteDatabase } from "./sqlite/types.js";
import type { ShadowClawDatabase, StoredMessage } from "./types.js";

/**
 * Get recent messages for a group.
 *
 * Accepts an optional `db` parameter for headless/SQLite usage. When omitted,
 * falls back to the singleton `getDb()` (browser IDB path).
 */
export function getRecentMessages(
  groupIdOrDb: string | ShadowClawDatabase,
  limitOrGroupId: number | string,
  maybeLimit?: number,
): Promise<StoredMessage[]> {
  // Overload resolution: getRecentMessages(db, groupId, limit) vs getRecentMessages(groupId, limit)
  let db: ShadowClawDatabase | null = null;
  let groupId: string;
  let limit: number;

  if (typeof groupIdOrDb === "string") {
    groupId = groupIdOrDb;
    limit = limitOrGroupId as number;
  } else {
    db = groupIdOrDb;
    groupId = limitOrGroupId as string;
    limit = maybeLimit ?? 50;
  }

  // SQLite fast path
  if (db && isSqliteDatabase(db)) {
    return Promise.resolve().then(() => {
      const raw = db!.db;
      // Get the N most-recent rows (DESC), then reverse for oldest-first output
      const rows = (raw
        .prepare(
          `SELECT * FROM messages WHERE groupId = ? ORDER BY timestamp DESC LIMIT ?`,
        )
        .all(groupId, limit) ?? []) as any[];
      return rows.reverse().map(deserializeMessage);
    });
  }

  return new Promise(async (resolve, reject) => {
    try {
      const tx: ShadowClawDatabase = db ?? (await getDb());

      if (!tx) {
        return reject(
          new Error("failed to get transaction, cannot get recent messages."),
        );
      }

      const transactionStore = (tx as IDBDatabase).transaction(
        "messages",
        "readonly",
      );
      if (!transactionStore) {
        return reject(new Error("failed to get transaction"));
      }

      const store = transactionStore.objectStore("messages");
      const index = store.index("by-group-time");
      const range = IDBKeyRange.bound([groupId, 0], [groupId, Infinity]);
      const request = index.openCursor(range, "prev");
      const results: StoredMessage[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);

          cursor.continue();
        } else {
          // Reverse so oldest first
          resolve(results.reverse());
        }
      };

      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

function deserializeMessage(row: any): StoredMessage {
  return {
    ...row,
    isFromMe: !!row.isFromMe,
    isTrigger: !!row.isTrigger,
    attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
    a2uiAction: row.a2uiAction ? JSON.parse(row.a2uiAction) : undefined,
    a2uiEnvelopes: row.a2uiEnvelopes
      ? JSON.parse(row.a2uiEnvelopes)
      : undefined,
  };
}
