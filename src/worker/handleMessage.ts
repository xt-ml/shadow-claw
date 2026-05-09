import { openDatabase } from "../db/openDatabase.js";
import { setStorageRoot } from "../storage/storage.js";
import { DEFAULT_GROUP_ID } from "../config.js";
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
} from "../vm.js";
import { handleCompact } from "./handleCompact.js";
import { handleInvoke } from "./handleInvoke.js";
import { pendingTasks } from "./pendingTasks.js";
import { post } from "./post.js";
import { executeTool, resolveMcpReauth } from "./executeTool.js";
import { setToolState } from "./tool-state.js";

/** In-flight abort controllers for group tasks */
const inFlightControllers = new Map<string, AbortController>();

/** Active WebVM terminal session */
let activeTerminalSession: any = null;

let activeTerminalGroupId: string = DEFAULT_GROUP_ID;

/** Cleanup function for VM workspace auto-sync */
let detachTerminalWorkspaceAutoSync: (() => void) | null = null;

let terminalSyncWarningShown: boolean = false;

/** Active workspace sync operation to avoid parallel overlap */
let terminalWorkspaceSyncPromise: Promise<void> | null = null;

/** Queued workspace sync when one is already in flight */
let queuedTerminalWorkspaceSync: { db: any; groupId: string } | null = null;

let terminalConnectionInProgress: boolean = false;

/**
 * Request a 9p workspace sync from host into the VM.
 */
function requestTerminalWorkspaceSync(
  db: any,
  groupId: string,
  options: {
    emitSyncedOnSuccess?: boolean;
    showWarningOnFailure?: boolean;
  } = {},
): void {
  if (!activeTerminalSession || groupId !== activeTerminalGroupId) {
    return;
  }

  const { emitSyncedOnSuccess = false, showWarningOnFailure = false } = options;

  if (terminalWorkspaceSyncPromise) {
    queuedTerminalWorkspaceSync = { db, groupId };

    return;
  }

  terminalWorkspaceSyncPromise = syncVMWorkspaceFromHost({ db, groupId })
    .then(() => {
      if (emitSyncedOnSuccess) {
        post({
          type: "vm-workspace-synced",
          payload: { groupId },
        });
      }
    })
    .catch((err: any) => {
      console.warn("[WebVM] Failed to sync host workspace into VM:", err);

      if (showWarningOnFailure && !terminalSyncWarningShown) {
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
    })
    .finally(() => {
      terminalWorkspaceSyncPromise = null;

      const next = queuedTerminalWorkspaceSync;
      queuedTerminalWorkspaceSync = null;

      if (
        !next ||
        !activeTerminalSession ||
        next.groupId !== activeTerminalGroupId
      ) {
        return;
      }

      requestTerminalWorkspaceSync(next.db, next.groupId);
    });
}

/**
 * Close and detach the active terminal session.
 */
function closeTerminalSession(): boolean {
  if (!activeTerminalSession) {
    return false;
  }

  detachTerminalWorkspaceAutoSync?.();
  detachTerminalWorkspaceAutoSync = null;

  activeTerminalSession.close();
  activeTerminalSession = null;
  terminalSyncWarningShown = false;
  terminalWorkspaceSyncPromise = null;
  queuedTerminalWorkspaceSync = null;

  return true;
}

/**
 * Main message handler logic for the worker.
 */
export async function handleMessage(event: MessageEvent): Promise<void> {
  const { type, payload } = event.data;

  let db: any;
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

    case "execute-direct-tool": {
      const groupId = payload?.groupId;
      const name = payload?.name;
      const input =
        payload?.input && typeof payload.input === "object"
          ? payload.input
          : {};

      if (!groupId || !name) {
        post({
          type: "error",
          payload: {
            groupId: groupId || DEFAULT_GROUP_ID,
            error: "Invalid execute-direct-tool payload.",
          },
        });

        break;
      }

      const output = await executeTool(db, name, input, groupId);
      post({ type: "response", payload: { groupId, text: output } });

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
          // Do not block the worker message loop on boot.
          Promise.resolve(bootVM()).catch((err) => {
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

      if (activeTerminalSession) {
        activeTerminalGroupId = groupId;
        post({ type: "vm-terminal-opened", payload: { ok: true } });

        break;
      }

      if (terminalConnectionInProgress) {
        break;
      }

      terminalConnectionInProgress = true;

      // Do not block the worker message loop on boot.
      (async () => {
        let detachBootOutput: (() => void) | null = null;

        try {
          if (!getVMStatus().ready) {
            detachBootOutput = subscribeVMBootOutput((chunk: string) => {
              post({
                type: "vm-terminal-output",
                payload: { chunk },
              });
            });

            await bootVM().catch((err: any) => {
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

            return;
          }

          const context = { db, groupId };
          activeTerminalGroupId = groupId;

          activeTerminalSession = createTerminalSession((chunk: string) => {
            post({
              type: "vm-terminal-output",
              payload: { chunk },
            });
          });

          post({ type: "vm-terminal-opened", payload: { ok: true } });
          // Force a prompt render
          activeTerminalSession.send("\n");

          requestTerminalWorkspaceSync(context.db, groupId, {
            emitSyncedOnSuccess: true,
            showWarningOnFailure: true,
          });

          detachTerminalWorkspaceAutoSync = (
            attachTerminalWorkspaceAutoSync as any
          )(context, () => {
            post({
              type: "vm-workspace-synced",
              payload: { groupId },
            });
          });
        } catch (err: any) {
          const msg = err instanceof Error ? err.message : String(err);
          post({
            type: "vm-terminal-error",
            payload: { error: msg },
          });
        } finally {
          terminalConnectionInProgress = false;
          detachBootOutput?.();
        }
      })();

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
      // Sync files back to host
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

    case "vm-workspace-sync": {
      const groupId =
        typeof payload?.groupId === "string" && payload.groupId
          ? payload.groupId
          : activeTerminalGroupId;

      requestTerminalWorkspaceSync(db, groupId);

      break;
    }

    case "vm-workspace-flush": {
      const groupId =
        typeof payload?.groupId === "string" && payload.groupId
          ? payload.groupId
          : activeTerminalGroupId;

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

    case "update-tools": {
      const { groupId, enabledTools, systemPromptOverride } = payload;
      setToolState(groupId, enabledTools, systemPromptOverride);

      break;
    }

    case "execute-tool":
      try {
        const result = await executeTool(
          db,
          payload.name,
          payload.input,
          payload.groupId,
        );
        (self as any).postMessage({
          type: "execute-tool-result",
          callId: event.data.callId,
          result,
        });
      } catch (err: any) {
        (self as any).postMessage({
          type: "execute-tool-result",
          callId: event.data.callId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      break;

    case "mcp-reauth-result": {
      const { connectionId, success } = payload;
      resolveMcpReauth(connectionId, !!success);

      break;
    }
  }
}
