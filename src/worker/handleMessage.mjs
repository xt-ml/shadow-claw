import { openDatabase } from "../db/openDatabase.mjs";
import { setStorageRoot } from "../storage/storage.mjs";
import { handleCompact } from "./handleCompact.mjs";
import { handleInvoke } from "./handleInvoke.mjs";
import { pendingTasks } from "./pendingTasks.mjs";

/** @type {Map<string, AbortController>} */
const inFlightControllers = new Map();

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
    case "invoke": {
      const groupId = payload?.groupId;
      const controller = new AbortController();

      if (groupId) {
        const previous = inFlightControllers.get(groupId);
        if (previous) {
          previous.abort();
        }

        inFlightControllers.set(groupId, controller);
      }

      try {
        await handleInvoke(db, payload, controller.signal);
      } finally {
        if (groupId && inFlightControllers.get(groupId) === controller) {
          inFlightControllers.delete(groupId);
        }
      }

      break;
    }
    case "compact": {
      const groupId = payload?.groupId;
      const controller = new AbortController();

      if (groupId) {
        const previous = inFlightControllers.get(groupId);
        if (previous) {
          previous.abort();
        }

        inFlightControllers.set(groupId, controller);
      }

      try {
        await handleCompact(db, payload, controller.signal);
      } finally {
        if (groupId && inFlightControllers.get(groupId) === controller) {
          inFlightControllers.delete(groupId);
        }
      }

      break;
    }
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
      if (payload?.groupId) {
        const controller = inFlightControllers.get(payload.groupId);
        if (controller) {
          controller.abort();
          inFlightControllers.delete(payload.groupId);
        }
      } else {
        for (const controller of inFlightControllers.values()) {
          controller.abort();
        }

        inFlightControllers.clear();
      }

      break;
  }
}
