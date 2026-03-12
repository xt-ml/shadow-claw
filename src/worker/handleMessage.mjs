import { openDatabase } from "../db/openDatabase.mjs";
import { setStorageRoot } from "../storage/storage.mjs";
import {
  bootVM,
  createTerminalSession,
  getVMStatus,
  setVMBootModePreference,
  shutdownVM,
} from "../vm.mjs";
import { handleCompact } from "./handleCompact.mjs";
import { handleInvoke } from "./handleInvoke.mjs";
import { pendingTasks } from "./pendingTasks.mjs";
import { post } from "./post.mjs";

/** @type {Map<string, AbortController>} */
const inFlightControllers = new Map();

/** @type {import("../vm.mjs").VMTerminalSession|null} */
let activeTerminalSession = null;

/**
 * @returns {boolean}
 */
function closeTerminalSession() {
  if (!activeTerminalSession) {
    return false;
  }

  activeTerminalSession.close();
  activeTerminalSession = null;
  return true;
}

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
    case "set-vm-mode": {
      const mode = payload?.mode;
      if (
        mode === "disabled" ||
        mode === "auto" ||
        mode === "9p" ||
        mode === "ext2"
      ) {
        const sessionWasClosed = closeTerminalSession();
        if (sessionWasClosed) {
          post({ type: "vm-terminal-closed", payload: { ok: true } });
        }

        setVMBootModePreference(mode);
        await shutdownVM();

        if (mode !== "disabled") {
          await bootVM().catch((err) => {
            console.warn("[WebVM] Reboot after mode change failed:", err);
          });
        }
      }

      break;
    }
    case "vm-terminal-open": {
      if (activeTerminalSession) {
        post({ type: "vm-terminal-opened", payload: { ok: true } });
        break;
      }

      if (!getVMStatus().ready) {
        await bootVM().catch((err) => {
          console.warn("[WebVM] Terminal boot failed:", err);
        });
      }

      const status = getVMStatus();
      if (!status.ready) {
        post({
          type: "vm-terminal-error",
          payload: {
            error: status.error || "WebVM is still booting.",
          },
        });
        break;
      }

      try {
        activeTerminalSession = createTerminalSession((chunk) => {
          post({
            type: "vm-terminal-output",
            payload: { chunk },
          });
        });
        post({ type: "vm-terminal-opened", payload: { ok: true } });
      } catch (err) {
        post({
          type: "vm-terminal-error",
          payload: {
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }

      break;
    }
    case "vm-terminal-input": {
      const data = payload?.data;
      if (!activeTerminalSession) {
        post({
          type: "vm-terminal-error",
          payload: { error: "WebVM terminal is not connected." },
        });
        break;
      }

      if (typeof data === "string" && data.length > 0) {
        activeTerminalSession.send(data);
      }

      break;
    }
    case "vm-terminal-close": {
      closeTerminalSession();
      post({ type: "vm-terminal-closed", payload: { ok: true } });
      break;
    }
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
