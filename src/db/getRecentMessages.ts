import { getDb } from "./db.js";
import type { ShadowClawDatabase, StoredMessage } from "../types.js";

/**
 * Get recent messages for a group
 */
export function getRecentMessages(
  groupId: string,
  limit: number,
): Promise<StoredMessage[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const tx: ShadowClawDatabase = await getDb();

      if (!tx) {
        return reject(
          new Error("failed to get transaction, cannot get recent messages."),
        );
      }

      const transactionStore = tx.transaction("messages", "readonly");
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
