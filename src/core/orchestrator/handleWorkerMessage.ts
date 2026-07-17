import { deleteTask } from "../../db/deleteTask.js";
import { getAllTasks } from "../../db/getAllTasks.js";
import { saveTask } from "../../db/saveTask.js";

import { getPushUrl } from "../../subsystems/notifications/push-client.js";
import { isLlamafileResolutionError } from "../../components/common/help/llamafile.js";
import { detectProviderHelpType } from "../../components/common/help/providers.js";
import { isTransformersJsResolutionError } from "../../components/common/help/transformers.js";
import { getRemoteMcpConnection } from "../../subsystems/mcp/mcp-connections.js";
import { reconnectMcpOAuth } from "../../subsystems/mcp/mcp-reconnect.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { toolsStore } from "../../stores/tools.js";
import { showToast } from "../../ui/toast.js";
import { DEFAULT_GROUP_ID } from "../../config/config.js";
import { roomIdFromGroupId } from "../../db/rooms.js";

import type { ShadowClawDatabase } from "../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

export async function handleWorkerMessage(
  o: Orchestrator,
  db: ShadowClawDatabase,
  msg: any,
): Promise<void> {
  switch (msg.type) {
    case "response": {
      const { groupId, text } = msg.payload;
      o.stopTransformersProgressPolling(groupId);
      o.clearProviderRequest(groupId);
      o.inFlightTriggerByGroup.delete(groupId);
      o.inFlightEffectiveProviderByGroup.delete(groupId);

      await o.deliverResponse(db, groupId, text);

      break;
    }

    case "streaming-start": {
      const { groupId } = msg.payload;
      o.setState("responding", groupId);
      o.events.emit("streaming-start", { groupId });

      break;
    }

    case "streaming-chunk": {
      const { groupId, text } = msg.payload;
      o.events.emit("streaming-chunk", { groupId, text });

      break;
    }

    case "intermediate-response": {
      const { groupId, text } = msg.payload;
      await o.deliverIntermediateResponse(db, groupId, text);

      break;
    }

    case "streaming-end": {
      const { groupId } = msg.payload;
      o.events.emit("streaming-end", { groupId });

      // Switch back to thinking (tool calls are about to execute)
      o.setState("thinking", groupId);

      break;
    }

    case "streaming-done": {
      const { groupId } = msg.payload;
      o.events.emit("streaming-done", { groupId });

      break;
    }

    case "streaming-error": {
      const { groupId, error } = msg.payload;
      o.events.emit("streaming-error", { groupId, error });

      break;
    }

    case "run-task": {
      const { task } = msg.payload;
      orchestratorStore.runTask(task, true);

      break;
    }

    case "task-created": {
      const { task } = msg.payload;

      if (task.groupId && o._schedulerTriggeredGroups.has(task.groupId)) {
        showToast(
          "\u26a0\ufe0f Task creation blocked \u2014 scheduled tasks cannot create new tasks (recursion prevention).",
          { type: "warning", duration: 8000 },
        );

        break;
      }

      try {
        const serverOk = await o._syncTaskToServer(task);

        if (!serverOk) {
          showToast("Failed to sync task to server — task was not saved.", {
            type: "error",
          });

          break;
        }

        await saveTask(db, task);

        o.events.emit("task-change", { type: "created", task });
      } catch (err) {
        console.error("Failed to save task from agent:", err);
        showToast("Failed to save task.", { type: "error" });
      }

      break;
    }

    case "room-action": {
      const action = msg.payload?.action;

      try {
        if (action === "create") {
          o.createRoom(String(msg.payload.name || "").trim());
        } else if (action === "invite") {
          o.inviteToRoom(
            String(msg.payload.roomId),
            String(msg.payload.peerId),
          );
        } else if (action === "leave") {
          o.leaveRoom(String(msg.payload.roomId));
        }
      } catch (err) {
        console.error("Failed to handle room action from agent:", err);
      }

      break;
    }

    case "error": {
      const { groupId, error } = msg.payload;
      o.stopTransformersProgressPolling(groupId);
      o.clearProviderRequest(groupId);
      o.inFlightTriggerByGroup.delete(groupId);

      let finalError = error;
      let hasProviderHelp = false;

      // Use the effective provider that was active when this invocation started
      const inFlightProvider =
        o.inFlightEffectiveProviderByGroup.get(groupId);

      o.inFlightEffectiveProviderByGroup.delete(groupId);

      const errorProviderId =
        inFlightProvider?.providerId ?? o.getProvider();

      const errorProviderConfig =
        inFlightProvider?.providerConfig ?? o.providerConfig;

      // Detect context limit/request too large errors (HTTP 413 or specific error codes)
      const isContextError =
        error.includes("413") ||
        error.includes("tokens_limit_reached") ||
        error.includes("context_length_exceeded") ||
        error.includes("too many tokens");

      if (isContextError) {
        finalError +=
          "\n\n\u26a0\ufe0f This model has a small context window. Try clicking **'Compact'** in the header to summarize the conversation and reduce token usage.";
      }

      if (
        errorProviderId === "llamafile" &&
        isLlamafileResolutionError(error)
      ) {
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

      await o.deliverResponse(db, groupId, `⚠️ Error: ${finalError}`);

      break;
    }

    case "typing": {
      const { groupId } = msg.payload;
      o.router?.setTyping(groupId, true);
      o.events.emit("typing", { groupId, typing: true });

      break;
    }

    case "tool-activity": {
      o.events.emit("tool-activity", msg.payload);

      // If a file was written, or bash finished (might have changed files), emit file-change
      if (
        (msg.payload.tool === "write_file" &&
          msg.payload.status === "done") ||
        (msg.payload.tool === "bash" && msg.payload.status === "done")
      ) {
        o.events.emit("file-change", {
          groupId: msg.payload.groupId,
        });
      }

      break;
    }

    case "model-download-progress": {
      o.events.emit("model-download-progress", msg.payload);

      break;
    }

    case "thinking-log": {
      o.events.emit("thinking-log", msg.payload);

      break;
    }

    case "compact-done": {
      o.clearProviderRequest(msg.payload.groupId);

      await o.handleCompactDone(
        db,
        msg.payload.groupId,
        msg.payload.summary,
      );

      break;
    }

    case "token-usage": {
      o.events.emit("token-usage", msg.payload);

      break;
    }

    case "task-list-request": {
      const { groupId } = msg.payload;
      const tasks = await getAllTasks(db);
      const groupTasks = tasks.filter((t: any) => t.groupId === groupId);

      o.agentWorker?.postMessage({
        type: "task-list-response",
        payload: { groupId, tasks: groupTasks },
      });

      break;
    }

    case "update-task": {
      const { task } = msg.payload;

      if (task.groupId && o._schedulerTriggeredGroups.has(task.groupId)) {
        showToast(
          "\u26a0\ufe0f Task update blocked \u2014 scheduled tasks cannot modify tasks (recursion prevention).",
          { type: "warning", duration: 8000 },
        );

        break;
      }

      try {
        const serverOk = await o._syncTaskToServer(task);

        if (!serverOk) {
          showToast(
            "Failed to sync task update to server — task was not updated.",
            { type: "error" },
          );

          break;
        }

        await saveTask(db, task);

        o.events.emit("task-change", { type: "updated", task });
      } catch (err) {
        console.error("Failed to update task from agent:", err);
        showToast("Failed to update task.", { type: "error" });
      }

      break;
    }

    case "delete-task": {
      const { id, groupId: deleteGroupId } = msg.payload;

      if (
        deleteGroupId &&
        o._schedulerTriggeredGroups.has(deleteGroupId)
      ) {
        showToast(
          "\u26a0\ufe0f Task deletion blocked \u2014 scheduled tasks cannot delete tasks (recursion prevention).",
          { type: "warning", duration: 8000 },
        );

        break;
      }

      try {
        const serverOk = await o._deleteTaskFromServer(id);

        if (!serverOk) {
          showToast(
            "Failed to delete task from server — task kept in view.",
            { type: "error" },
          );

          break;
        }

        await deleteTask(db, id);

        o.events.emit("task-change", { type: "deleted", id });
      } catch (err) {
        console.error("Failed to delete task from agent:", err);
      }

      break;
    }

    case "clear-chat": {
      const { groupId } = msg.payload;
      try {
        await o.newSession(db, groupId);
      } catch (err) {
        console.error("Failed to clear chat from agent:", err);
      }

      break;
    }

    case "show-toast": {
      const { message, type, duration } = msg.payload;
      showToast(message, { type: type || "info", duration });

      break;
    }

    case "mcp-reauth-required": {
      const { connectionId } = msg.payload;

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
                  const popupResult = await reconnectMcpOAuth(
                    db,
                    connectionId,
                  );
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

      break;
    }

    case "manage-tools": {
      const { action, toolNames, profileId } = msg.payload;
      if (action === "activate_profile" && profileId) {
        await toolsStore.activateProfile(db, profileId);
      } else if ((action === "enable" || action === "disable") && toolNames) {
        const enabled = action === "enable";
        for (const name of toolNames) {
          await toolsStore.setToolEnabled(db, name, enabled);
        }
      }

      const finalGroupId = msg.payload.groupId || DEFAULT_GROUP_ID;
      o.agentWorker?.postMessage({
        type: "update-tools",
        payload: {
          enabledTools: toolsStore.enabledTools,
          groupId: finalGroupId,
          systemPromptOverride: toolsStore.systemPromptOverride,
        },
      });

      break;
    }

    case "send-notification": {
      const { title, body, groupId: notifGroupId } = msg.payload;

      // Recursion guard: push-triggered tasks must NEVER send push
      // notifications — this would create an infinite loop.
      if (notifGroupId && o._schedulerTriggeredGroups.has(notifGroupId)) {
        showToast(
          "⚠️ Notification blocked — scheduled tasks triggered via push cannot send push notifications (recursion prevention).",
          { type: "warning", duration: 8000 },
        );

        break;
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

      break;
    }

    case "vm-status": {
      o.vmStatus = { ...msg.payload };
      o.events.emit("vm-status", o.vmStatus);

      break;
    }

    case "vm-terminal-opened": {
      o.events.emit("vm-terminal-opened", msg.payload);

      break;
    }

    case "vm-terminal-output": {
      o.events.emit("vm-terminal-output", msg.payload);

      break;
    }

    case "vm-terminal-closed": {
      o.events.emit("vm-terminal-closed", msg.payload);

      break;
    }

    case "vm-workspace-synced": {
      o.events.emit("file-change", { groupId: msg.payload?.groupId });

      break;
    }

    case "vm-terminal-error": {
      o.events.emit("vm-terminal-error", msg.payload);

      break;
    }

    case "open-file": {
      o.events.emit("open-file", msg.payload);

      break;
    }

    case "send-file": {
      const { groupId: sfGroupId, path: sfPath } = msg.payload;
      // Fire-and-forget so we don't block the agent loop.
      // The file is sent as an attachment over the PeerJS channel.
      (async () => {
        // Signal to the remote peer that we are doing something
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

      break;
    }

    case "render-component": {
      const { groupId: rcGroupId, envelope } = msg.payload;

      // Always emit locally so the local UI renderer can display the surface.
      o.events.emit("a2ui-surface", { groupId: rcGroupId, envelope });

      // Forward over the WebRTC channel when targeting a peer conversation.
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

      // Broadcast to every member when targeting a multi-party room. The
      // local peer becomes the owner of this surface (owner-authoritative).
      if (rcGroupId.startsWith("room:")) {
        o.roomManager.broadcastA2UI(
          roomIdFromGroupId(rcGroupId),
          envelope,
        );
      }

      break;
    }

    case "ask-user": {
      o.events.emit("ask-user", msg.payload);

      break;
    }
  }
}
