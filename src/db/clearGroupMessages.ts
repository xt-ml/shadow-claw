import { isSqliteDatabase } from "./sqlite/types.js";
import type { ShadowClawDatabase } from "./types.js";

/**
 * Delete all messages for a given group.
 *
 * Accepts an optional `db` parameter for headless/SQLite usage.
 */
export function clearGroupMessages(
  dbOrGroupId: ShadowClawDatabase | string,
  groupIdOrNothing?: string,
): Promise<void> {
  let db: ShadowClawDatabase | null = null;
  let groupId: string;

  if (typeof dbOrGroupId === "string") {
    groupId = dbOrGroupId;
  } else {
    db = dbOrGroupId;
    groupId = groupIdOrNothing!;
  }

  // SQLite fast path
  if (db && isSqliteDatabase(db)) {
    const raw = db.db;
    raw.prepare("DELETE FROM messages WHERE groupId = ?").run(groupId);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      const idb = db as IDBDatabase | null;
      const tx = idb?.transaction("messages", "readwrite");

      if (!tx) {
        return reject(
          new Error("failed to get transaction, cannot clear group messages."),
        );
      }

      const store = tx.objectStore("messages");
      const index = store.index("by-group");
      const request = index.openCursor(groupId);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve(undefined);
        }
      };

      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}
