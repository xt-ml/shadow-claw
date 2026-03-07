import { openDatabase } from "../db/openDatabase.mjs";
import { setStorageRoot } from "../storage/storage.mjs";
import { handleCompact } from "./handleCompact.mjs";
import { handleInvoke } from "./handleInvoke.mjs";
import { pendingTasks } from "./pendingTasks.mjs";

/**
 * Main message handler logic
 *
 * @param {MessageEvent} event
 */
export async function handleMessage(event) {
  const { type, payload } = event.data;

  let db;
  try {
    db = await openDatabase();
  } catch (err) {
    console.error("[Worker] Failed to open database:", err);
    return;
  }

  switch (type) {
    case "invoke":
      await handleInvoke(db, payload);
      break;
    case "compact":
      await handleCompact(db, payload);
      break;
    case "set-storage":
      if (payload.storageHandle) {
        setStorageRoot(payload.storageHandle);
      }

      break;
    case "task-list-response": {
      const { groupId, tasks } = payload;

      const resolve = pendingTasks.get(groupId);
      if (resolve) {
        resolve(tasks);

        pendingTasks.delete(groupId);
      }

      break;
    }
    case "cancel":
      // TODO: AbortController-based cancellation
      break;
  }
}
