import { ulid } from "../../../utils/ulid.js";
import { showPage } from "../utils/showPage.js";

import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess } from "../../../ui/toast.js";

import type { Orchestrator } from "../../../core/orchestrator/orchestrator.js";
import type { ShadowClawDatabase } from "../../../db/db.js";
import type { ShadowClaw } from "../shadow-claw.js";

export async function processPeerQueryParam(
  shadow: ShadowRoot,
  shadowClaw: ShadowClaw,
  db: ShadowClawDatabase | null,
  orchestrator: Orchestrator,
): Promise<void> {
  if (!db) {
    return;
  }

  const currentUrl = new URL(window.location.href);
  const peerParam = currentUrl.searchParams.get("peer");
  if (!peerParam) {
    return;
  }

  const remotePeerId = peerParam.trim();
  if (!remotePeerId) {
    return;
  }

  try {
    // 1. Ensure PeerJS channel is enabled and configured
    const cfg = orchestrator.getPeerJsConfig();
    let myPeerId = cfg.myPeerId;
    if (!myPeerId) {
      myPeerId = ulid().toLowerCase();
    }

    // Automatically trust the remote peer we are connecting to
    const trusted = new Set(cfg.trustedPeerIds);
    trusted.add(remotePeerId);

    // Save/configure
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

    // 2. Ensure peer conversation exists in the list
    const targetGroupId = await orchestratorStore.ensurePeerConversation(
      db,
      remotePeerId,
    );

    // 3. Switch conversation and navigate to chat
    await orchestratorStore.switchConversation(db, targetGroupId);
    showPage(shadow, shadowClaw, db, orchestratorStore, "chat");

    // 4. Remove 'peer' from URL params to prevent re-triggering
    currentUrl.searchParams.delete("peer");
    const cleaned = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.history.replaceState({}, "", cleaned || "/");

    showSuccess(`Connected to Peer: ${remotePeerId.substring(0, 8)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(`Failed to process peer parameter: ${message}`, 6000);
  }
}
