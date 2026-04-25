import { getSession } from "./getSession.js";
import type { ShadowClawDatabase } from "../types.js";
import type { ChatData } from "./importChatData.js";

/**
 * Export all chat data for a group (messages and session)
 */
export async function exportChatData(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<ChatData | null> {
  try {
    // Get all messages for this group
    const tx = db?.transaction("messages", "readonly");
    if (!tx) {
      throw new Error("cannot get transaction to export chat data");
    }

    const store = tx.objectStore("messages");
    const index = store.index("by-group");
    const messages = await new Promise<any[]>((resolve, reject) => {
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
