import { applyPagesSidebarVisibility } from "./applyPagesSidebarVisibility.js";
import { getDefaultSidebarPage } from "./getDefaultSidebarPage.js";
import { showPage } from "./showPage.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export function setPagesSidebarHidden(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  oStore: OrchestratorStore,
  db: ShadowClawDatabase,
  hidden: boolean,
) {
  shadowClaw.pagesSidebarHidden = hidden;
  applyPagesSidebarVisibility(shadow, shadowClaw);

  if (hidden && shadowClaw.currentPage === "pages") {
    showPage(shadow, shadowClaw, db, oStore, getDefaultSidebarPage(oStore));
  }
}
