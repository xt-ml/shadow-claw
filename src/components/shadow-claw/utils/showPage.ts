import { OrchestratorStore } from "../../../stores/orchestrator.js";

import { resolvePageForVisibility } from "./resolvePageForVisibility.js";
import { scheduleTerminalPlacement } from "./scheduleTerminalPlacement.js";
import { syncPageHeaderMainVisibilityOverride } from "./syncPageHeaderMainVisibilityOverride.js";
import { updateActivityLogToggleVisibility } from "./updateActivityLogToggleVisibility.js";
import { updateHeaderMainToggle } from "./updateHeaderMainToggle.js";
import { updateTerminalToggle } from "./updateTerminalToggle.js";

import type { ShadowClawDatabase } from "../../../db/types.js";

import { ShadowClaw } from "../shadow-claw.js";

/**
 * Show a specific page
 */
export function showPage(
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  db: ShadowClawDatabase,
  oStore: OrchestratorStore,
  page: string,
  persist = true,
) {
  if (!shadow) {
    return;
  }

  const resolvedPage = resolvePageForVisibility(
    oStore,
    page,
    shadowClaw.pagesSidebarHidden,
  );

  // Hide all pages
  shadow.querySelectorAll(".page").forEach((p) => {
    const el = p;
    el.classList.remove("active");
  });

  shadow.querySelectorAll(".nav-item").forEach((n) => {
    const el = n;
    el.classList.remove("active");
  });

  // Show selected page
  const pageEl = shadow.querySelector(`[data-page-id="${resolvedPage}"]`);
  if (pageEl) {
    const el = pageEl;
    el.classList.add("active");
  }

  const navEl = shadow.querySelector(`[data-page="${resolvedPage}"]`);
  if (navEl) {
    const el = navEl;
    el.classList.add("active");
  }

  shadowClaw.currentPage = resolvedPage;
  if (persist && db) {
    oStore.setActivePage(db, resolvedPage).catch(console.error);
  }

  scheduleTerminalPlacement(
    shadow,
    shadowClaw.currentPage,
    shadowClaw.terminalElement,
    shadowClaw.terminalVisible,
    shadowClaw.terminalPlacementFrame,
  );

  syncPageHeaderMainVisibilityOverride(
    shadow,
    shadowClaw.headerMainCollapsedOverride,
  );

  updateHeaderMainToggle(shadow, shadowClaw.headerMainCollapsedOverride);

  updateActivityLogToggleVisibility(
    shadow,
    shadowClaw.currentPage,
    oStore.activityLog.length,
  );

  updateTerminalToggle(
    shadow,
    shadowClaw.currentPage,
    shadowClaw.terminalVisible,
    shadowClaw.vmStatus,
  );

  // Scroll to top
  const activePage = shadow.querySelector(".page.active");
  if (activePage) {
    const el = activePage;
    if (typeof el.scrollTo === "function") {
      el.scrollTo(0, 0);
    }
  }

  // Auto-refresh files if switching to the files tab
  if (resolvedPage === "files" && db) {
    oStore.loadFiles(db).catch(console.error);
  }
}
