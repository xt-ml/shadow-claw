import { detectProviderHelpType } from "../../../components/common/help/providers.js";
import { getProvider } from "../../../config/config.js";
import { persistMessageAttachments } from "../../../content/message-attachments.js";
import { listGroups } from "../../../db/groups.js";
import { saveMessage } from "../../../db/saveMessage.js";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { InboundMessage } from "../../../subsystems/channels/types.js";
import type { Orchestrator } from "../orchestrator.js";

export async function enqueue(
  o: Orchestrator,
  db: ShadowClawDatabase,
  msg: InboundMessage,
): Promise<void> {
  // ── A2UI inbound dispatch ────────────────────────────────────────────────
  // Surface envelopes and actions arrive via the peer channel. Emit them so
  // the UI layer can render/update surfaces, then fall through to persist the
  // message normally (so the conversation history is complete).
  if (msg.a2uiEnvelopes && msg.a2uiEnvelopes.length > 0) {
    for (const envelope of msg.a2uiEnvelopes) {
      o.events.emit("a2ui-surface", {
        groupId: msg.groupId,
        envelope,
      });
    }
  }

  if (msg.a2uiAction) {
    o.events.emit("a2ui-action", {
      groupId: msg.groupId,
      action: msg.a2uiAction,
    });
  }

  // If there's nothing else in the message (no text, no attachments, only
  // A2UI parts), skip the rest of the enqueue flow.
  const hasTextContent = !!msg.content;
  const hasAttachments = (msg.attachments?.length ?? 0) > 0;
  if (
    !hasTextContent &&
    !hasAttachments &&
    (msg.a2uiEnvelopes?.length ?? 0) > 0
  ) {
    return;
  }

  // ── Normal message handling ──────────────────────────────────────────────
  const directToolCommand = o.parseDirectToolCommand(msg);
  const isFromBrowser = msg.channel === "browser"; // Messages submitted in ShadowClaw UI
  const autoTrigger = o.channelRegistry.shouldAutoTrigger(msg.groupId);

  let hasTrigger = false;

  if (msg.channel === "browser" || msg.groupId.startsWith("room:")) {
    hasTrigger = o.triggerPattern.test(msg.content.trim());
  }

  // ── A2A task-state conversation termination ──────────────────────────────
  // If the local user sends a new message in a completed peer conversation,
  // reopen it (clear the terminal state) so the agent will respond again.
  if (isFromBrowser && msg.groupId.startsWith("peer:")) {
    o.peerCompletedContexts.delete(msg.groupId);
  }

  const isDirectToolCommand = !!directToolCommand;

  // Check for explicit peer ID mention (works for both local and remote)
  if (!hasTrigger && o.peerjsMyPeerId) {
    if (msg.content.includes(`@${o.peerjsMyPeerId}`)) {
      hasTrigger = true;
    } else if (o.peerjsMyAlias && msg.content.includes(`@${o.peerjsMyAlias}`)) {
      // Also respond to @<my-alias> so peers can use the friendly name
      hasTrigger = true;
    } else {
      // Also check if any alias maps to o.peerjsMyPeerId
      for (const [alias, rawId] of Object.entries(o.peerjsPeerAliases)) {
        if (rawId === o.peerjsMyPeerId && msg.content.includes(`@${alias}`)) {
          hasTrigger = true;

          break;
        }
      }
    }
  }

  // Always trigger the agent for scheduled tasks
  if (msg.content.trim().startsWith("[SCHEDULED TASK]")) {
    hasTrigger = true;
  }

  // Always trigger the owning agent to process an A2UI surface action. These
  // `[A2UI ACTION]` messages are only ever constructed on the surface owner's
  // side (local click on an owned surface, or an inbound `room/a2ui-action`
  // for a surface we own), so force-triggering here is safe and keeps shared
  // surfaces owner-authoritative.
  if (msg.content.trim().startsWith("[A2UI ACTION]")) {
    hasTrigger = true;
  }

  let isTrigger = false;
  if (isDirectToolCommand) {
    isTrigger = true;
  } else if (hasTrigger) {
    isTrigger = true;
  } else if (isFromBrowser) {
    // Messages from the local UI trigger the agent by default,
    // EXCEPT in P2P / room channels where we just want to chat with peers.
    if (msg.groupId.startsWith("peer:") || msg.groupId.startsWith("room:")) {
      isTrigger = false;
    } else {
      isTrigger = true;
    }
  } else {
    isTrigger = autoTrigger;
  }

  // ── A2A terminal-state suppression ───────────────────────────────────────
  // If the peer conversation's task has reached a terminal state (COMPLETED,
  // FAILED, CANCELED) via A2A protocol, suppress auto-trigger. The human
  // user can reopen by sending a new message from the browser UI.
  if (
    isTrigger &&
    !isFromBrowser &&
    msg.groupId.startsWith("peer:") &&
    o.peerCompletedContexts.has(msg.groupId)
  ) {
    isTrigger = false;
  }

  const attachments = await persistMessageAttachments(
    db,
    msg.groupId,
    msg.attachments || [],
  );

  const stored = {
    ...msg,
    attachments,
    isFromMe: false,
    isTrigger,
  };

  if (isTrigger && !isDirectToolCommand) {
    o.messageQueue.push(msg);
  }

  await saveMessage(db, stored);
  o.events.emit("message", stored);

  // Keep peer typing state in sync, but do not treat every P2P chat message
  // as an agent response. Normal peer messages should not force the remote
  // peer into a temporary "responding" state.
  if (msg.channel === "peerjs") {
    o.clearPeerJsTypingState(msg.groupId);
  }

  // Forward browser messages to the P2P / room channel so users can chat directly
  if (
    isFromBrowser &&
    (msg.groupId.startsWith("peer:") || msg.groupId.startsWith("room:"))
  ) {
    o.router?.send(msg.groupId, msg.content, attachments).catch((err) => {
      console.error("Failed to route browser message to peer:", err);
    });
  }

  if (directToolCommand && o.agentWorker) {
    o.agentWorker.postMessage({
      type: "execute-direct-tool",
      payload: {
        groupId: msg.groupId,
        name: directToolCommand.toolName,
        input: directToolCommand.input,
      },
    });

    return;
  }

  o.processQueue(db);
}

export async function processQueue(
  o: Orchestrator,
  db: ShadowClawDatabase,
): Promise<void> {
  if (o.processing) {
    return;
  }

  if (o.messageQueue.length === 0) {
    return;
  }

  // Look up the effective provider for the next message's group
  const nextMsg = o.messageQueue[0];
  const nextGroupId = nextMsg?.groupId;

  let effectiveProviderConfig = o.providerConfig;
  let effectiveProviderId = o.provider;

  if (nextGroupId) {
    try {
      const groups = await listGroups(db);
      const grp = groups.find((g) => g.groupId === nextGroupId);
      if (grp?.pinnedProvider) {
        const pinned = getProvider(grp.pinnedProvider);
        if (pinned) {
          effectiveProviderConfig = pinned;
          effectiveProviderId = grp.pinnedProvider;
        }
      }
    } catch {
      // best-effort
    }
  }

  const requiresApiKey = effectiveProviderConfig?.requiresApiKey !== false;
  let apiKeyPresent = true;
  if (requiresApiKey) {
    if (effectiveProviderId === o.provider) {
      apiKeyPresent = !!(await o.getApiKeyForRequest());
    } else {
      apiKeyPresent = !!(await o.getApiKeyForSpecificProvider(
        db,
        effectiveProviderId,
      ));
    }
  }

  if (requiresApiKey && !apiKeyPresent) {
    const reason =
      "API key not configured. Go to Settings to add your API key.";

    o.events.emit("provider-help", {
      providerId: effectiveProviderId,
      reason,
      helpType: detectProviderHelpType(
        effectiveProviderId,
        reason,
        requiresApiKey,
      ),
    });

    const msg = o.messageQueue.shift()!;
    o.events.emit("error", {
      groupId: msg.groupId,
      error: reason,
    });

    return;
  }

  o.processing = true;
  const msg = o.messageQueue.shift()!;

  try {
    await o.invokeAgent(db, msg.groupId, msg.content);
  } catch (err) {
    console.error("Failed to invoke agent:", err);
  } finally {
    o.processing = false;
    if (o.messageQueue.length > 0) {
      o.processQueue(db);
    }
  }
}
