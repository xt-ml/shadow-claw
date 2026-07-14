import { Themes } from "../../../stores/theme.js";
import { applyRouteFromCurrentLocation } from "./applyRouteFromCurrentLocation.js";
import { getDefaultSidebarPage } from "./getDefaultSidebarPage.js";
import { initSidebarResize } from "./initSidebarResize.js";
import { requestDialog } from "./requestDialog.js";
import { scheduleTerminalPlacement } from "./scheduleTerminalPlacement.js";
import { setPagesSidebarHidden } from "./setPagesSidebarHidden.js";
import { supportsNavigationApi } from "./supportsNavigationApi.js";
import { syncPageHeaderMainVisibilityOverride } from "./syncPageHeaderMainVisibilityOverride.js";

import { toggleActivityLogVisibility } from "./toggleActivityLogVisibility.js";
import { togglePageHeaderMainVisibility } from "./togglePageHeaderMainVisibility.js";
import { toggleTerminalVisibility } from "./toggleTerminalVisibility.js";

import { updateHeaderMainToggle } from "./updateHeaderMainToggle.js";
import { updateHostTheme } from "./updateHostTheme.js";
import { updateThemeIcons } from "./updateThemeIcons.js";

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
  url: URL,
): void {
  if (!shadow) {
    return;
  }

  // Navigation items
  shadow.querySelectorAll(".nav-item[data-page]").forEach((item: Element) => {
    const lItem = item as HTMLLIElement;
    lItem.addEventListener("click", () => {
      const page = lItem.dataset.page || getDefaultSidebarPage(oStore);
      doc.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail: { page },
          bubbles: true,
          composed: true,
        }),
      );
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
    const matchMedia = globalThis.matchMedia("(min-width: 56rem)");

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

  // Listen for navigate events from the settings component (e.g. "tools" button)
  const settingsEl = shadow.querySelector("shadow-claw-settings");
  settingsEl?.addEventListener("navigate", (e: Event) => {
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

  settingsEl?.addEventListener(
    "sidebar-pages-visibility-change",
    (event: Event) => {
      const hidden = Boolean((event as CustomEvent).detail?.hidden);
      setPagesSidebarHidden(shadow, shadowClaw, oStore, db, hidden);
    },
  );

  // Tools page "Back to Settings" navigation
  const toolsPage = shadow.querySelector("shadow-claw-tools");
  toolsPage?.addEventListener("navigate-back", () =>
    doc.dispatchEvent(
      new CustomEvent("shadow-claw-navigate", {
        detail: { page: "settings" },
        bubbles: true,
        composed: true,
      }),
    ),
  );

  // Channels page "Back to Settings" navigation
  const channelsPage = shadow.querySelector("shadow-claw-channels");
  channelsPage?.addEventListener("navigate-back", () =>
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
    const nav = (win as any).navigation;
    nav.addEventListener("navigate", shadowClaw.handleNavigationApiNavigate);

    shadowClaw.navigationListenerAttached = true;
  } else {
    shadowClaw.popstateListener = () => {
      applyRouteFromCurrentLocation(
        shadow,
        shadowClaw,
        db,
        fStore,
        oStore,
        url,
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
    });
  });

  // Initial state
  const currentTheme = tStore.resolved;
  updateThemeIcons(shadow, currentTheme);
  updateHostTheme(currentTheme, shadowClaw.classList);
}
