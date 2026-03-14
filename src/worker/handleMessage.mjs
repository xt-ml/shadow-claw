import { openDatabase } from "../db/openDatabase.mjs";
import { setStorageRoot } from "../storage/storage.mjs";
import { DEFAULT_GROUP_ID } from "../config.mjs";
import {
  attachTerminalWorkspaceAutoSync,
  bootVM,
  createTerminalSession,
  flushVMWorkspaceToHost,
  getVMBootModePreference,
  getVMStatus,
  setVMBootHostPreference,
  setVMBootModePreference,
  setVMNetworkRelayURLPreference,
  subscribeVMBootOutput,
  syncVMWorkspaceFromHost,
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

/** @type {string} */
let activeTerminalGroupId = DEFAULT_GROUP_ID;

/** @type {(() => void)|null} */
let detachTerminalWorkspaceAutoSync = null;

/** @type {boolean} */
let terminalSyncWarningShown = false;

/**
 * @returns {boolean}
 */
function closeTerminalSession() {
  if (!activeTerminalSession) {
    return false;
  }

  detachTerminalWorkspaceAutoSync?.();
  detachTerminalWorkspaceAutoSync = null;

  activeTerminalSession.close();
  activeTerminalSession = null;
  terminalSyncWarningShown = false;
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
      const hasMode =
        mode === "disabled" ||
        mode === "auto" ||
        mode === "9p" ||
        mode === "ext2";

      const hasBootHost = Object.prototype.hasOwnProperty.call(
        payload || {},
        "bootHost",
      );

      const hasNetworkRelayUrl = Object.prototype.hasOwnProperty.call(
        payload || {},
        "networkRelayUrl",
      );

      if (hasMode || hasBootHost || hasNetworkRelayUrl) {
        const sessionWasClosed = closeTerminalSession();
        if (sessionWasClosed) {
          post({ type: "vm-terminal-closed", payload: { ok: true } });
        }

        if (hasMode) {
          setVMBootModePreference(mode);
        }

        if (hasBootHost) {
          setVMBootHostPreference(payload?.bootHost);
        }

        if (hasNetworkRelayUrl) {
          setVMNetworkRelayURLPreference(payload?.networkRelayUrl);
        }

        const effectiveMode = hasMode ? mode : getVMBootModePreference();

        await shutdownVM();

        if (effectiveMode !== "disabled") {
          await bootVM().catch((err) => {
            console.warn("[WebVM] Reboot after mode change failed:", err);
          });
        }
      }

      break;
    }
    case "vm-terminal-open": {
      const groupId =
        typeof payload?.groupId === "string" && payload.groupId
          ? payload.groupId
          : DEFAULT_GROUP_ID;

      /** @type {(() => void)|null} */
      let detachBootOutput = null;

      if (activeTerminalSession) {
        activeTerminalGroupId = groupId;
        post({ type: "vm-terminal-opened", payload: { ok: true } });
        break;
      }

      if (!getVMStatus().ready) {
        detachBootOutput = subscribeVMBootOutput((chunk) => {
          post({
            type: "vm-terminal-output",
            payload: { chunk },
          });
        });

        await bootVM().catch((err) => {
          console.warn("[WebVM] Terminal boot failed:", err);
        });

        detachBootOutput?.();
        detachBootOutput = null;
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
        const context = { db, groupId };
        activeTerminalGroupId = groupId;

        activeTerminalSession = createTerminalSession((chunk) => {
          post({
            type: "vm-terminal-output",
            payload: { chunk },
          });
        });

        post({ type: "vm-terminal-opened", payload: { ok: true } });

        syncVMWorkspaceFromHost(context)
          .then(() =>
            post({
              type: "vm-workspace-synced",
              payload: { groupId },
            }),
          )
          .catch((err) => {
            console.warn("[WebVM] Failed to sync host workspace into VM:", err);

            if (!terminalSyncWarningShown) {
              terminalSyncWarningShown = true;
              post({
                type: "show-toast",
                payload: {
                  message:
                    "WebVM terminal connected, but workspace sync failed. File changes may not appear until the next sync.",
                  type: "warning",
                  duration: 5000,
                },
              });
            }
          });

        detachTerminalWorkspaceAutoSync = attachTerminalWorkspaceAutoSync(
          context,
          () => {
            post({
              type: "vm-workspace-synced",
              payload: { groupId },
            });
          },
        );
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
      const groupId =
        typeof payload?.groupId === "string" && payload.groupId
          ? payload.groupId
          : activeTerminalGroupId;

      closeTerminalSession();
      // Sync files the user may have written directly in the terminal back
      // to the host workspace so the Files panel reflects them.
      flushVMWorkspaceToHost({ db, groupId })
        .then(() => {
          post({
            type: "vm-workspace-synced",
            payload: { groupId },
          });
        })
        .catch(() => {
          /* ignore */
        });
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
