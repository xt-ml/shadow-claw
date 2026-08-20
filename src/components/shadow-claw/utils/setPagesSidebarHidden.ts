import {
  applySidebarNavVisibility,
  SidebarNavPage,
} from "./sidebarVisibility.js";
import { getDefaultSidebarPage } from "./getDefaultSidebarPage.js";
import { showPage } from "./showPage.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ShadowClaw } from "../shadow-claw.js";

export function setSidebarNavHidden(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  oStore: OrchestratorStore,
  db: ShadowClawDatabase,
  page: SidebarNavPage,
  hidden: boolean,
) {
  switch (page) {
    case "pages":
      shadowClaw.pagesSidebarHidden = hidden;
      break;
    case "chat":
      shadowClaw.chatSidebarHidden = hidden;
      break;
    case "tasks":
      shadowClaw.tasksSidebarHidden = hidden;
      break;
    case "files":
      shadowClaw.filesSidebarHidden = hidden;
      break;
  }

  applySidebarNavVisibility(shadow, page, hidden);

  if (hidden && shadowClaw.currentPage === page) {
    showPage(
      shadow,
      shadowClaw,
      db,
      oStore,
      getDefaultSidebarPage(oStore, shadowClaw),
    );
  }
}

export function setPagesSidebarHidden(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  oStore: OrchestratorStore,
  db: ShadowClawDatabase,
  hidden: boolean,
) {
  setSidebarNavHidden(shadow, shadowClaw, oStore, db, "pages", hidden);
}
