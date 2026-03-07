/**
 * Get all group IDs from messages
 *
 * @returns {Promise<string[]>}
 */
export function getAllGroupIds() {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const index = store.index("by-group");
    const request = index.openKeyCursor(null, "nextunique");
    /** @type {any[]} */
    const ids = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        ids.push(cursor.key);

        cursor.continue();
      } else {
        resolve(ids);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
