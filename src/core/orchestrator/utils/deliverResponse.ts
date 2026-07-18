import { saveMessage } from "../../../db/saveMessage.js";
import { playNotificationChime } from "../../../ui/audio.js";
import { ulid } from "../../../utils/ulid.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

export async function deliverIntermediateResponse(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
  groupId: string,
  text: string,
): Promise<void> {
  const channelType = orchestrator.getChannelTypeForGroup(groupId);
  const stored = {
    channel: channelType,
    content: text,
    groupId,
    id: ulid(),
    isFromMe: true,
    isTrigger: false,
    sender: orchestrator.assistantName,
    timestamp: Date.now(),
  };

  await saveMessage(db, stored);

  if (channelType !== "browser") {
    try {
      await orchestrator.router?.send(groupId, text);
    } catch (error) {
      const deliveryError =
        error instanceof Error ? error : new Error(String(error));

      console.error(
        "Failed to deliver intermediate channel response:",
        deliveryError,
      );

      orchestrator.events.emit("error", {
        groupId,
        error: `Failed to deliver response to ${channelType}: ${deliveryError.message}`,
      });
    }
  }

  orchestrator.events.emit("message", stored);
}

export async function deliverResponse(
  orchestrator: Orchestrator,
  db: ShadowClawDatabase,
  groupId: string,
  text: string,
): Promise<void> {
  const stored = {
    channel: orchestrator.getChannelTypeForGroup(groupId),
    content: text,
    groupId,
    id: ulid(),
    isFromMe: true,
    isTrigger: false,
    sender: orchestrator.assistantName,
    timestamp: Date.now(),
  };

  await saveMessage(db, stored);

  let deliveryError: Error | null = null;
  try {
    await orchestrator.router?.send(groupId, text);
  } catch (error) {
    deliveryError = error instanceof Error ? error : new Error(String(error));

    console.error("Failed to deliver channel response:", deliveryError);
  }

  if (orchestrator.pendingScheduledTasks.has(groupId)) {
    orchestrator.pendingScheduledTasks.delete(groupId);

    playNotificationChime();
  }

  orchestrator.events.emit("message", stored);
  orchestrator.events.emit("typing", { groupId, typing: false });

  orchestrator.setState("idle", groupId);
  orchestrator.router?.setTyping(groupId, false);

  // ── A2A task completion for peer channels ──────────────────────────────
  // After delivering a response to a peer, mark the A2A task as COMPLETED.
  // This sends a terminal `tasks/statusUpdate` notification to the remote peer,
  // signaling that no further responses are expected from this side.
  if (groupId.startsWith("peer:") && !deliveryError) {
    const completed = orchestrator.peerjs.completeActiveTask(groupId);
    if (completed) {
      orchestrator.peerCompletedContexts.add(groupId);
    }
  }

  if (deliveryError) {
    orchestrator.events.emit("error", {
      groupId,
      error: `Failed to deliver response to ${orchestrator.getChannelTypeForGroup(groupId)}: ${deliveryError.message}`,
    });
  }
}
