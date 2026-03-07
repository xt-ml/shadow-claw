/**
 * Get message count for a group
 *
 * @param {string} groupId
 *
 * @returns {Promise<number>}
 */
export function getMessageCount(groupId) {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const index = store.index("by-group");
    const request = index.count(groupId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
