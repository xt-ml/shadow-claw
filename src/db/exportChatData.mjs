import { getSession } from "./getSession.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 * @typedef {import("./importChatData.mjs").ChatData} ChatData
 */

/**
 * Export all chat data for a group (messages and session)
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 *
 * @returns {Promise<ChatData|null>}
 */
export async function exportChatData(db, groupId) {
  try {
    // Get all messages for this group
    const tx = db?.transaction("messages", "readonly");
    if (!tx) {
      throw new Error("cannot get transaction to export chat data");
    }
    const store = tx.objectStore("messages");
    const index = store.index("by-group");
    const messages = await new Promise((resolve, reject) => {
      const request = index.getAll(groupId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Get session for this group
    const session = await getSession(db, groupId);

    return { messages, session };
  } catch (err) {
    console.error("Failed to export chat data:", err);

    return null;
  }
}
