import { effect } from "../../../core/effect.js";

import { showSuccess } from "../../../ui/toast.js";
import { showPage } from "./showPage.js";
import { updateActivityLogToggleVisibility } from "./updateActivityLogToggleVisibility.js";
import { ensureComponentLoaded } from "./loadComponent.js";
import { fileViewerStore } from "../../../stores/file-viewer.js";

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

  // React to file viewer state to lazily load and stamp viewer components
  effect(() => {
    const file = fileViewerStore.file;
    if (file) {
      ensureComponentLoaded("file-viewer")
        .then(() => {
          // Stamp the file-viewer element into the DOM on first use if it
          // was not pre-stamped in the static template.
          if (shadow && !shadow.querySelector("shadow-claw-file-viewer")) {
            const main = shadow.querySelector(".main-content");
            if (main) {
              const viewer = document.createElement("shadow-claw-file-viewer");
              viewer.id = "file-viewer";
              main.appendChild(viewer);
            }
          }
        })
        .catch(console.error);

      if (file.kind === "pdf") {
        ensureComponentLoaded("pdf-viewer").catch(console.error);
      }
    }
  });

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
