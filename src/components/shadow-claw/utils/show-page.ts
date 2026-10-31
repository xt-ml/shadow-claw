import { resolvePageForVisibility } from "./resolve-page-for-visibility.js";
import { scheduleTerminalPlacement } from "./schedule-terminal-placement.js";
import { syncPageHeaderMainVisibilityOverride } from "./sync-page-header-main-visibility-override.js";
import { updateActivityLogToggleVisibility } from "./update-activity-log-toggle-visibility.js";
import { updateHeaderMainToggle } from "./update-header-main-toggle.js";
import { updateTerminalToggle } from "./update-terminal-toggle.js";

import { ensureComponentLoaded } from "./load-component.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";

/**
 * Map from page id to the custom element tag name used for that page.
 * Entries here must match the componentLoaders map in loadComponent.ts.
 */
const PAGE_ELEMENT_TAGS: Record<string, string> = {
  pages: "shadow-claw-pages",
  chat: "shadow-claw-chat",
  tasks: "shadow-claw-tasks",
  files: "shadow-claw-files",
  settings: "shadow-claw-settings",
  tools: "shadow-claw-tools",
  channels: "shadow-claw-channels",
};

/**
 * Stamp the page's custom element into its container div if the container is
 * currently empty. This is idempotent — calling it on an already-populated
 * container is a no-op.
 */
function ensurePageElementStamped(shadow: ShadowRoot, pageId: string): void {
  const tag = PAGE_ELEMENT_TAGS[pageId];
  if (!tag) {
    return; // file-viewer is handled separately
  }

  const container = shadow.querySelector(`[data-page-id="${pageId}"]`);
  if (!container || container.children.length > 0) {
    return; // already stamped
  }

  container.appendChild(document.createElement(tag));
}

export interface ShowPageContext {
  pagesSidebarHidden: boolean;
  chatSplitViewEnabled?: boolean;
  currentPage: string;
  terminalElement: any;
  terminalVisible: boolean;
  terminalPlacementFrame: number | null;
  headerMainCollapsedOverride: boolean | null;
  vmStatus: { ready: boolean; booting: boolean; bootAttempted: boolean };
  orchestrator?: any;
}

/**
 * Show a specific page
 */
export function showPage(
  shadow: ShadowRoot | null,
  shadowClaw: ShowPageContext,
  db: ShadowClawDatabase | undefined,
  oStore: OrchestratorStore,
  page: string,
  persist = true,
  resetScroll = true,
) {
  if (!shadow) {
    return;
  }

  const resolvedPage = resolvePageForVisibility(
    oStore,
    page,
    shadowClaw.pagesSidebarHidden,
    shadowClaw as any,
  );

  // Handle chat horizontal split view
  const isSplitActive =
    Boolean(shadowClaw.chatSplitViewEnabled) && resolvedPage !== "chat";

  const mainContent = shadow.querySelector(".main-content");
  const chatSplitResizeHandle = shadow.querySelector(
    ".chat-split-resize-handle",
  );

  if (isSplitActive) {
    void ensureComponentLoaded("conversations").catch(console.error);
    if (shadowClaw.orchestrator?.ensureWorkerReady) {
      void shadowClaw.orchestrator.ensureWorkerReady();
    }
    if (typeof oStore?.loadHistory === "function") {
      void oStore.loadHistory().catch(console.error);
    }

    const chatTag = PAGE_ELEMENT_TAGS.chat;
    if (chatTag && customElements.get(chatTag)) {
      ensurePageElementStamped(shadow, "chat");
    } else {
      void ensureComponentLoaded("chat")
        .then(() => {
          if (shadow) {
            ensurePageElementStamped(shadow, "chat");
          }
        })
        .catch(console.error);
    }

    if (mainContent) {
      mainContent.classList.add("split-chat-active");
    }
    if (chatSplitResizeHandle) {
      chatSplitResizeHandle.removeAttribute("hidden");
    }
  } else {
    if (mainContent) {
      mainContent.classList.remove("split-chat-active");
    }
    if (chatSplitResizeHandle) {
      chatSplitResizeHandle.setAttribute("hidden", "hidden");
    }
  }

  // Ensure the JS module import completes, then stamp the page element.
  // Stamping only after customElements.define guarantees the element constructor
  // attaches Shadow DOM synchronously upon creation.
  const tag = PAGE_ELEMENT_TAGS[resolvedPage];
  if (tag && customElements.get(tag)) {
    ensurePageElementStamped(shadow, resolvedPage);
    void ensureComponentLoaded(resolvedPage).catch(console.error);
  } else {
    void ensureComponentLoaded(resolvedPage)
      .then(() => {
        if (shadow) {
          ensurePageElementStamped(shadow, resolvedPage);
        }
      })
      .catch(console.error);
  }

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
  if (resetScroll) {
    const activePage = shadow.querySelector(".page.active");
    if (activePage) {
      const el = activePage;
      if (typeof el.scrollTo === "function") {
        el.scrollTo(0, 0);
      }
    }
  }

  // Check local AI onboarding and load dependencies when switching to the chat tab
  if (resolvedPage === "chat") {
    void ensureComponentLoaded("conversations").catch(console.error);
    if (shadowClaw.orchestrator?.ensureWorkerReady) {
      void shadowClaw.orchestrator.ensureWorkerReady();
    }
    if (typeof oStore?.loadHistory === "function") {
      void oStore.loadHistory().catch(console.error);
    }
    const chatComp = shadow.querySelector("shadow-claw-chat") as any;
    if (chatComp && typeof chatComp.checkPromptApiOnboarding === "function") {
      void chatComp.checkPromptApiOnboarding();
    }
  }

  // Load tasks and worker if switching to the tasks tab
  if (resolvedPage === "tasks") {
    if (shadowClaw.orchestrator?.ensureWorkerReady) {
      void shadowClaw.orchestrator.ensureWorkerReady();
    }
    if (db && typeof oStore?.loadTasks === "function") {
      void oStore.loadTasks(db).catch(console.error);
    }
  }

  // Auto-refresh files if switching to the files tab
  if (resolvedPage === "files" && db) {
    oStore.loadFiles(db).catch(console.error);
  }

  // Auto-refresh pages if switching to the pages tab
  if (resolvedPage === "pages") {
    const pagesComp = shadow.querySelector("shadow-claw-pages") as any;
    if (pagesComp && typeof pagesComp.renderSelectedPage === "function") {
      void pagesComp.renderSelectedPage();
      if (typeof pagesComp.setupAutoRefreshTimer === "function") {
        void pagesComp.setupAutoRefreshTimer();
      }
    }
  }
}
