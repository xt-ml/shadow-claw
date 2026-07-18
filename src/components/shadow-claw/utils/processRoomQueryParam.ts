import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { Orchestrator } from "../../../core/orchestrator/orchestrator.js";
import { ulid } from "../../../utils/ulid.js";
import { showError, showSuccess } from "../../../ui/toast.js";
import { showPage } from "./showPage.js";

import type { ShadowClaw } from "../shadow-claw.js";

export async function processRoomQueryParam(
  win: Window,
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  db: ShadowClawDatabase,
  orchestrator: Orchestrator,
  oStore: OrchestratorStore,
): Promise<void> {
  if (!db) {
    return;
  }

  const currentUrl = new URL(window.location.href);
  const roomId = (currentUrl.searchParams.get("room") || "").trim();
  const hostPeerId = (currentUrl.searchParams.get("host") || "").trim();
  const roomName = (currentUrl.searchParams.get("name") || "").trim() || "Room";

  if (!roomId || !hostPeerId) {
    return;
  }

  try {
    // 1. Ensure PeerJS channel is enabled and the host is trusted
    const cfg = orchestrator.getPeerJsConfig();
    let myPeerId = cfg.myPeerId;
    if (!myPeerId) {
      myPeerId = ulid().toLowerCase();
    }

    const trusted = new Set(cfg.trustedPeerIds);
    trusted.add(hostPeerId);

    await orchestrator.configurePeerJs(
      db,
      myPeerId,
      Array.from(trusted),
      cfg.serverHost,
      cfg.serverPort,
      cfg.serverPath,
      cfg.serverSecure,
    );

    if (!cfg.enabled) {
      await orchestrator.setChannelEnabled(db, "peerjs", true);
    }

    // 2. Join the room (connects to host + announces membership)
    orchestrator.joinRoomViaLink(roomId, hostPeerId, roomName);

    // 3. Navigate to the room conversation
    await oStore.switchConversation(db, `room:${roomId}`);
    showPage(shadow, shadowClaw, db, oStore, "chat");

    // 4. Clean the URL to prevent re-triggering
    currentUrl.searchParams.delete("room");
    currentUrl.searchParams.delete("host");
    currentUrl.searchParams.delete("name");
    const cleaned = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    win.history.replaceState({}, "", cleaned || "/");

    showSuccess(`Joined room "${roomName}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(`Failed to join room: ${message}`, 6000);
  }
}
