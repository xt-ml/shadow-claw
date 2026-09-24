import { DEFAULT_GROUP_ID } from "../../config/config.js";
import { openDatabase } from "../../db/openDatabase.js";

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
  shutdownVM,
  subscribeVMBootOutput,
  syncVMWorkspaceFromHost,
} from "../../shell/vm.js";

import { setStorageRoot } from "../../storage/storage.js";
import { executeTool } from "./executeTool.js";
import { executeToolChain } from "./toolChain.js";
import { handleCompact } from "./handleCompact.js";
import { handleInvoke } from "./handleInvoke.js";
import { pendingTasks } from "./pendingTasks.js";
import { post } from "./post.js";
import { getToolState, setToolState } from "./tool-state.js";
import { resolveMcpReauth } from "../tools/remote-mcp/utils/resolveMcpReauth.js";

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

      if (queuedTerminalWorkspaceSync) {
        const next = queuedTerminalWorkspaceSync;
        queuedTerminalWorkspaceSync = null;
        requestTerminalWorkspaceSync(next.db, next.groupId, {
          emitSyncedOnSuccess,
          showWarningOnFailure: false,
        });
      }
    });
}

function closeTerminalSession(): boolean {
  if (detachTerminalWorkspaceAutoSync) {
    detachTerminalWorkspaceAutoSync();
    detachTerminalWorkspaceAutoSync = null;
  }

  terminalSyncWarningShown = false;
  terminalConnectionInProgress = false;

  if (activeTerminalSession) {
    activeTerminalSession.close();
    activeTerminalSession = null;
    activeTerminalGroupId = DEFAULT_GROUP_ID;

    return true;
  }

  return false;
}

export type WorkerIncomingMessageHandler = (
  db: any,
  payload: any,
  event: any,
) => Promise<void> | void;

export const INCOMING_MESSAGE_HANDLERS = new Map<
  string,
  WorkerIncomingMessageHandler
>();

// ── Agent Execution & Compaction ────────────────────────────────────────────

INCOMING_MESSAGE_HANDLERS.set("invoke", async (db, payload) => {
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
});

INCOMING_MESSAGE_HANDLERS.set("compact", async (db, payload) => {
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
});

// ── Direct / Task / Skill Tool Execution ────────────────────────────────────

INCOMING_MESSAGE_HANDLERS.set("execute-direct-tool", async (db, payload) => {
  const groupId = payload?.groupId;
  const name = payload?.name;
  const input =
    payload?.input && typeof payload.input === "object" ? payload.input : {};

  if (!groupId || !name) {
    post({
      type: "error",
      payload: {
        groupId: groupId || DEFAULT_GROUP_ID,
        error: "Invalid execute-direct-tool payload.",
      },
    });

    return;
  }

  const output = await executeTool(db, name, input, groupId);
  post({ type: "response", payload: { groupId, text: output } });
});

INCOMING_MESSAGE_HANDLERS.set("execute-task-tools", async (db, payload) => {
  const groupId = payload?.groupId;
  const tools = Array.isArray(payload?.tools) ? payload.tools : [];

  if (!groupId || tools.length === 0) {
    post({
      type: "error",
      payload: {
        groupId: groupId || DEFAULT_GROUP_ID,
        error: "Invalid execute-task-tools payload.",
      },
    });

    return;
  }

  const { results } = await executeToolChain(db, groupId, tools, {
    isManual: payload.isManual,
    isTaskExecution: true,
    onStep: (tool) => {
      if (!tool.suppressToast) {
        post({
          type: "show-toast",
          payload: {
            message: `Running task tool: ${tool.name}...`,
            duration: 3000,
          },
        });
      }
    },
  });

  if (results.length > 0) {
    post({
      type: "response",
      payload: {
        groupId,
        text: results.join("\n\n"),
      },
    });
  }
});

INCOMING_MESSAGE_HANDLERS.set("execute-skill-tools", async (db, payload) => {
  const groupId = payload?.groupId;
  const tools = Array.isArray(payload?.tools) ? payload.tools : [];

  if (!groupId || tools.length === 0) {
    post({
      type: "error",
      payload: {
        groupId: groupId || DEFAULT_GROUP_ID,
        error: "Invalid execute-skill-tools payload.",
      },
    });
    return;
  }

  const { results } = await executeToolChain(db, groupId, tools, {
    isManual: true,
    isTaskExecution: false,
    onStep: (tool) => {
      if (!tool.suppressToast) {
        post({
          type: "show-toast",
          payload: {
            message: `Running skill tool: ${tool.name}...`,
            duration: 3000,
          },
        });
      }
    },
  });

  if (results.length > 0) {
    post({
      type: "response",
      payload: { groupId, text: results.join("\n\n") },
    });
  }
});

// ── Storage & Tool State ────────────────────────────────────────────────────

INCOMING_MESSAGE_HANDLERS.set("set-storage", (_db, payload) => {
  if (payload.storageHandle) {
    setStorageRoot(payload.storageHandle);
  }
});

INCOMING_MESSAGE_HANDLERS.set("update-tools", (_db, payload) => {
  const { groupId, enabledTools, systemPromptOverride } = payload;
  setToolState(groupId, enabledTools, systemPromptOverride);
});

INCOMING_MESSAGE_HANDLERS.set("execute-tool", async (db, payload, event) => {
  try {
    const toolState = getToolState(payload.groupId);
    const allowedTools = toolState?.enabledTools;
    const result = await executeTool(
      db,
      payload.name,
      payload.input,
      payload.groupId,
      { allowedTools },
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
});

// ── Virtual Machine & Terminal ──────────────────────────────────────────────

INCOMING_MESSAGE_HANDLERS.set("set-vm-mode", async (_db, payload) => {
  const mode = payload?.mode;
  const hasMode =
    mode === "disabled" || mode === "auto" || mode === "9p" || mode === "ext2";

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
      Promise.resolve(bootVM()).catch((err) => {
        console.warn("[WebVM] Reboot after mode change failed:", err);
      });
    }
  }
});

INCOMING_MESSAGE_HANDLERS.set("vm-terminal-open", (db, payload) => {
  const groupId =
    typeof payload?.groupId === "string" && payload.groupId
      ? payload.groupId
      : DEFAULT_GROUP_ID;

  if (activeTerminalSession) {
    activeTerminalGroupId = groupId;
    post({ type: "vm-terminal-opened", payload: { ok: true } });
    return;
  }

  if (terminalConnectionInProgress) {
    return;
  }

  terminalConnectionInProgress = true;

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
});

INCOMING_MESSAGE_HANDLERS.set("vm-terminal-input", (_db, payload) => {
  const data = payload?.data;
  if (!activeTerminalSession) {
    post({
      type: "vm-terminal-error",
      payload: { error: "WebVM terminal is not connected." },
    });
    return;
  }

  if (typeof data === "string" && data.length > 0) {
    activeTerminalSession.send(data);
  }
});

INCOMING_MESSAGE_HANDLERS.set("vm-terminal-close", (db, payload) => {
  const groupId =
    typeof payload?.groupId === "string" && payload.groupId
      ? payload.groupId
      : activeTerminalGroupId;

  closeTerminalSession();
  flushVMWorkspaceToHost({ db, groupId })
    .then(() => {
      post({
        type: "vm-workspace-synced",
        payload: { groupId },
      });
    })
    .catch(() => {});
  post({ type: "vm-terminal-closed", payload: { ok: true } });
});

INCOMING_MESSAGE_HANDLERS.set("vm-workspace-sync", (db, payload) => {
  const groupId =
    typeof payload?.groupId === "string" && payload.groupId
      ? payload.groupId
      : activeTerminalGroupId;

  requestTerminalWorkspaceSync(db, groupId);
});

INCOMING_MESSAGE_HANDLERS.set("vm-workspace-flush", (db, payload) => {
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
    .catch(() => {});
});

// ── Coordination & Task Control ─────────────────────────────────────────────

INCOMING_MESSAGE_HANDLERS.set("task-list-response", (_db, payload) => {
  const { groupId, tasks } = payload;

  const resolve = pendingTasks.get(groupId);
  if (resolve) {
    resolve(tasks);
    pendingTasks.delete(groupId);
  }
});

INCOMING_MESSAGE_HANDLERS.set("cancel", (_db, payload) => {
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
});

INCOMING_MESSAGE_HANDLERS.set("mcp-reauth-result", (_db, payload) => {
  const { connectionId, success } = payload;
  resolveMcpReauth(connectionId, !!success);
});

INCOMING_MESSAGE_HANDLERS.set("ask-user-response", (_db, payload) => {
  const { id, response } = payload;
  const resolvers = (globalThis as any).pendingAskUserResolvers;
  if (resolvers && resolvers[id]) {
    resolvers[id](response ?? "");
    delete resolvers[id];
  }
});

INCOMING_MESSAGE_HANDLERS.set("native-ai-task-response", (_db, payload) => {
  const { id, response, error } = payload;
  const resolvers = (globalThis as any).pendingNativeAiResolvers;
  if (resolvers && resolvers[id]) {
    if (error) {
      resolvers[id].reject(new Error(error));
    } else {
      resolvers[id].resolve(response);
    }
    delete resolvers[id];
  }
});

// ── Dispatcher Entry Point ──────────────────────────────────────────────────

export async function handleMessage(event: any): Promise<void> {
  const { type, payload } = event.data;

  let db: any;
  try {
    db = await openDatabase();
  } catch (err) {
    console.error("[Worker] Failed to open database:", err);

    return;
  }

  const handler = INCOMING_MESSAGE_HANDLERS.get(type);
  if (handler) {
    await handler(db, payload, event);
  }
}
