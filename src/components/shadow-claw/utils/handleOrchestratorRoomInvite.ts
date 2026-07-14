import { RoomInvitePayload } from "../../../subsystems/channels/peer-protocol.js";
import { showError, showSuccess } from "../../../ui/toast.js";
import { requestDialog } from "./requestDialog.js";
import { showPage } from "./showPage.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function handleOrchestratorRoomInvite(
  doc: Document,
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  db: ShadowClawDatabase,
  oStore: OrchestratorStore,
  invite: RoomInvitePayload,
) {
  if (!db || !invite?.roomId || !invite?.hostPeerId) {
    return;
  }

  const from = invite.fromAlias || invite.fromPeerId;
  const accepted = await requestDialog(doc, shadow, {
    mode: "confirm",
    title: "Room invitation",
    message: `${from} invited you to join "${invite.roomName}".`,
    confirmLabel: "Join",
    cancelLabel: "Decline",
  });

  if (!accepted) {
    return;
  }

  try {
    shadowClaw.orchestrator.joinRoomViaLink(
      invite.roomId,
      invite.hostPeerId,
      invite.roomName,
    );

    await oStore.switchConversation(db, `room:${invite.roomId}`);

    showPage(shadow, shadowClaw, db, oStore, "chat");
    showSuccess(`Joined room "${invite.roomName}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(`Failed to join room: ${message}`, 6000);
  }
}
