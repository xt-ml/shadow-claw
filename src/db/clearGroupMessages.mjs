/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Delete all messages for a given group
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 *
 * @returns {Promise<void>}
 */
export function clearGroupMessages(db, groupId) {
  return new Promise((resolve, reject) => {
    const tx = db?.transaction("messages", "readwrite");

    if (!tx) {
      throw new Error("failed to get transaction, cannot update task.");
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
  });
}
