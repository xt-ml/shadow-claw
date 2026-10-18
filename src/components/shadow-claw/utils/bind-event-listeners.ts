import { Themes } from "../../../stores/theme.js";
import { applyRouteFromCurrentLocation } from "./apply-route-from-current-location.js";
import { recordHistoryReplaceState } from "./get-route.js";
import { getDefaultSidebarPage } from "./get-default-sidebar-page.js";
import { initSidebarResize } from "./init-sidebar-resize.js";
import { requestDialog } from "./request-dialog.js";
import { scheduleTerminalPlacement } from "./schedule-terminal-placement.js";
import {
  setPagesSidebarHidden,
  setSidebarNavHidden,
} from "./set-pages-sidebar-hidden.js";
import { showPage } from "./show-page.js";
import { supportsNavigationApi } from "./supports-navigation-api.js";
import { setupAppLifecycle } from "./setup-app-lifecycle.js";
import { syncPageHeaderMainVisibilityOverride } from "./sync-page-header-main-visibility-override.js";
import { setupSlottedSidebarActiveLinks } from "./sync-slotted-sidebar-active-links.js";

import { toggleActivityLogVisibility } from "./toggle-activity-log-visibility.js";
import { togglePageHeaderMainVisibility } from "./toggle-page-header-main-visibility.js";
import { toggleTerminalVisibility } from "./toggle-terminal-visibility.js";

import { updateHeaderMainToggle } from "./update-header-main-toggle.js";
import { updateHostTheme } from "./update-host-theme.js";
import { updateThemeIcons } from "./update-theme-icons.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { FileViewerStore } from "../../../stores/file-viewer.js";
import type { OrchestratorStore } from "../../../stores/orchestrator.js";
import type { ThemeStore } from "../../../stores/theme.js";
import type { ShadowClaw } from "../shadow-claw.js";

export function bindEventListeners(
  win: Window,
  doc: Document,
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  db: ShadowClawDatabase,
  oStore: OrchestratorStore,
  fStore: FileViewerStore,
  tStore: ThemeStore,
  _url?: URL,
): void {
  if (!shadow || !win || !doc) {
    return;
  }

  // Navigation items
  shadow.querySelectorAll(".nav-item[data-page]").forEach((item: Element) => {
    const lItem = item as HTMLLIElement;
    lItem.addEventListener("click", () => {
      const page = lItem.dataset.page || getDefaultSidebarPage(oStore);

      // Apply the active class immediately so the browser can commit a paint
      // frame showing the selection highlight (this is the INP "next paint").
      // The actual page switch — which may create/upgrade a component and read
      // IndexedDB — is deferred to a separate task via setTimeout so it does
      // not block that first paint frame.
      shadow
        .querySelectorAll(".nav-item")
        .forEach((n) => n.classList.remove("active"));
      lItem.classList.add("active");

      setTimeout(() => {
        doc.dispatchEvent(
          new CustomEvent("shadow-claw-navigate", {
            detail: { page },
            bubbles: true,
            composed: true,
          }),
        );
      }, 0);
    });
  });

  // Menu toggle logic
  const menuButton = shadow.getElementById("menu-button");
  const sidebar = shadow.querySelector(".sidebar");

  if (menuButton && sidebar) {
    menuButton.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });

    // Close sidebar when an item is tapped (only on mobile)
    shadow.querySelectorAll(".nav-item, .settings-btn").forEach((item) => {
      item.addEventListener("click", () => {
        if (win.innerWidth < 896) {
          sidebar.classList.remove("open");
        }
      });
    });

    sidebar.addEventListener("click", (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (
        win.innerWidth < 896 &&
        target?.closest("a, button, .nav-item, .sidebar-link, .sidebar-item")
      ) {
        sidebar.classList.remove("open");
      }
    });

    if (typeof (shadowClaw as any)?.addEventListener === "function") {
      shadowClaw.addEventListener("click", (e: Event) => {
        const target = e.target as HTMLElement | null;
        if (
          win.innerWidth < 896 &&
          target?.closest('[slot^="sidebar"] a, .sidebar-custom-sections a')
        ) {
          sidebar.classList.remove("open");
        }
      });
    }

    // Close sidebar when clicking outside of it (mobile only).
    // Use composedPath() instead of e.target because Shadow DOM event
    // retargeting makes e.target the host element at the doc level,
    // so contains() checks on shadow-root children always return false.
    doc.addEventListener("click", (e: MouseEvent) => {
      const path = e.composedPath();
      if (
        win.innerWidth < 896 &&
        sidebar.classList.contains("open") &&
        !path.includes(sidebar) &&
        !path.includes(menuButton)
      ) {
        sidebar.classList.remove("open");
      }
    });

    // Responsive matchMedia handler for orientation/resizing
    const matchMedia = win.matchMedia
      ? win.matchMedia("(min-width: 56rem)")
      : ({
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as unknown as MediaQueryList);

    const handleMediaQuery = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        sidebar.classList.remove("open"); // Desktop view handles visibility implicitly
      }
    };

    // Setup initial state
    handleMediaQuery(matchMedia);

    // Listen for changes
    matchMedia.addEventListener("change", handleMediaQuery);

    initSidebarResize(shadow, shadowClaw, sidebar as HTMLElement, db);
  }

  // Settings button
  const settingsBtn = shadow.querySelector('[data-action="show-settings"]');
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      doc.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail: { page: "settings" },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  const headerMainToggle = shadow.querySelector(".header-main-toggle");
  headerMainToggle?.addEventListener("click", () => {
    togglePageHeaderMainVisibility(shadowClaw);
  });

  const activityLogToggle = shadow.querySelector(".activity-log-toggle");
  activityLogToggle?.addEventListener("click", () => {
    toggleActivityLogVisibility(shadowClaw);
  });

  // Listen for navigate events from subcomponents (e.g. settings "channels" or "tools" buttons)
  shadow.addEventListener("navigate", (e: Event) => {
    const page = (e as CustomEvent).detail?.page;
    if (page) {
      doc.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail: { page },
          bubbles: true,
          composed: true,
        }),
      );
    }
  });

  shadow.addEventListener("sidebar-pages-visibility-change", (event: Event) => {
    const hidden = Boolean((event as CustomEvent).detail?.hidden);
    setPagesSidebarHidden(shadow, shadowClaw, oStore, db, hidden);
  });

  shadow.addEventListener("sidebar-chat-visibility-change", (event: Event) => {
    const hidden = Boolean((event as CustomEvent).detail?.hidden);
    setSidebarNavHidden(shadow, shadowClaw, oStore, db, "chat", hidden);
  });

  shadow.addEventListener("sidebar-tasks-visibility-change", (event: Event) => {
    const hidden = Boolean((event as CustomEvent).detail?.hidden);
    setSidebarNavHidden(shadow, shadowClaw, oStore, db, "tasks", hidden);
  });

  shadow.addEventListener("sidebar-files-visibility-change", (event: Event) => {
    const hidden = Boolean((event as CustomEvent).detail?.hidden);
    setSidebarNavHidden(shadow, shadowClaw, oStore, db, "files", hidden);
  });

  shadow.addEventListener("chat-split-view-change", (event: Event) => {
    const enabled = Boolean((event as CustomEvent).detail?.enabled);
    shadowClaw.chatSplitViewEnabled = enabled;
    showPage(shadow, shadowClaw, db, oStore, shadowClaw.currentPage, false);
  });

  // Tools / Channels page "Back to Settings" navigation
  shadow.addEventListener("navigate-back", () =>
    doc.dispatchEvent(
      new CustomEvent("shadow-claw-navigate", {
        detail: { page: "settings" },
        bubbles: true,
        composed: true,
      }),
    ),
  );

  // Theme toggle
  const themeToggle = shadow.querySelector(".theme-mode-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const { resolved } = tStore.getTheme();

      const newTheme = resolved === Themes.Dark ? Themes.Light : Themes.Dark;
      tStore.setTheme(newTheme);
    });
  }

  shadow
    .querySelector(".webvm-toggle")
    ?.addEventListener("click", () =>
      toggleTerminalVisibility(shadow, shadowClaw),
    );

  shadow.addEventListener("shadow-claw-terminal-slot-ready", () => {
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
  });

  win.addEventListener("resize", () => {
    if (shadowClaw.headerMainCollapsedOverride === null) {
      updateHeaderMainToggle(shadow, shadowClaw.headerMainCollapsedOverride);
    }
  });

  doc.addEventListener("shadow-claw-navigate", shadowClaw.shadowClawNav);

  if (supportsNavigationApi()) {
    if (win.history && !(win.history as any).__scReplaceStateTracked) {
      const origReplaceState = win.history.replaceState;
      win.history.replaceState = function (
        data: any,
        unused: string,
        url?: string | URL | null,
      ) {
        recordHistoryReplaceState(data);
        return origReplaceState.call(this, data, unused, url);
      };
      (win.history as any).__scReplaceStateTracked = true;
    }

    const nav = (win as any).navigation;
    nav.addEventListener("navigate", shadowClaw.handleNavigationApiNavigate);

    shadowClaw.navigationListenerAttached = true;
  } else {
    shadowClaw.popstateListener = (ev?: any) => {
      const state = ev?.state || (win as any).history?.state;
      if (state?.inFeedScroll || state?.scrollSpy || state?.suppressRouter) {
        return;
      }
      applyRouteFromCurrentLocation(
        shadow,
        shadowClaw,
        db,
        fStore,
        oStore,
        new URL(win.location.href),
      );
    };
    win.addEventListener("popstate", shadowClaw.popstateListener);

    doc.addEventListener("click", shadowClaw.fallbackClickListener);

    shadowClaw.fallbackClickListenerAttached = true;
  }

  // Listen for theme changes to update icons and host class
  win.addEventListener("shadow-claw-theme-change", (e: Event) => {
    const theme = (e as CustomEvent).detail.theme;
    updateThemeIcons(shadow, theme);
    updateHostTheme(theme, shadowClaw.classList);
  });

  // Listen for PeerJS connection errors
  win.addEventListener("shadow-claw-peer-error", (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const remotePeerId = detail.remotePeerId;
    const errorMessage = detail.error;

    const title = "Peer Connection Error";
    const message = remotePeerId
      ? `Failed to communicate with peer ${remotePeerId}: ${errorMessage}`
      : `PeerJS error: ${errorMessage}`;

    requestDialog(doc, shadow, {
      mode: "info",
      title,
      message,
      confirmLabel: "Dismiss",
      autoCloseSeconds: 30,
    });
  });

  // Initial state
  const currentTheme = tStore.resolved;
  updateThemeIcons(shadow, currentTheme);
  updateHostTheme(currentTheme, shadowClaw.classList);

  if (shadowClaw.appLifecycleCleanup) {
    shadowClaw.appLifecycleCleanup();
    shadowClaw.appLifecycleCleanup = null;
  }

  if (shadowClaw.orchestrator) {
    shadowClaw.appLifecycleCleanup = setupAppLifecycle(
      win,
      doc,
      shadowClaw.orchestrator,
    );
  }

  setupSlottedSidebarActiveLinks(shadowClaw);
}
