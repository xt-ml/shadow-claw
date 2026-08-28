import { Signal } from "signal-polyfill";

import { effect } from "../../core/effect.js";

import { splitFrontmatter } from "../../common/utils/frontmatter.mjs";
import { CONFIG_KEYS } from "../../config/config.js";
import { renderMarkdown } from "../../content/markdown.js";

import {
  applyBasePath,
  buildRoutePath,
  getFileRouteDirPath,
  isPossibleAppRoute,
  resolveHrefAgainstRoute,
} from "../../core/app-routes.js";

import { getDb } from "../../db/db.js";
import { getConfig } from "../../db/getConfig.js";
import { isAllowedCustomElement } from "../../security/custom-element-security.js";

import {
  setSanitizedHtml,
  setTrustedSrcdoc,
} from "../../security/trusted-types.js";

import { readGroupFile } from "../../storage/readGroupFile.js";
import { getStaticPageContent } from "../../storage/staticMainSite.js";
import { writeGroupFile } from "../../storage/writeGroupFile.js";
import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { toolsStore } from "../../stores/tools.js";

import { showError, showSuccess } from "../../ui/toast.js";

import {
  getNamespacedItem,
  removeNamespacedItem,
  setNamespacedItem,
} from "../../utils/namespacedStorage.js";

import { announcePageChange } from "./utils/announcePageChange.js";
import { buildHtmlPageSrcdoc } from "./utils/buildHtmlPageSrcdoc.js";
import { calculatePaginationDisabledState } from "./utils/calculatePaginationDisabledState.js";
import { confirmRemoveAllPages } from "./utils/confirmRemoveAllPages.js";
import { handleStorageProxyMessage } from "./utils/dispatchStorageProxyCommand.js";
import { ensurePreviewIframe } from "./utils/ensurePreviewIframe.js";
import { fetchAutoRefreshInterval } from "./utils/fetchAutoRefreshInterval.js";
import { getSelectedPageIndex } from "./utils/getSelectedPageIndex.js";
import { groupPagesByGroup } from "./utils/groupPagesByGroup.js";
import { handleAnchorNavigation } from "./utils/handleAnchorNavigation.js";
import { handleAutoRefreshConfigEvent } from "./utils/handleAutoRefreshConfigEvent.js";
import { handleFileSavedEvent } from "./utils/handleFileSavedEvent.js";
import { handleKeyDownNavigation } from "./utils/handleKeyDownNavigation.js";
import { handleMouseDownGesture } from "./utils/handleMouseDownGesture.js";
import { handleMouseUpGesture } from "./utils/handleMouseUpGesture.js";
import { handlePageReorder } from "./utils/handlePageReorder.js";
import { handleTouchEndGesture } from "./utils/handleTouchEndGesture.js";
import { handleTouchStartGesture } from "./utils/handleTouchStartGesture.js";
import { handleVisibilityStateChange } from "./utils/handleVisibilityStateChange.js";
import { handleWindowFocusEvent } from "./utils/handleWindowFocusEvent.js";
import { IframeBroadcastProxy } from "./utils/iframe-broadcast-proxy.js";
import { isNavigationSuppressed } from "./utils/isNavigationSuppressed.js";
import { isHtmlPath, isMarkdownPath } from "./utils/pageFileTypes.js";
import { pageRefKey } from "./utils/pageRefKey.js";
import { parseIframeMessage } from "./utils/parseIframeMessage.js";
import { readImageAsDataUrl } from "./utils/readImageAsDataUrl.js";
import { removePreviewIframe } from "./utils/removePreviewIframe.js";
import { requestConfirmation } from "./utils/requestConfirmation.js";
import { resolveFrontmatterToggle } from "./utils/resolveFrontmatterToggle.js";
import { resolveMarkdownImages } from "./utils/resolveMarkdownImages.js";
import { resolveWorkspaceLinkPath } from "./utils/resolveWorkspaceLinkPath.js";
import { rewriteWorkspacePreviewHtml } from "./utils/rewriteWorkspacePreviewHtml.js";
import { shouldRunAutoRefresh } from "./utils/shouldRunAutoRefresh.js";
import { syncIframeTheme } from "./utils/syncIframeTheme.js";
import { toggleSidebarState } from "./utils/toggleSidebarState.js";

import ShadowClawElement from "../shadow-claw-element.js";

import type { Config } from "dompurify";

import type {
  GroupMeta,
  SavedPageRef,
  ShadowClawDatabase,
} from "../../db/types.js";

import "../common/shadow-claw-page-header-action-button/shadow-claw-page-header-action-button.js";
import "../shadow-claw-page-header/shadow-claw-page-header.js";

import shadowClawPagesStyles from "./shadow-claw-pages.css" with { type: "css" };
import shadowClawPagesTemplate from "./shadow-claw-pages.html" with { type: "html" };

const previewSanitizeOptions: Config = {
  // Allow blob URLs for locally resolved OPFS preview assets.
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|ftp|tel|file|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ["iframe", "figure", "figcaption"],
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: (tagName: string) => isAllowedCustomElement(tagName),
    attributeNameCheck: () => true,
    allowCustomizedBuiltInElements: false,
  },
  ADD_ATTR: [
    "allow",
    "allowfullscreen",
    "frameborder",
    "scrolling",
    "referrerpolicy",
    "loading",
  ],
};

const elementName = "shadow-claw-pages";

export class ShadowClawPages extends ShadowClawElement {
  static styles = shadowClawPagesStyles;
  static template = shadowClawPagesTemplate;

  autoRefreshIntervalSec: number = 0;
  autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

  broadcastProxy: IframeBroadcastProxy | null = null;
  db: ShadowClawDatabase | null = null;
  draggedPageIndex: number | null = null;
  isMouseDown: boolean = false;
  mouseStartTime: number = 0;
  mouseStartX: number = 0;
  mouseStartY: number = 0;
  navFadeTimer: ReturnType<typeof setTimeout> | null = null;
  pageFrontmatter = new Signal.State<Record<string, any> | null>(null);
  previewFrameWindow: Window | null = null;
  renderToken: number = 0;
  sidebarOpen: boolean = false;
  themeObserver: MutationObserver | null = null;
  touchStartTime: number = 0;
  touchStartX: number = 0;
  touchStartY: number = 0;

  private dsdInitialPath: string | null = null;
  private renderedContent: string | null = null;
  private renderedFrontmatterToggle: boolean | null = null;
  private renderedKey: string | null = null;
  private routingReady: boolean = false;

  constructor() {
    super();
  }

  async connectedCallback() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    const host = this.closest("shadow-claw");
    // Use the authoritative class set synchronously by theme-init.ts rather
    // than re-reading localStorage directly. theme-init.ts applies a
    // null → __PRERENDER_MAIN_MEMORY__ fallback that a plain
    // `localStorage.getItem(...) === "true"` check would miss (it would return
    // false when the key was never explicitly stored). The sc-prerender-override
    // class on <html> is the single canonical signal for whether SSR content
    // should be suppressed, so reading it here keeps the two in lockstep.
    const isOverride = document.documentElement.classList.contains(
      "sc-prerender-override",
    );
    const isNoSeed = host?.getAttribute("data-prerender-no-seed") === "true";

    if (isOverride || isNoSeed) {
      const rendered = root.querySelector("[data-pages-rendered]");
      if (rendered instanceof HTMLElement) {
        rendered.hidden = true;
        rendered.textContent = "";
      }
    } else {
      const dsdSelected = root
        .querySelector("[data-pages-dropdown-selected]")
        ?.textContent?.trim();
      if (dsdSelected) {
        this.dsdInitialPath = dsdSelected;
      }
    }

    this.db = await getDb();

    await orchestratorStore.whenInitialized;

    this.broadcastProxy = new IframeBroadcastProxy(
      () =>
        this.previewFrameWindow ||
        (
          this.shadowRoot?.querySelector(
            "[data-pages-iframe]",
          ) as HTMLIFrameElement
        )?.contentWindow ||
        null,
    );

    window.addEventListener("message", this.handleIframeMessage);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("focus", this.handleWindowFocus);
    window.addEventListener(
      "shadow-claw-pages-auto-refresh-change",
      this.handleAutoRefreshConfigChange,
    );
    document.addEventListener("shadow-claw-file-saved", this.handleFileSaved);
    document.addEventListener("keydown", this.handleKeyDown);

    root.addEventListener("click", (event: Event) => {
      const dropdown = root.querySelector("[data-pages-dropdown]");
      if (dropdown instanceof HTMLDetailsElement && dropdown.open) {
        const target = event.target as HTMLElement;
        const toggleBtn = root.querySelector("[data-pages-sidebar-toggle]");
        if (
          !dropdown.contains(target) &&
          (!toggleBtn || !toggleBtn.contains(target))
        ) {
          dropdown.removeAttribute("open");
        }
      }
    });

    const viewer = root.querySelector(".pages__viewer");
    const viewerScroll = root.querySelector(".pages__viewer-scroll");
    const handleViewerInteraction = () => {
      this.showNavButtonsTemporarily(2000);
    };

    if (viewer instanceof HTMLElement) {
      viewer.addEventListener("pointermove", handleViewerInteraction, {
        passive: true,
      });
      viewer.addEventListener("pointerdown", handleViewerInteraction, {
        passive: true,
      });
      viewer.addEventListener("touchstart", handleViewerInteraction, {
        passive: true,
      });
      viewer.addEventListener("touchstart", this.handleTouchStart, {
        passive: true,
      });
      viewer.addEventListener("touchend", this.handleTouchEnd, {
        passive: true,
      });
      viewer.addEventListener("mousedown", this.handleMouseDown, {
        passive: true,
      });
      viewer.addEventListener("mouseup", this.handleMouseUp, {
        passive: true,
      });
      viewer.addEventListener("click", handleViewerInteraction, {
        passive: true,
      });
      viewer.addEventListener("focusin", handleViewerInteraction, {
        passive: true,
      });
    }

    if (viewerScroll instanceof HTMLElement) {
      viewerScroll.addEventListener("scroll", handleViewerInteraction, {
        passive: true,
      });
    }

    const toggleBtn = root.querySelector("[data-pages-sidebar-toggle]");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.toggleSidebar();
      });
    }

    const removeAllBtn = root.querySelector(".pages__remove-all-btn");
    if (removeAllBtn) {
      removeAllBtn.addEventListener("click", () => {
        void this.handleRemoveAll();
      });
    }

    const prevBtn = root.querySelector("[data-pages-prev]");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        this.goToPreviousPage();
      });
    }

    const nextBtn = root.querySelector("[data-pages-next]");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        this.goToNextPage();
      });
    }

    this.toggleSidebar(this.sidebarOpen);

    this.setupEffects();

    this.themeObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          this.syncIframeTheme();
        }
      }
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Wait for the parent ShadowClaw to finish URL routing before allowing
    // the effect to trigger page renders. Without this gate the effect fires
    // immediately with the store's default (pre-rendered) pinned page, causing
    // a one-frame flash of SSR content before the URL-requested page loads.
    await orchestratorStore.whenReady;
    this.routingReady = true;
    void this.renderSelectedPage();
    void this.setupAutoRefreshTimer();
  }

  disconnectedCallback() {
    this.renderedKey = null;
    this.renderedContent = null;
    this.renderedFrontmatterToggle = null;
    this.dsdInitialPath = null;

    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }

    if (this.navFadeTimer !== null) {
      clearTimeout(this.navFadeTimer);
      this.navFadeTimer = null;
    }
    if (this.autoRefreshTimer !== null) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
    window.removeEventListener("message", this.handleIframeMessage);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("focus", this.handleWindowFocus);
    window.removeEventListener(
      "shadow-claw-pages-auto-refresh-change",
      this.handleAutoRefreshConfigChange,
    );
    document.removeEventListener(
      "shadow-claw-file-saved",
      this.handleFileSaved,
    );
    document.removeEventListener("keydown", this.handleKeyDown);
    this.broadcastProxy?.dispose();
    this.broadcastProxy = null;
    this.previewFrameWindow = null;
    super.disconnectedCallback?.();
  }

  announcePageChange(page: SavedPageRef) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const announcer = root.querySelector("[data-pages-announcer]");
    if (announcer instanceof HTMLElement) {
      const fm = this.pageFrontmatter.get();
      announcePageChange(page, fm?.title, announcer);
    }
  }

  goToNextPage() {
    const pages = orchestratorStore.pages;
    const index = getSelectedPageIndex(this.selectedPage, pages);
    if (index >= 0 && index < pages.length - 1) {
      this.navigateToPage(pages[index + 1]);
    }
  }

  goToPreviousPage() {
    const pages = orchestratorStore.pages;
    const index = getSelectedPageIndex(this.selectedPage, pages);
    if (index > 0) {
      this.navigateToPage(pages[index - 1]);
    }
  }

  handleAnchorNavigation(anchor: string): boolean {
    const root = this.shadowRoot;
    if (!root) {
      return false;
    }

    const rendered = root.querySelector("[data-pages-rendered]") as HTMLElement;
    return handleAnchorNavigation(anchor, rendered);
  }

  handleAutoRefreshConfigChange = (event: Event) => {
    const interval = handleAutoRefreshConfigEvent(event);
    if (interval !== null) {
      this.autoRefreshIntervalSec = interval;
    }
    void this.setupAutoRefreshTimer();
  };

  handleFileSaved = (event: Event) => {
    if (handleFileSavedEvent(event, this.selectedPage)) {
      void this.renderSelectedPage();
    }
  };

  handleIframeMessage = (event: MessageEvent) => {
    const msg = parseIframeMessage(event.data);
    if (!msg) {
      return;
    }

    if (msg.kind === "broadcast-result") {
      this.broadcastProxy?.handleResultFromIframe(
        event.source as WindowProxy,
        msg.channel,
        msg.payload,
      );
      return;
    }

    if (msg.kind === "storage-proxy") {
      if (this.previewFrameWindow && event.source !== this.previewFrameWindow) {
        return;
      }

      const pageKey = this.selectedPage?.path || "__default__";
      void handleStorageProxyMessage(
        event.source as WindowProxy,
        msg.requestId,
        msg.method,
        msg.args,
        pageKey,
      );
      return;
    }

    if (msg.kind === "swipe") {
      if (this.previewFrameWindow && event.source !== this.previewFrameWindow) {
        return;
      }
      this.showNavButtonsTemporarily(2000);
      if (msg.direction === "left") {
        this.goToNextPage();
      } else if (msg.direction === "right") {
        this.goToPreviousPage();
      }
      return;
    }

    if (msg.kind === "iframe-resize") {
      const root = this.shadowRoot;
      const iframe = root?.querySelector("[data-pages-iframe]");
      if (
        iframe instanceof HTMLIFrameElement &&
        (!this.previewFrameWindow ||
          event.source === this.previewFrameWindow ||
          (iframe.contentWindow && event.source === iframe.contentWindow))
      ) {
        this.previewFrameWindow = iframe.contentWindow;
        iframe.style.setProperty("height", `${msg.height}px`, "important");
      }
      return;
    }

    if (!this.db || msg.kind !== "file-viewer-link") {
      return;
    }

    if (this.previewFrameWindow && event.source !== this.previewFrameWindow) {
      return;
    }

    const basePath = this.selectedPage?.path || "";
    const groupId =
      this.selectedPage?.groupId || orchestratorStore.activeGroupId;
    const routeDir = applyBasePath(getFileRouteDirPath(groupId, basePath));
    const resolved = resolveHrefAgainstRoute(
      msg.href,
      routeDir,
      window.location.origin,
    );
    if (!resolved) {
      return;
    }

    const hasGameSave = resolved.searchParams.has("gameSave");

    if (hasGameSave) {
      this.reloadPreviewWithSearchParams(resolved.search);

      return;
    }

    const isInternal =
      resolved.origin === window.location.origin &&
      (isPossibleAppRoute(resolved.pathname) ||
        Boolean(resolveWorkspaceLinkPath(msg.href, basePath, groupId)));

    if (!isInternal) {
      window.open(resolved.href, "_blank", "noopener,noreferrer");

      return;
    }

    const targetPath = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    const nav = (window as any).navigation;
    if (nav && typeof nav.navigate === "function") {
      nav.navigate(targetPath);

      return;
    }

    window.history.pushState({}, "", targetPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  handleKeyDown = (event: KeyboardEvent) => {
    handleKeyDownNavigation(
      event,
      this.isConnected,
      this.shadowRoot,
      (direction) => {
        this.showNavButtonsTemporarily(2000);
        if (direction === "previous") {
          this.goToPreviousPage();
        } else {
          this.goToNextPage();
        }
      },
    );
  };

  handleMouseDown = (event: MouseEvent) => {
    const state = handleMouseDownGesture(event, isNavigationSuppressed(event));
    this.mouseStartX = state.mouseStartX;
    this.mouseStartY = state.mouseStartY;
    this.mouseStartTime = state.mouseStartTime;
    this.isMouseDown = state.isMouseDown;
  };

  handleMouseUp = (event: MouseEvent) => {
    const selection = window.getSelection();
    const hasSelection = Boolean(selection && selection.toString().length > 0);
    const direction = handleMouseUpGesture(
      event,
      {
        mouseStartX: this.mouseStartX,
        mouseStartY: this.mouseStartY,
        mouseStartTime: this.mouseStartTime,
        isMouseDown: this.isMouseDown,
      },
      isNavigationSuppressed(event),
      hasSelection,
    );
    this.isMouseDown = false;
    if (direction) {
      this.showNavButtonsTemporarily(2000);
      if (direction === "next") {
        this.goToNextPage();
      } else {
        this.goToPreviousPage();
      }
    }
  };

  handleTouchEnd = (event: TouchEvent) => {
    const direction = handleTouchEndGesture(
      event,
      {
        touchStartX: this.touchStartX,
        touchStartY: this.touchStartY,
        touchStartTime: this.touchStartTime,
      },
      isNavigationSuppressed(event),
    );
    if (direction) {
      this.showNavButtonsTemporarily(2000);
      if (direction === "next") {
        this.goToNextPage();
      } else {
        this.goToPreviousPage();
      }
    }
    this.touchStartTime = 0;
  };

  handleTouchStart = (event: TouchEvent) => {
    const updated = handleTouchStartGesture(
      event,
      isNavigationSuppressed(event),
    );
    if (updated) {
      this.touchStartX = updated.touchStartX;
      this.touchStartY = updated.touchStartY;
      this.touchStartTime = updated.touchStartTime;
    }
  };

  handleVisibilityChange = () => {
    const action = handleVisibilityStateChange(
      document.hidden,
      this.isConnected,
      this.autoRefreshTimer !== null,
    );
    if (action === "render-and-timer") {
      void this.renderSelectedPage();
      void this.setupAutoRefreshTimer();
    } else if (action === "clear-timer" && this.autoRefreshTimer !== null) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  };

  handleWindowFocus = () => {
    if (handleWindowFocusEvent(document.hidden, this.isConnected)) {
      void this.renderSelectedPage();
    }
  };

  navigateToPage(page: SavedPageRef) {
    this.selectedPage = page;
    this.showNavButtonsTemporarily(2500);
    this.announcePageChange(page);
    document.dispatchEvent(
      new CustomEvent("shadow-claw-navigate", {
        detail: {
          page: "pages",
          groupId: page.groupId,
          path: page.path,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  renderPageList(pages: SavedPageRef[], groups: GroupMeta[]) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const status = root.querySelector("[data-pages-status]");
    if (status instanceof HTMLElement) {
      status.textContent =
        pages.length === 1 ? "1 saved page" : `${pages.length} saved pages`;
    }

    const clearBtn = root.querySelector(".pages__remove-all-btn");
    if (clearBtn) {
      clearBtn.toggleAttribute("disabled", pages.length === 0);
    }

    const dropdownSelected = root.querySelector(
      "[data-pages-dropdown-selected]",
    );
    if (dropdownSelected instanceof HTMLElement) {
      if (this.selectedPage) {
        dropdownSelected.textContent = this.selectedPage.path;
      } else {
        dropdownSelected.textContent = "Select a page...";
      }
    }

    const lists = root.querySelectorAll("[data-pages-list]");
    if (lists.length === 0) {
      return;
    }

    lists.forEach((list) => {
      if (list instanceof HTMLElement) {
        list.replaceChildren();
      }
    });

    const prevBtn = root.querySelector("[data-pages-prev]");
    const nextBtn = root.querySelector("[data-pages-next]");
    const header = root.querySelector("shadow-claw-page-header");

    const fm = this.pageFrontmatter.get();
    if (header) {
      if (fm && fm.title) {
        if (this.selectedPage) {
          const routeUrl = applyBasePath(
            buildRoutePath({
              page: "pages",
              groupId: this.selectedPage.groupId,
              path: this.selectedPage.path,
            }),
          );

          let absoluteUrl = routeUrl;
          if (typeof window !== "undefined" && window.location?.origin) {
            try {
              absoluteUrl = new URL(routeUrl, window.location.origin).href;
            } catch {
              // Fallback
            }
          }

          header.setAttribute(
            "page-title",
            `<a href="${absoluteUrl}">${fm.title}</a>`,
          );
          header.setAttribute("title", fm.title);
        } else {
          header.setAttribute("page-title", fm.title);
          header.setAttribute("title", fm.title);
        }
      } else {
        header.setAttribute("page-title", "Pages");
        header.setAttribute("title", "Pages");
      }
    }

    if (
      prevBtn instanceof HTMLButtonElement &&
      nextBtn instanceof HTMLButtonElement
    ) {
      const idx = getSelectedPageIndex(this.selectedPage, pages);
      const { isPrevDisabled, isNextDisabled } =
        calculatePaginationDisabledState(idx, pages.length);
      prevBtn.disabled = isPrevDisabled;
      prevBtn.hidden = isPrevDisabled;
      nextBtn.disabled = isNextDisabled;
      nextBtn.hidden = isNextDisabled;
    }

    if (pages.length === 0) {
      return;
    }

    const groupNameById = new Map(
      groups.map((group) => [group.groupId, group.name]),
    );
    const pagesByGroup = groupPagesByGroup(pages);

    lists.forEach((list) => {
      if (!(list instanceof HTMLElement)) {
        return;
      }

      for (const [groupId, groupPages] of pagesByGroup) {
        const details = document.createElement("details");
        details.className = "pages__group-details";

        const stateKey = `shadow-claw-pages-group-collapsed-${groupId}`;
        let isCollapsed = false;
        try {
          isCollapsed = getNamespacedItem(stateKey) === "true";
        } catch {
          // Ignore
        }
        if (!isCollapsed) {
          details.open = true;
        }

        details.addEventListener("toggle", () => {
          try {
            if (details.open) {
              removeNamespacedItem(stateKey);
            } else {
              setNamespacedItem(stateKey, "true");
            }
          } catch {
            // Ignore
          }
        });

        const summary = document.createElement("summary");
        summary.className = "pages__group-label";

        const labelText = document.createElement("span");
        labelText.textContent = groupNameById.get(groupId) || groupId;

        const icon = document.createElement("span");
        icon.className = "pages__group-icon";
        icon.textContent = "▼";

        summary.appendChild(labelText);
        summary.appendChild(icon);
        details.appendChild(summary);

        const groupPagesContainer = document.createElement("div");
        groupPagesContainer.className = "pages__group-pages";

        groupPages.forEach((page) => {
          const path = page.path;
          const globalIndex = pages.findIndex(
            (p) => p.path === page.path && p.groupId === page.groupId,
          );

          const row = document.createElement("div");
          row.className = "pages__list-item";
          if (
            this.selectedPage &&
            pageRefKey(page) === pageRefKey(this.selectedPage)
          ) {
            row.classList.add("active");
          }

          const dragHandle = document.createElement("span");
          dragHandle.className = "pages__drag-handle";
          dragHandle.setAttribute("draggable", "true");
          dragHandle.title = "Drag to reorder";
          dragHandle.textContent = "⠿";

          dragHandle.addEventListener("dragstart", (e) => {
            this.draggedPageIndex = globalIndex;
            row.classList.add("dragging");
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = "move";
            }
          });

          row.addEventListener("dragend", () => {
            this.draggedPageIndex = null;
            row.classList.remove("dragging");
          });

          row.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (
              this.draggedPageIndex !== null &&
              this.draggedPageIndex !== globalIndex
            ) {
              row.classList.add("drag-over");
            }
          });

          row.addEventListener("dragleave", () => {
            row.classList.remove("drag-over");
          });

          row.addEventListener("drop", (e) => {
            e.preventDefault();
            row.classList.remove("drag-over");
            if (
              this.draggedPageIndex !== null &&
              this.draggedPageIndex !== globalIndex
            ) {
              void this.handleReorder(this.draggedPageIndex, globalIndex);
            }
          });

          const effectiveDefault = orchestratorStore.effectiveDefaultPage;
          const isDefault =
            effectiveDefault &&
            effectiveDefault.path === page.path &&
            effectiveDefault.groupId === page.groupId;

          const selectBtn = document.createElement("button");
          selectBtn.type = "button";
          selectBtn.className = "pages__select";
          selectBtn.title = `Open ${path}`;

          const pathSpan = document.createElement("span");
          pathSpan.className = "pages__list-path";
          pathSpan.textContent = path;
          selectBtn.appendChild(pathSpan);

          selectBtn.addEventListener("click", () => {
            this.selectedPage = page;
            this.renderPageList(
              orchestratorStore.pages,
              orchestratorStore.groups,
            );
            void this.renderSelectedPage();

            this.sidebarOpen = false;
            const details = list.closest("details");
            if (details) {
              details.removeAttribute("open");
            }

            document.dispatchEvent(
              new CustomEvent("shadow-claw-navigate", {
                detail: {
                  page: "pages",
                  groupId: page.groupId,
                  path: page.path,
                },
                bubbles: true,
                composed: true,
              }),
            );
          });

          const editBtn = document.createElement("button");
          editBtn.className = "pages__edit";
          editBtn.type = "button";
          editBtn.title = "Edit in file editor";
          editBtn.setAttribute("aria-label", `Edit ${path} in file editor`);
          editBtn.textContent = "✏️";

          editBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            if (!this.db) {
              return;
            }
            try {
              await fileViewerStore.openFile(this.db, path, groupId);
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              showError(`Failed to edit file: ${message}`, 4500);
            }
          });

          const removeBtn = document.createElement("button");
          removeBtn.className = "pages__remove";
          removeBtn.type = "button";
          removeBtn.title = "Remove from Pages";
          removeBtn.setAttribute(
            "aria-label",
            `Remove ${path} from Pages in ${(groupNameById.get(groupId) || groupId) as string}`,
          );
          removeBtn.textContent = "✕";

          removeBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            if (!this.db) {
              return;
            }

            const confirmed = await requestConfirmation({
              title: "Remove Page",
              message: `Are you sure you want to remove this page from Pages?\n\n${path}`,
              confirmLabel: "Remove",
              cancelLabel: "Cancel",
            });

            if (!confirmed) {
              return;
            }

            try {
              await orchestratorStore.removePage(this.db, path, groupId);
              showSuccess(`Removed ${path} from Pages`, 2400);
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              showError(`Failed to remove page: ${message}`, 4500);
            }
          });

          row.appendChild(dragHandle);
          if (isDefault) {
            const defaultSpan = document.createElement("span");
            defaultSpan.className = "pages__default-btn is-default";
            defaultSpan.title = "Default page";
            defaultSpan.textContent = "⭐";
            row.appendChild(defaultSpan);
          }
          row.appendChild(selectBtn);
          row.appendChild(editBtn);
          row.appendChild(removeBtn);
          groupPagesContainer.appendChild(row);
        });

        details.appendChild(groupPagesContainer);
        list.appendChild(details);
      }
    });
  }

  rewriteWorkspacePreviewHtml(html: string, filePath: string): string {
    const groupId =
      this.selectedPage?.groupId || orchestratorStore.activeGroupId;
    const routeDir = applyBasePath(getFileRouteDirPath(groupId, filePath));
    return rewriteWorkspacePreviewHtml(
      html,
      filePath,
      routeDir,
      groupId,
      window.location.origin,
    );
  }

  get selectedPage(): SavedPageRef | null {
    return orchestratorStore.activePinnedPage;
  }

  set selectedPage(val: SavedPageRef | null) {
    if (pageRefKey(val) === pageRefKey(this.selectedPage)) {
      return;
    }

    if (this.db) {
      void orchestratorStore.setActivePinnedPage(this.db, val);
    } else {
      orchestratorStore._activePinnedPage.set(val);
    }

    if (val) {
      this.announcePageChange(val);
    }

    this.renderPageList(orchestratorStore.pages, orchestratorStore.groups);
    void this.renderSelectedPage();
  }

  setupEffects() {
    this.addCleanup(
      effect(() => {
        const declTools = toolsStore.declarativeTools;
        if (this.broadcastProxy && declTools.length > 0) {
          this.broadcastProxy.registerChannelsFromTools(declTools);
        }
      }),
    );

    // Effect 1: Render the sidebar list and header.
    // Depends on: pages, groups, activePinnedPage (via getSelectedPageIndex), and pageFrontmatter.
    this.addCleanup(
      effect(() => {
        const pages = orchestratorStore.pages;
        const groups = orchestratorStore.groups;
        this.renderPageList(pages, groups);
      }),
    );

    // Effect 2: Ensure valid active page selection and trigger content render.
    // Depends on: pages, activePinnedPage.
    // Does NOT depend on pageFrontmatter, preventing infinite render loops when frontmatter updates.
    this.addCleanup(
      effect(() => {
        const pages = orchestratorStore.pages;
        const activePinnedPage = orchestratorStore.activePinnedPage;

        if (pages.length === 0) {
          if (activePinnedPage !== null) {
            this.selectedPage = null;
          }
        } else if (
          !activePinnedPage ||
          !pages.some(
            (page) => pageRefKey(page) === pageRefKey(activePinnedPage),
          )
        ) {
          this.selectedPage =
            orchestratorStore.effectiveDefaultPage || pages[0];
        }

        // Guard: skip renders until URL routing has been applied by the parent
        // ShadowClaw. This prevents the effect from flashing the default
        // pre-rendered page before applyRouteFromCurrentLocation runs.
        if (!this.routingReady) {
          return;
        }

        void this.renderSelectedPage();
      }),
    );
  }

  showNavButtonsTemporarily(durationMs = 2500) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const viewer = root.querySelector(".pages__viewer");
    if (viewer instanceof HTMLElement) {
      viewer.classList.add("pages__viewer--nav-visible");
    }

    if (this.navFadeTimer !== null) {
      clearTimeout(this.navFadeTimer);
    }

    this.navFadeTimer = setTimeout(() => {
      this.navFadeTimer = null;
      if (viewer instanceof HTMLElement) {
        viewer.classList.remove("pages__viewer--nav-visible");
      }
    }, durationMs);
  }

  toggleSidebar(force?: boolean) {
    this.sidebarOpen = toggleSidebarState({
      root: this.shadowRoot,
      currentOpen: this.sidebarOpen,
      force,
    });
  }

  async buildHtmlPageSrcdoc(
    content: string,
    filePath: string,
    searchParams: string = "",
  ): Promise<string> {
    const groupId =
      this.selectedPage?.groupId || orchestratorStore.activeGroupId;
    return await buildHtmlPageSrcdoc({
      content,
      filePath,
      searchParams,
      groupId,
      origin: typeof window !== "undefined" ? window.location?.origin : "",
      resolveRelativeImagesInHtmlFn: (c, p, g) =>
        this.resolveRelativeImagesInHtml(c, p, g),
    });
  }

  async handleRemoveAll() {
    const btn = this.shadowRoot?.querySelector(".pages__remove-all-btn");
    try {
      btn?.toggleAttribute("disabled", true);
      if (btn) {
        btn.textContent = "⏳";
      }

      const success = await confirmRemoveAllPages(this.db, (opts) =>
        requestConfirmation(opts),
      );
      if (success) {
        showSuccess("Removed all pages from Pages", 2400);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to remove all pages: ${message}`, 4500);
      console.error("Remove all pages error:", err);
    } finally {
      btn?.toggleAttribute("disabled", false);
      if (btn) {
        btn.textContent = "🗑️ Remove All";
      }
    }
  }

  async handleReorder(fromIndex: number, toIndex: number) {
    const result = await handlePageReorder({
      db: this.db,
      currentPages: orchestratorStore.pages,
      fromIndex,
      toIndex,
    });

    if (result.movedToFirst) {
      this.selectedPage = result.movedToFirst;
      void this.renderSelectedPage();

      document.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail: {
            page: "pages",
            groupId: result.movedToFirst.groupId,
            path: result.movedToFirst.path,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  async renderSelectedPage() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const empty = root.querySelector("[data-pages-empty]");
    const rendered = root.querySelector("[data-pages-rendered]");

    if (!(empty instanceof HTMLElement) || !(rendered instanceof HTMLElement)) {
      return;
    }

    const selectedPage = this.selectedPage;
    if (!this.db || !selectedPage) {
      this.renderedKey = null;
      this.renderedContent = null;
      this.renderedFrontmatterToggle = null;
      empty.hidden = false;
      rendered.hidden = true;
      rendered.textContent = "";
      this.pageFrontmatter.set(null);
      removePreviewIframe(root);

      return;
    }

    const token = ++this.renderToken;

    try {
      let content: string;
      try {
        content = await readGroupFile(
          this.db,
          selectedPage.groupId,
          selectedPage.path,
        );
      } catch (readErr) {
        try {
          const staticContent = await getStaticPageContent(selectedPage.path);
          if (typeof staticContent === "string") {
            content = staticContent;
            void Promise.resolve(
              writeGroupFile(
                this.db,
                selectedPage.groupId,
                selectedPage.path,
                content,
              ),
            ).catch(() => {});
          } else {
            throw readErr;
          }
        } catch {
          throw readErr;
        }
      }

      if (token !== this.renderToken) {
        return;
      }

      empty.hidden = true;

      const pageKey = `${selectedPage.groupId}:${selectedPage.path}`;

      if (isHtmlPath(selectedPage.path)) {
        const parsedFrontmatter = splitFrontmatter(content);
        const newData =
          Object.keys(parsedFrontmatter.data).length > 0
            ? parsedFrontmatter.data
            : null;

        const currentData = this.pageFrontmatter.get();
        if (JSON.stringify(currentData) !== JSON.stringify(newData)) {
          this.pageFrontmatter.set(newData);
        }

        if (
          this.renderedKey === pageKey &&
          this.renderedContent === content &&
          root.querySelector("[data-pages-iframe]")
        ) {
          this.showNavButtonsTemporarily(2500);

          return;
        }

        this.renderedKey = pageKey;
        this.renderedContent = content;
        this.renderedFrontmatterToggle = null;
        rendered.hidden = true;
        const iframe = this.ensurePreviewIframe(root, rendered);
        iframe.hidden = false;
        this.previewFrameWindow = null;
        setTrustedSrcdoc(
          iframe,
          await this.buildHtmlPageSrcdoc(
            parsedFrontmatter.content,
            selectedPage.path,
          ),
        );
        this.showNavButtonsTemporarily(2500);

        return;
      }

      removePreviewIframe(root);

      if (isMarkdownPath(selectedPage.path)) {
        const parsedFrontmatter = splitFrontmatter(content);
        const newData =
          Object.keys(parsedFrontmatter.data).length > 0
            ? parsedFrontmatter.data
            : null;

        const currentData = this.pageFrontmatter.get();
        if (JSON.stringify(currentData) !== JSON.stringify(newData)) {
          this.pageFrontmatter.set(newData);
        }

        const renderFrontmatter = await resolveFrontmatterToggle(
          this.db,
          CONFIG_KEYS.MARKDOWN_FRONTMATTER_PAGES,
        );

        // Check if already rendered with matching content and settings
        if (
          this.renderedKey === pageKey &&
          this.renderedContent === content &&
          this.renderedFrontmatterToggle === renderFrontmatter &&
          rendered.children.length > 0 &&
          !rendered.hidden
        ) {
          this.showNavButtonsTemporarily(2500);

          return;
        }

        // Check if DSD SSR content is already present for this initial page
        if (
          !this.renderedKey &&
          this.dsdInitialPath &&
          this.dsdInitialPath === selectedPage.path &&
          rendered.children.length > 0 &&
          !rendered.hidden
        ) {
          this.renderedKey = pageKey;
          this.renderedContent = content;
          this.renderedFrontmatterToggle = renderFrontmatter;
          await this.resolveMarkdownImages(
            rendered,
            selectedPage.groupId,
            selectedPage.path,
          );
          this.showNavButtonsTemporarily(2500);

          return;
        }

        this.renderedKey = pageKey;
        this.renderedContent = content;
        this.renderedFrontmatterToggle = renderFrontmatter;
        rendered.hidden = false;

        const html = await renderMarkdown(content, {
          renderFrontmatter,
        });
        if (token !== this.renderToken) {
          return;
        }

        const routeDir = applyBasePath(
          getFileRouteDirPath(selectedPage.groupId, selectedPage.path),
        );
        const resolvedHtml = rewriteWorkspacePreviewHtml(
          html,
          selectedPage.path,
          routeDir,
          selectedPage.groupId,
          window.location.origin,
        );
        if (token !== this.renderToken) {
          return;
        }

        setSanitizedHtml(rendered, resolvedHtml, previewSanitizeOptions);
        await this.resolveMarkdownImages(
          rendered,
          selectedPage.groupId,
          selectedPage.path,
        );
        this.showNavButtonsTemporarily(2500);

        return;
      }

      if (
        this.renderedKey === pageKey &&
        this.renderedContent === content &&
        !rendered.hidden
      ) {
        this.showNavButtonsTemporarily(2500);

        return;
      }

      this.renderedKey = pageKey;
      this.renderedContent = content;
      this.renderedFrontmatterToggle = null;
      this.pageFrontmatter.set(null);
      rendered.hidden = false;
      rendered.textContent = content;
      this.showNavButtonsTemporarily(2500);
    } catch (error) {
      this.renderedKey = null;
      this.renderedContent = null;
      this.renderedFrontmatterToggle = null;
      empty.hidden = false;
      rendered.hidden = true;
      rendered.textContent = "";
      this.pageFrontmatter.set(null);
      removePreviewIframe(root);
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to load page ${selectedPage.path}: ${message}`, 5000);
    }
  }

  async resolveMarkdownImages(
    content: HTMLElement,
    groupId: string,
    filePath: string,
  ): Promise<void> {
    const groups = Array.isArray(orchestratorStore.groups)
      ? orchestratorStore.groups
      : [];
    await resolveMarkdownImages({
      container: content,
      groupId,
      filePath,
      groups,
      readImageAsDataUrlFn: (g, p) =>
        readImageAsDataUrl({
          db: this.db,
          groupId: g,
          workspacePath: p,
        }),
    });
  }

  async resolveRelativeImagesInHtml(
    html: string,
    filePath: string,
    groupId: string,
  ): Promise<string> {
    if (!html) {
      return html;
    }

    const parsed = new DOMParser().parseFromString(html, "text/html");
    await this.resolveMarkdownImages(parsed.body, groupId, filePath);
    return parsed.body.innerHTML;
  }

  async setupAutoRefreshTimer(): Promise<void> {
    if (this.autoRefreshTimer !== null) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }

    if (!this.db) {
      return;
    }

    const sec = await fetchAutoRefreshInterval(this.db, getConfig);
    this.autoRefreshIntervalSec = sec;

    if (shouldRunAutoRefresh(sec, document.hidden, this.isConnected)) {
      this.autoRefreshTimer = setInterval(() => {
        if (shouldRunAutoRefresh(sec, document.hidden, this.isConnected)) {
          void this.renderSelectedPage();
        }
      }, sec * 1000);
    }
  }

  private ensurePreviewIframe(
    root: ShadowRoot,
    rendered: HTMLElement,
  ): HTMLIFrameElement {
    return ensurePreviewIframe({
      root,
      rendered,
      selectedPath: this.selectedPage?.path,
      onIframeLoad: (win) => {
        this.previewFrameWindow = win;
        this.syncIframeTheme();
      },
    });
  }

  private syncIframeTheme(): void {
    syncIframeTheme(this.previewFrameWindow);
  }

  private async reloadPreviewWithSearchParams(
    searchParams: string,
  ): Promise<void> {
    if (!this.selectedPage || !this.renderedContent) {
      return;
    }

    const root = this.shadowRoot;
    const rendered = root?.querySelector("#rendered") as HTMLElement;
    if (!root || !rendered) {
      return;
    }

    const parsedFrontmatter = splitFrontmatter(this.renderedContent);
    const iframe = this.ensurePreviewIframe(root, rendered);
    iframe.hidden = false;
    this.previewFrameWindow = null;
    setTrustedSrcdoc(
      iframe,
      await this.buildHtmlPageSrcdoc(
        parsedFrontmatter.content,
        this.selectedPage.path,
        searchParams,
      ),
    );
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawPages);
}
