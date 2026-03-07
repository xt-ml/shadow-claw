import { getDb } from "./db.mjs";

/**
 * Get recent messages for a group
 *
 * @param {string} groupId
 * @param {number} limit
 *
 * @returns {Promise<import('../types.mjs').StoredMessage[]>}
 */
export function getRecentMessages(groupId, limit) {
  return new Promise((resolve, reject) => {
    const tx = getDb()?.transaction("messages", "readonly");

    if (!tx) {
      throw new Error("failed to get transaction, cannot update task.");
    }

    const store = tx.objectStore("messages");
    const index = store.index("by-group-time");
    const range = IDBKeyRange.bound([groupId, 0], [groupId, Infinity]);
    const request = index.openCursor(range, "prev");
    /** @type {any[]} */
    const results = [];

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
  });
}
