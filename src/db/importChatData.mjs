import { clearGroupMessages } from "./clearGroupMessages.mjs";
import { saveMessage } from "./saveMessage.mjs";
import { saveSession } from "./saveSession.mjs";

/**
 * @typedef {{messages: any[], session: any}} ChatData
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Import chat data for a group (replaces existing data)
 *
 * @param {ShadowClawDatabase} db
 * @param {string} groupId
 * @param {ChatData} data
 *
 * @returns {Promise<void>}
 */
export async function importChatData(db, groupId, data) {
  try {
    // Delete existing messages for this group
    await clearGroupMessages(db, groupId);

    // Delete existing session for this group
    const tx1 = db?.transaction("sessions", "readwrite");
    if (!tx1) {
      throw new Error(
        "cannot get existing session for this group from transaction",
      );
    }

    const sessionStore = tx1.objectStore("sessions");
    await new Promise((resolve, reject) => {
      const request = sessionStore.delete(groupId);

      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error);
    });

    // Import messages
    if (data.messages && Array.isArray(data.messages)) {
      for (const msg of data.messages) {
        // Ensure the message has the correct groupId
        msg.groupId = groupId;
        await saveMessage(db, msg);
      }
    }

    // Import session
    if (data.session) {
      data.session.groupId = groupId;

      await saveSession(db, data.session);
    }
  } catch (err) {
    console.error("Failed to import chat data:", err);

    throw err;
  }
}
