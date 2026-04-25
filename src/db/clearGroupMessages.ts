import type { ShadowClawDatabase } from "../types.js";

/**
 * Delete all messages for a given group
 */
export function clearGroupMessages(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db?.transaction("messages", "readwrite");

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
