import { isLlamafileResolutionError } from "../../../components/common/help/llamafile.js";
import { detectProviderHelpType } from "../../../components/common/help/providers.js";
import { isTransformersJsResolutionError } from "../../../components/common/help/transformers.js";

import { DEFAULT_GROUP_ID } from "../../../config/config.js";

import { deleteTask } from "../../../db/deleteTask.js";
import { getAllTasks } from "../../../db/getAllTasks.js";
import { getOrCreateSubscriberId } from "../../../db/getOrCreateSubscriberId.js";
import { roomIdFromGroupId } from "../../../db/rooms.js";
import { saveTask } from "../../../db/saveTask.js";

import { orchestratorStore } from "../../../stores/orchestrator.js";
import { toolsStore } from "../../../stores/tools.js";

import { getRemoteMcpConnection } from "../../../subsystems/mcp/mcp-connections.js";
import { reconnectMcpOAuth } from "../../../subsystems/mcp/mcp-reconnect.js";
import { getPushUrl } from "../../../subsystems/notifications/push-client.js";

import { showToast } from "../../../ui/toast.js";

import {
  deliverIntermediateResponse,
  deliverResponse,
} from "./deliverResponse.js";

import {
  getApiKeyForRequest,
  getProviderRuntimeHeaders,
  stopTransformersProgressPolling,
} from "./operations/provider.js";
import { createRoom, inviteToRoom, leaveRoom } from "./operations/room.js";
import { executeNativeAiTask } from "../../../subsystems/providers/executeNativeAiTask.js";
import { deleteTaskFromServer, syncTaskToServer } from "./operations/task.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

export type WorkerMessageHandler = (
  o: Orchestrator,
  db: ShadowClawDatabase,
  payload: any,
  msg?: any,
) => Promise<void> | void;

export const WORKER_MESSAGE_HANDLERS = new Map<string, WorkerMessageHandler>();

// ── Streaming & Responses ───────────────────────────────────────────────────

WORKER_MESSAGE_HANDLERS.set("response", async (o, db, payload) => {
  const { groupId, text } = payload;
  stopTransformersProgressPolling(o, groupId);
  o.clearProviderRequest(groupId);
  o.inFlightTriggerByGroup.delete(groupId);
  o.inFlightEffectiveProviderByGroup.delete(groupId);

  await deliverResponse(o, db, groupId, text);
});

WORKER_MESSAGE_HANDLERS.set("streaming-start", (o, _db, payload) => {
  const { groupId } = payload;
  o.setState("responding", groupId);
  o.events.emit("streaming-start", { groupId });
});

WORKER_MESSAGE_HANDLERS.set("streaming-chunk", (o, _db, payload) => {
  const { groupId, text } = payload;
  o.events.emit("streaming-chunk", { groupId, text });
});

WORKER_MESSAGE_HANDLERS.set("intermediate-response", async (o, db, payload) => {
  const { groupId, text } = payload;
  await deliverIntermediateResponse(o, db, groupId, text);
});

WORKER_MESSAGE_HANDLERS.set("streaming-end", (o, _db, payload) => {
  const { groupId } = payload;
  o.events.emit("streaming-end", { groupId });
  o.setState("thinking", groupId);
});

WORKER_MESSAGE_HANDLERS.set("streaming-done", (o, _db, payload) => {
  const { groupId } = payload;
  o.events.emit("streaming-done", { groupId });
});

WORKER_MESSAGE_HANDLERS.set("streaming-error", (o, _db, payload) => {
  const { groupId, error } = payload;
  o.events.emit("streaming-error", { groupId, error });
});

// ── Tasks ───────────────────────────────────────────────────────────────────

WORKER_MESSAGE_HANDLERS.set("run-task", (_o, _db, payload) => {
  const { task } = payload;
  orchestratorStore.runTask(task, true);
});

WORKER_MESSAGE_HANDLERS.set("task-created", async (o, db, payload) => {
  const { task } = payload;

  if (task.groupId && o.schedulerTriggeredGroups.has(task.groupId)) {
    showToast(
      "\u26a0\ufe0f Task creation blocked \u2014 scheduled tasks cannot create new tasks (recursion prevention).",
      { type: "warning", duration: 8000 },
    );
    return;
  }

  try {
    const subscriberId = await getOrCreateSubscriberId(db);
    const serverOk = await syncTaskToServer(o, task, subscriberId);

    if (!serverOk) {
      showToast("Failed to sync task to server — task was not saved.", {
        type: "error",
      });
      return;
    }

    await saveTask(db, task);
    o.events.emit("task-change", { type: "created", task });
  } catch (err) {
    console.error("Failed to save task from agent:", err);
    showToast("Failed to save task.", { type: "error" });
  }
});

WORKER_MESSAGE_HANDLERS.set("task-list-request", async (o, db, payload) => {
  const { groupId } = payload;
  const tasks = await getAllTasks(db);
  const groupTasks = tasks.filter((t: any) => t.groupId === groupId);

  o.agentWorker?.postMessage({
    type: "task-list-response",
    payload: { groupId, tasks: groupTasks },
  });
});

WORKER_MESSAGE_HANDLERS.set("update-task", async (o, db, payload) => {
  const { task } = payload;

  if (task.groupId && o.schedulerTriggeredGroups.has(task.groupId)) {
    showToast(
      "\u26a0\ufe0f Task update blocked \u2014 scheduled tasks cannot modify tasks (recursion prevention).",
      { type: "warning", duration: 8000 },
    );
    return;
  }

  try {
    const subscriberId = await getOrCreateSubscriberId(db);
    const serverOk = await syncTaskToServer(o, task, subscriberId);

    if (!serverOk) {
      showToast(
        "Failed to sync task update to server — task was not updated.",
        { type: "error" },
      );
      return;
    }

    await saveTask(db, task);
    o.events.emit("task-change", { type: "updated", task });
  } catch (err) {
    console.error("Failed to update task from agent:", err);
    showToast("Failed to update task.", { type: "error" });
  }
});

WORKER_MESSAGE_HANDLERS.set("delete-task", async (o, db, payload) => {
  const { id, groupId: deleteGroupId } = payload;

  if (deleteGroupId && o.schedulerTriggeredGroups.has(deleteGroupId)) {
    showToast(
      "\u26a0\ufe0f Task deletion blocked \u2014 scheduled tasks cannot delete tasks (recursion prevention).",
      { type: "warning", duration: 8000 },
    );
    return;
  }

  try {
    const subscriberId = await getOrCreateSubscriberId(db);
    const serverOk = await deleteTaskFromServer(o, id, subscriberId);

    if (!serverOk) {
      showToast("Failed to delete task from server — task kept in view.", {
        type: "error",
      });
      return;
    }

    await deleteTask(db, id);
    o.events.emit("task-change", { type: "deleted", id });
  } catch (err) {
    console.error("Failed to delete task from agent:", err);
  }
});

// ── Rooms & Channels ────────────────────────────────────────────────────────

WORKER_MESSAGE_HANDLERS.set("room-action", (o, _db, payload) => {
  const action = payload?.action;

  try {
    if (action === "create") {
      createRoom(o, String(payload.name || "").trim());
    } else if (action === "invite") {
      inviteToRoom(o, String(payload.roomId), String(payload.peerId));
    } else if (action === "leave") {
      leaveRoom(o, String(payload.roomId));
    }
  } catch (err) {
    console.error("Failed to handle room action from agent:", err);
  }
});

// ── Error & Diagnostics ─────────────────────────────────────────────────────

WORKER_MESSAGE_HANDLERS.set("error", async (o, db, payload) => {
  const { groupId, error } = payload;
  stopTransformersProgressPolling(o, groupId);
  o.clearProviderRequest(groupId);
  o.inFlightTriggerByGroup.delete(groupId);

  let finalError = error;
  let hasProviderHelp = false;

  const inFlightProvider = o.inFlightEffectiveProviderByGroup.get(groupId);
  o.inFlightEffectiveProviderByGroup.delete(groupId);

  const errorProviderId = inFlightProvider?.providerId ?? o.provider;
  const errorProviderConfig =
    inFlightProvider?.providerConfig ?? o.providerConfig;

  const isContextError =
    error.includes("413") ||
    error.includes("tokens_limit_reached") ||
    error.includes("context_length_exceeded") ||
    error.includes("too many tokens");

  if (isContextError) {
    finalError +=
      "\n\n\u26a0\ufe0f This model has a small context window. Try clicking **'Compact'** in the header to summarize the conversation and reduce token usage.";
  }

  if (errorProviderId === "llamafile" && isLlamafileResolutionError(error)) {
    hasProviderHelp = true;
    o.events.emit("provider-help", {
      providerId: "llamafile",
      reason: error,
    });
  }

  if (
    errorProviderId === "transformers_js_local" &&
    isTransformersJsResolutionError(error)
  ) {
    hasProviderHelp = true;
    o.events.emit("provider-help", {
      providerId: "transformers_js_local",
      reason: error,
    });
  }

  if (!hasProviderHelp) {
    const helpType = detectProviderHelpType(
      errorProviderId,
      error,
      errorProviderConfig?.requiresApiKey !== false,
    );

    if (helpType) {
      o.events.emit("provider-help", {
        providerId: errorProviderId,
        reason: error,
        helpType,
      });
    }
  }

  await deliverResponse(o, db, groupId, `⚠️ Error: ${finalError}`);
});

WORKER_MESSAGE_HANDLERS.set("typing", (o, _db, payload) => {
  const { groupId } = payload;
  o.router?.setTyping(groupId, true);
  o.events.emit("typing", { groupId, typing: true });
});

WORKER_MESSAGE_HANDLERS.set("tool-activity", (o, _db, payload) => {
  o.events.emit("tool-activity", payload);

  if (
    (payload.tool === "write_file" && payload.status === "done") ||
    (payload.tool === "bash" && payload.status === "done")
  ) {
    o.events.emit("file-change", {
      groupId: payload.groupId,
    });
  }
});

WORKER_MESSAGE_HANDLERS.set("model-download-progress", (o, _db, payload) => {
  o.events.emit("model-download-progress", payload);
});

WORKER_MESSAGE_HANDLERS.set("thinking-log", (o, _db, payload) => {
  o.events.emit("thinking-log", payload);
});

WORKER_MESSAGE_HANDLERS.set("compact-done", async (o, db, payload) => {
  o.clearProviderRequest(payload.groupId);
  await o.handleCompactDone(db, payload.groupId, payload.summary);
});

WORKER_MESSAGE_HANDLERS.set("token-usage", (o, _db, payload) => {
  o.events.emit("token-usage", payload);
});

WORKER_MESSAGE_HANDLERS.set("clear-chat", async (o, db, payload) => {
  const { groupId } = payload;
  try {
    await o.newSession(db, groupId);
  } catch (err) {
    console.error("Failed to clear chat from agent:", err);
  }
});

WORKER_MESSAGE_HANDLERS.set("show-toast", (_o, _db, payload) => {
  const { message, type, duration } = payload;
  showToast(message, { type: type || "info", duration });
});

WORKER_MESSAGE_HANDLERS.set("mcp-reauth-required", async (o, db, payload) => {
  const { connectionId } = payload;
  const connection = await getRemoteMcpConnection(db, connectionId);
  const label = connection?.label || connectionId;

  if (connection?.autoReconnectOAuth) {
    showToast(
      `🔑 MCP connection "${label}" returned 401 — auto-reconnecting OAuth…`,
      { type: "info", duration: 5000 },
    );

    const result = await reconnectMcpOAuth(db, connectionId, {
      silentOnly: true,
    });

    if (result.success) {
      showToast(`🔑 OAuth reconnected for "${label}"`, {
        type: "success",
        duration: 5000,
      });
    } else {
      showToast(
        `🔑 OAuth auto-reconnect failed for "${label}": ${result.error}`,
        {
          action: {
            label: "Reconnect Now",
            onClick: async () => {
              const popupResult = await reconnectMcpOAuth(db, connectionId);
              if (popupResult.success) {
                showToast(`🔑 OAuth reconnected for "${label}"`, {
                  type: "success",
                  duration: 5000,
                });
              } else {
                showToast(
                  `🔑 OAuth reconnect failed for "${label}": ${popupResult.error}`,
                  { type: "error", duration: 10000 },
                );
              }
            },
          },
          duration: 15000,
          type: "error",
        },
      );
    }

    o.agentWorker?.postMessage({
      payload: { connectionId, success: result.success },
      type: "mcp-reauth-result",
    });
  } else {
    showToast(
      `🔑 MCP connection "${label}" returned 401 — OAuth re-authentication required. Go to Settings → Remote MCP to reconnect.`,
      { type: "warning", duration: 10000 },
    );

    o.agentWorker?.postMessage({
      payload: { connectionId, success: false },
      type: "mcp-reauth-result",
    });
  }

  o.events.emit("mcp-reauth-required", {
    connectionId,
    label,
  });
});

WORKER_MESSAGE_HANDLERS.set("manage-tools", async (o, db, payload) => {
  const { action, toolNames, profileId } = payload;
  if (action === "activate_profile" && profileId) {
    await toolsStore.activateProfile(db, profileId);
  } else if ((action === "enable" || action === "disable") && toolNames) {
    const enabled = action === "enable";
    for (const name of toolNames) {
      await toolsStore.setToolEnabled(db, name, enabled);
    }
  }

  const finalGroupId = payload.groupId || DEFAULT_GROUP_ID;
  o.agentWorker?.postMessage({
    type: "update-tools",
    payload: {
      enabledTools: toolsStore.enabledTools,
      groupId: finalGroupId,
      systemPromptOverride: toolsStore.systemPromptOverride,
    },
  });
});

WORKER_MESSAGE_HANDLERS.set("send-notification", (o, _db, payload) => {
  const { title, body, groupId: notifGroupId } = payload;

  if (notifGroupId && o.schedulerTriggeredGroups.has(notifGroupId)) {
    showToast(
      "⚠️ Notification blocked — scheduled tasks triggered via push cannot send push notifications (recursion prevention).",
      { type: "warning", duration: 8000 },
    );
    return;
  }

  getPushUrl("/push/broadcast").then((url) => {
    fetch(url, {
      body: JSON.stringify({ title, body }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch((err) =>
      console.error("Failed to broadcast push notification:", err),
    );
  });
});

// ── Virtual Machine ─────────────────────────────────────────────────────────

WORKER_MESSAGE_HANDLERS.set("vm-status", (o, _db, payload) => {
  o.vmStatus = { ...payload };
  o.events.emit("vm-status", o.vmStatus);
});

WORKER_MESSAGE_HANDLERS.set("vm-terminal-opened", (o, _db, payload) => {
  o.events.emit("vm-terminal-opened", payload);
});

WORKER_MESSAGE_HANDLERS.set("vm-terminal-output", (o, _db, payload) => {
  o.events.emit("vm-terminal-output", payload);
});

WORKER_MESSAGE_HANDLERS.set("vm-terminal-closed", (o, _db, payload) => {
  o.events.emit("vm-terminal-closed", payload);
});

WORKER_MESSAGE_HANDLERS.set("vm-workspace-synced", (o, _db, payload) => {
  o.events.emit("file-change", { groupId: payload?.groupId });
});

WORKER_MESSAGE_HANDLERS.set("vm-terminal-error", (o, _db, payload) => {
  o.events.emit("vm-terminal-error", payload);
});

// ── UI, Surfaces & Files ────────────────────────────────────────────────────

WORKER_MESSAGE_HANDLERS.set("open-file", (o, _db, payload) => {
  o.events.emit("open-file", payload);
});

WORKER_MESSAGE_HANDLERS.set("send-file", (o, _db, payload) => {
  const { groupId: sfGroupId, path: sfPath } = payload;
  (async () => {
    o.router?.setTyping(sfGroupId, true);
    try {
      await o.router?.send(sfGroupId, "", [
        {
          path: sfPath,
          fileName: sfPath.split("/").pop() || sfPath,
          mimeType: "application/octet-stream",
          size: 0,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("send-file: delivery failed:", err);
      showToast(`Failed to send file to peer: ${msg}`, {
        type: "error",
        duration: 6000,
      });
    } finally {
      o.router?.setTyping(sfGroupId, false);
    }
  })();
});

WORKER_MESSAGE_HANDLERS.set("render-component", (o, _db, payload) => {
  const { groupId: rcGroupId, envelope } = payload;

  o.events.emit("a2ui-surface", { groupId: rcGroupId, envelope });

  if (rcGroupId.startsWith("peer:")) {
    const channel = o.router?.findChannel(rcGroupId);
    if (channel && "sendA2UI" in channel) {
      (channel as any)
        .sendA2UI(rcGroupId, envelope)
        .catch((err: unknown) =>
          console.error("render-component: peer delivery failed:", err),
        );
    }
  }

  if (rcGroupId.startsWith("room:")) {
    o.roomManager.broadcastA2UI(roomIdFromGroupId(rcGroupId), envelope);
  }
});

WORKER_MESSAGE_HANDLERS.set("request-native-ai-task", (o, db, payload) => {
  const { id, groupId, taskType, input } = payload;

  (async () => {
    try {
      const onProgress = (p: any) => {
        o.events.emit("model-download-progress", {
          groupId,
          status: p.status,
          progress: p.progress,
          message: p.message,
        });
      };

      const inFlightInfo = groupId
        ? o.inFlightEffectiveProviderByGroup?.get(groupId)
        : undefined;
      const effectiveProviderId = inFlightInfo?.providerId || o.provider;
      const effectiveModel =
        inFlightInfo?.model ||
        inFlightInfo?.providerConfig?.defaultModel ||
        o.model;

      const apiKey = (await getApiKeyForRequest(o)) || "";
      const headers = getProviderRuntimeHeaders(o, effectiveProviderId, "");

      const result = await executeNativeAiTask({
        taskType,
        input,
        groupId,
        db,
        providerId: effectiveProviderId,
        model: effectiveModel,
        apiKey,
        headers,
        maxTokens: o.maxTokens,
        onProgress,
      });

      if (groupId) {
        o.events.emit("model-download-progress", {
          groupId,
          status: "done",
          progress: 1,
        });
      }

      const localResolvers = (globalThis as any).pendingNativeAiResolvers;
      if (localResolvers && localResolvers[id]) {
        localResolvers[id].resolve(result);
        delete localResolvers[id];
      }

      o.agentWorker?.postMessage({
        type: "native-ai-task-response",
        payload: { id, response: result },
      });
    } catch (err: any) {
      if (groupId) {
        o.events.emit("model-download-progress", {
          groupId,
          status: "error",
          progress: null,
          message: err?.message || String(err),
        });
      }

      const localResolvers = (globalThis as any).pendingNativeAiResolvers;
      if (localResolvers && localResolvers[id]) {
        localResolvers[id].reject(
          err instanceof Error ? err : new Error(String(err)),
        );
        delete localResolvers[id];
      }

      o.agentWorker?.postMessage({
        type: "native-ai-task-response",
        payload: { id, error: err?.message || String(err) },
      });
    }
  })();
});

WORKER_MESSAGE_HANDLERS.set("ask-user", (o, _db, payload) => {
  o.events.emit("ask-user", payload);
});

// ── Dispatcher Entry Point ──────────────────────────────────────────────────

export async function handleWorkerMessage(
  o: Orchestrator,
  db: ShadowClawDatabase,
  msg: any,
): Promise<void> {
  const handler = WORKER_MESSAGE_HANDLERS.get(msg?.type);
  if (handler) {
    await handler(o, db, msg?.payload, msg);
  }
}
