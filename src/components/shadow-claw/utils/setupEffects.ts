import { effect } from "../../../core/effect.js";

import { showSuccess } from "../../../ui/toast.js";
import { showPage } from "./showPage.js";
import { updateActivityLogToggleVisibility } from "./updateActivityLogToggleVisibility.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export function setupEffects(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  db: ShadowClawDatabase,
  oStore: OrchestratorStore,
) {
  if (!shadow) {
    return;
  }

  // React to orchestrator state for completion notifications
  effect(() => {
    const state = oStore.state;

    if (
      state === "idle" &&
      (shadowClaw.previousOrchestratorState === "thinking" ||
        shadowClaw.previousOrchestratorState === "responding")
    ) {
      showSuccess("Response complete", 2500);
    }

    shadowClaw.previousOrchestratorState = state;
  });

  // React to page changes from store
  effect(() => {
    const page = oStore.activePage;
    if (page !== shadowClaw.currentPage) {
      showPage(shadow, shadowClaw, db, oStore, page, false);
    }
  });

  // React to activityLog changes to show/hide the activity-log-toggle button.
  effect(() => {
    void oStore.activityLog; // track signal read
    updateActivityLogToggleVisibility(
      shadow,
      shadowClaw.currentPage,
      oStore.activityLog.length,
    );
  });
}
