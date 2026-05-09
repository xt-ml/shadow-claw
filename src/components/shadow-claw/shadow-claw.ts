import { effect } from "../../effect.js";
import { CONFIG_KEYS } from "../../config.js";

import { ShadowClawDatabase, setDB } from "../../db/db.js";
import { getConfig } from "../../db/getConfig.js";
import { setConfig } from "../../db/setConfig.js";
import { Orchestrator, OrchestratorState } from "../../orchestrator.js";
import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { Themes, themeStore } from "../../stores/theme.js";
import { toolsStore } from "../../stores/tools.js";
import { consumePendingShares } from "../../share-target/pending-shares.js";
import { showError, showSuccess } from "../../toast.js";
import { writeGroupFileBytes } from "../../storage/writeGroupFileBytes.js";
import { writeGroupFile } from "../../storage/writeGroupFile.js";
import {
  buildProviderHelpDialogOptions,
  type ProviderHelpType,
} from "../common/help/providers.js";
import {
  AppDialogOptions,
  ConfirmationDialogOptions,
  OpenFilePayload,
} from "../../types.js";
import { VMStatus } from "../../vm.js";
import { buildLlamafileHelpDialogOptions } from "../common/help/llamafile.js";
import { buildTransformersJsHelpDialogOptions } from "../common/help/transformers.js";

import "../shadow-claw-chat/shadow-claw-chat.js";
import "../shadow-claw-channels/shadow-claw-channels.js";
import "../shadow-claw-conversations/shadow-claw-conversations.js";
import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../shadow-claw-file-viewer/shadow-claw-file-viewer.js";
import "../shadow-claw-files/shadow-claw-files.js";
import "../shadow-claw-pdf-viewer/shadow-claw-pdf-viewer.js";
import "../shadow-claw-settings/shadow-claw-settings.js";
import "../shadow-claw-tasks/shadow-claw-tasks.js";
import "../shadow-claw-terminal/shadow-claw-terminal.js";
import "../shadow-claw-toast/shadow-claw-toast.js";
import "../shadow-claw-tools/shadow-claw-tools.js";

import ShadowClawElement from "../shadow-claw-element.js";

import { ShadowClawTerminal } from "../shadow-claw-terminal/shadow-claw-terminal.js";

const elementName = "shadow-claw";
const DEFAULT_SIDEBAR_WIDTH_PX = 250;
const MIN_SIDEBAR_WIDTH_PX = 200;
const MAX_SIDEBAR_WIDTH_PX = 560;

type PageHeaderLikeElement = HTMLElement & {
  isMainCollapsed?: () => boolean;
  setMainCollapsedOverride?: (collapsed: boolean | null) => void;
};

export class ShadowClaw extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClaw.componentPath}/${elementName}.css`;
  static template = `${ShadowClaw.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;

  vmStatus: VMStatus = {
    ready: false,
    booting: false,
    bootAttempted: false,
    error: null,
  };

  currentPage: string = "chat";
  orchestrator: Orchestrator = new Orchestrator();
  previousOrchestratorState: OrchestratorState = "idle";
  terminalElement: ShadowClawTerminal | null = null;
  terminalPlacementFrame: number | null = null;
  terminalVisible: boolean = false;
  vmStatusCleanup: (() => void) | null = null;
  headerMainCollapsedOverride: boolean | null = null;
  activityLogCollapsedOverride: boolean | null = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await this.orchestrator.init();

    // Initialize reactive app store wiring before child components rely on ready state.
    // We do this before setDB() so that components waiting on getDb() find a ready store.
    await orchestratorStore.init(this.db, this.orchestrator);

    setDB(this.db);

    await this.render();

    await this.processPendingSharedPayloads();
  }

  private sanitizeSharedFileName(name: string, fallbackBase: string): string {
    const normalized =
      name.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";

    const collapsed = normalized
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (collapsed) {
      return collapsed;
    }

    return `${fallbackBase}.txt`;
  }

  private buildSharedTextPayload(share: {
    title: string;
    text: string;
    url: string;
  }): string {
    const lines: string[] = ["# Shared Content", ""];

    if (share.title) {
      lines.push(`Title: ${share.title}`);
    }

    if (share.url) {
      lines.push(`URL: ${share.url}`);
    }

    if (share.text) {
      lines.push("", share.text);
    }

    return lines.join("\n").trim() + "\n";
  }

  private async resolveSharedFilesConversationId(
    db: ShadowClawDatabase,
  ): Promise<string> {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const isoDate = `${year}-${month}-${day}`;
    const conversationName = `Shared Files ${isoDate}`;
    const existing = orchestratorStore.groups.find(
      (group) => group.name === conversationName,
    );

    if (existing) {
      await orchestratorStore.switchConversation(db, existing.groupId);

      return existing.groupId;
    }

    const group = await orchestratorStore.createConversation(
      db,
      conversationName,
    );

    return group.groupId;
  }

  private async processPendingSharedPayloads(): Promise<void> {
    if (!this.db) {
      return;
    }

    const pendingShares = await consumePendingShares(this.db);
    if (pendingShares.length === 0) {
      return;
    }

    try {
      const targetGroupId = await this.resolveSharedFilesConversationId(
        this.db,
      );
      const savedPaths: string[] = [];

      for (let i = 0; i < pendingShares.length; i++) {
        const share = pendingShares[i];
        const baseName = `shared-${Date.now()}-${i + 1}`;

        if (share.fileBytes instanceof ArrayBuffer) {
          const preferredName =
            share.fileName ||
            (share.fileType === "application/pdf"
              ? `${baseName}.pdf`
              : `${baseName}.bin`);
          const fileName = this.sanitizeSharedFileName(preferredName, baseName);

          await writeGroupFileBytes(
            this.db,
            targetGroupId,
            fileName,
            new Uint8Array(share.fileBytes),
          );
          savedPaths.push(fileName);

          continue;
        }

        const textFileName = this.sanitizeSharedFileName(
          share.fileName || `${baseName}.md`,
          baseName,
        );
        const textPayload = this.buildSharedTextPayload(share);
        await writeGroupFile(this.db, targetGroupId, textFileName, textPayload);
        savedPaths.push(textFileName);
      }

      await orchestratorStore.loadFiles(this.db);
      this.showPage("files");

      if (savedPaths.length > 0) {
        await fileViewerStore.openFile(this.db, savedPaths[0], targetGroupId);
      }

      showSuccess(
        `Imported ${savedPaths.length} shared item${savedPaths.length === 1 ? "" : "s"}.`,
      );

      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has("share-target")) {
        currentUrl.searchParams.delete("share-target");
        const cleaned = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
        window.history.replaceState({}, "", cleaned || "/");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to import shared content: ${message}`, 6000);
    }
  }

  async render() {
    // Bind event listeners
    this.bindEventListeners(this.db);

    this.terminalElement = document.createElement(
      "shadow-claw-terminal",
    ) as ShadowClawTerminal;
    if (this.terminalElement) {
      this.terminalElement.orchestrator = this.orchestrator;
    }

    this.updateTerminalToggle();
    this.scheduleTerminalPlacement();
    this.syncPageHeaderMainVisibilityOverride();
    this.updateHeaderMainToggle();
    this.updateActivityLogToggleVisibility();

    const vmStatusListener = (status: VMStatus) => {
      this.vmStatus = status;

      // When WebVM is unavailable (for example mode = disabled), force-close
      // the panel before hiding the toggle so the UI cannot get stuck open.
      if (status.error && this.terminalVisible) {
        this.terminalVisible = false;
        if (this.terminalElement) {
          this.terminalElement.hidden = true;
        }

        this.scheduleTerminalPlacement();
      }

      this.updateTerminalToggle();
    };

    this.vmStatus = this.orchestrator.getVMStatus?.() || this.vmStatus;

    this.updateTerminalToggle();

    this.orchestrator.events.on?.("vm-status", vmStatusListener);

    this.vmStatusCleanup = () => {
      this.orchestrator.events.off?.("vm-status", vmStatusListener);
    };

    // Load persisted tool configuration
    await toolsStore.load(this.db);

    // Bridge worker tool events to UI actions.
    this.orchestrator.events.on(
      "open-file",
      async (payload: OpenFilePayload) => {
        const path = payload.path;
        const groupId = payload.groupId || orchestratorStore.activeGroupId;
        const maxRetries = 3;

        if (!path || !this.db) {
          return;
        }

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            await fileViewerStore.openFile(this.db, path, groupId);

            return;
          } catch (err) {
            const isNotFound =
              err instanceof DOMException && err.name === "NotFoundError";

            if (attempt < maxRetries && isNotFound) {
              await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));

              continue;
            }

            const message = err instanceof Error ? err.message : String(err);
            showError(`Failed to open file from tool: ${message}`, 5000);
          }
        }
      },
    );

    this.orchestrator.events.on(
      "provider-help",
      async (payload: {
        providerId: string;
        reason?: string;
        helpType?: ProviderHelpType;
      }) => {
        if (payload?.providerId === "llamafile") {
          await this.requestDialog(
            buildLlamafileHelpDialogOptions(payload.reason),
          );
        } else if (payload?.providerId === "transformers_js_local") {
          await this.requestDialog(
            buildTransformersJsHelpDialogOptions(payload.reason),
          );
        } else if (payload?.providerId && payload.helpType) {
          await this.requestDialog(
            buildProviderHelpDialogOptions(
              payload.providerId,
              payload.helpType,
              payload.reason,
            ),
          );
        }
      },
    );

    // React to store changes using effect()
    this.setupEffects();

    console.log("ShadowClaw UI initialized");

    // Signal that the UI is fully ready (listeners bound, etc.)
    orchestratorStore.setReady();
  }

  disconnectedCallback() {
    if (this.vmStatusCleanup) {
      this.vmStatusCleanup();
      this.vmStatusCleanup = null;
    }

    if (this.terminalPlacementFrame !== null) {
      cancelAnimationFrame(this.terminalPlacementFrame);
      this.terminalPlacementFrame = null;
    }
  }

  async requestDialog(options: AppDialogOptions) {
    const root = this.shadowRoot;
    if (!root) {
      return false;
    }

    const dialog = root.querySelector(
      ".app-dialog",
    ) as HTMLDialogElement | null;
    const titleEl = root.querySelector(
      ".app-dialog__title",
    ) as HTMLElement | null;
    const messageEl = root.querySelector(
      ".app-dialog__message",
    ) as HTMLElement | null;
    const detailsEl = root.querySelector(
      ".app-dialog__details",
    ) as HTMLUListElement | null;
    const linksEl = root.querySelector(
      ".app-dialog__links",
    ) as HTMLDivElement | null;
    const confirmBtn = root.querySelector(
      ".app-dialog__btn--confirm",
    ) as HTMLButtonElement | null;
    const cancelBtn = root.querySelector(
      ".app-dialog__btn--cancel",
    ) as HTMLButtonElement | null;

    if (
      !dialog ||
      !titleEl ||
      !messageEl ||
      !detailsEl ||
      !linksEl ||
      !confirmBtn ||
      !cancelBtn
    ) {
      return false;
    }

    if (dialog.open) {
      dialog.close();
    }

    titleEl.textContent = options.title;
    messageEl.textContent = options.message;
    detailsEl.innerHTML = "";
    linksEl.innerHTML = "";

    const details = Array.isArray(options.details) ? options.details : [];
    detailsEl.hidden = details.length === 0;
    for (const detail of details) {
      const item = document.createElement("li");
      item.textContent = detail;
      detailsEl.appendChild(item);
    }

    const links = Array.isArray(options.links) ? options.links : [];
    linksEl.hidden = links.length === 0;
    for (const link of links) {
      const anchor = document.createElement("a");
      anchor.className = "app-dialog__link";
      anchor.href = link.href;
      anchor.rel = "noreferrer";
      anchor.target = "_blank";
      anchor.textContent = link.label;
      linksEl.appendChild(anchor);
    }

    const mode = options.mode || "confirm";
    confirmBtn.textContent =
      options.confirmLabel || (mode === "info" ? "OK" : "Confirm");
    cancelBtn.textContent = options.cancelLabel || "Cancel";
    cancelBtn.hidden = mode === "info";

    dialog.returnValue = "";

    return await new Promise<boolean>((resolve) => {
      const onClose = () => {
        dialog.removeEventListener("close", onClose);
        resolve(dialog.returnValue === "confirm");
      };

      dialog.addEventListener("close", onClose);
      dialog.showModal();
    });
  }

  async requestConfirmation(options: ConfirmationDialogOptions) {
    return await this.requestDialog({ ...options, mode: "confirm" });
  }

  /**
   * Bind all event listeners to the component
   */
  bindEventListeners(_db: ShadowClawDatabase): void {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Navigation items
    root.querySelectorAll(".nav-item[data-page]").forEach((item: Element) => {
      (item as HTMLLIElement).addEventListener("click", () =>
        this.showPage((item as HTMLLIElement).dataset.page || "chat"),
      );
    });

    // Menu toggle logic
    const menuButton = root.getElementById("menu-button");
    const sidebar = root.querySelector(".sidebar");

    if (menuButton && sidebar) {
      menuButton.addEventListener("click", () => {
        sidebar.classList.toggle("open");
      });

      // Close sidebar when an item is tapped (only on mobile)
      root.querySelectorAll(".nav-item, .settings-btn").forEach((item) => {
        item.addEventListener("click", () => {
          if (window.innerWidth < 896) {
            sidebar.classList.remove("open");
          }
        });
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

      void this.initSidebarResize(sidebar as HTMLElement);
    }

    // Settings button
    const settingsBtn = root.querySelector('[data-action="show-settings"]');
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => this.showPage("settings"));
    }

    const headerMainToggle = root.querySelector(".header-main-toggle");
    headerMainToggle?.addEventListener("click", () => {
      this.togglePageHeaderMainVisibility();
    });

    const activityLogToggle = root.querySelector(".activity-log-toggle");
    activityLogToggle?.addEventListener("click", () => {
      this.toggleActivityLogVisibility();
    });

    // Listen for navigate events from the settings component (e.g. "tools" button)
    const settingsEl = root.querySelector("shadow-claw-settings");
    settingsEl?.addEventListener("navigate", (e: Event) => {
      const page = (e as CustomEvent).detail?.page;
      if (page) {
        this.showPage(page);
      }
    });

    // Tools page "Back to Settings" navigation
    const toolsPage = root.querySelector("shadow-claw-tools");
    toolsPage?.addEventListener("navigate-back", () =>
      this.showPage("settings"),
    );

    // Channels page "Back to Settings" navigation
    const channelsPage = root.querySelector("shadow-claw-channels");
    channelsPage?.addEventListener("navigate-back", () =>
      this.showPage("settings"),
    );

    // Theme toggle
    const themeToggle = root.querySelector(".theme-mode-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const { resolved } = themeStore.getTheme();

        const newTheme = resolved === Themes.Dark ? Themes.Light : Themes.Dark;
        themeStore.setTheme(newTheme);
      });
    }

    root
      .querySelector(".webvm-toggle")
      ?.addEventListener("click", () => this.toggleTerminalVisibility());

    root.addEventListener("shadow-claw-terminal-slot-ready", () => {
      this.scheduleTerminalPlacement();
      this.syncPageHeaderMainVisibilityOverride();
      this.updateHeaderMainToggle();
    });

    window.addEventListener("resize", () => {
      if (this.headerMainCollapsedOverride === null) {
        this.updateHeaderMainToggle();
      }
    });

    // Listen for theme changes to update icons and host class
    window.addEventListener("shadow-claw-theme-change", (e: Event) => {
      const theme = (e as CustomEvent).detail.theme;
      this.updateThemeIcons(theme);
      this.updateHostTheme(theme);
    });

    // Initial state
    const currentTheme = themeStore.resolved;
    this.updateThemeIcons(currentTheme);
    this.updateHostTheme(currentTheme);
  }

  clampSidebarWidth(px: number): number {
    const appBody = this.shadowRoot?.querySelector(".app-body");

    if (!(appBody instanceof HTMLElement)) {
      return Math.max(MIN_SIDEBAR_WIDTH_PX, Math.min(MAX_SIDEBAR_WIDTH_PX, px));
    }

    const maxByContainer = Math.max(
      MIN_SIDEBAR_WIDTH_PX,
      appBody.getBoundingClientRect().width - 260,
    );

    return Math.max(
      MIN_SIDEBAR_WIDTH_PX,
      Math.min(Math.min(MAX_SIDEBAR_WIDTH_PX, maxByContainer), px),
    );
  }

  setSidebarWidth(px: number): void {
    const appBody = this.shadowRoot?.querySelector(".app-body");

    if (!(appBody instanceof HTMLElement)) {
      return;
    }

    const clamped = this.clampSidebarWidth(px);
    appBody.style.setProperty("--sidebar-width", `${clamped}px`);
  }

  async persistSidebarWidth(px: number): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await setConfig(this.db, CONFIG_KEYS.SIDEBAR_WIDTH, px);
    } catch {
      // Ignore persistence failures so resize remains usable in degraded test/runtime states.
    }
  }

  async initSidebarResize(sidebar: HTMLElement): Promise<void> {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const handle = root.querySelector(".sidebar-resize-handle");
    if (!(handle instanceof HTMLElement)) {
      return;
    }

    handle.setAttribute("tabindex", "0");
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", "Resize sidebar width");

    const getCurrentWidth = () => {
      const appBody = root.querySelector(".app-body");
      if (!(appBody instanceof HTMLElement)) {
        return DEFAULT_SIDEBAR_WIDTH_PX;
      }

      const stored = parseFloat(
        appBody.style.getPropertyValue("--sidebar-width"),
      );
      if (Number.isFinite(stored) && stored > 0) {
        return stored;
      }

      return sidebar.getBoundingClientRect().width || DEFAULT_SIDEBAR_WIDTH_PX;
    };

    const updateAria = () => {
      const current = Math.round(this.clampSidebarWidth(getCurrentWidth()));
      const max = Math.round(this.clampSidebarWidth(Number.MAX_SAFE_INTEGER));
      handle.setAttribute("aria-valuemin", String(MIN_SIDEBAR_WIDTH_PX));
      handle.setAttribute("aria-valuemax", String(max));
      handle.setAttribute("aria-valuenow", String(current));
    };

    try {
      const saved = this.db
        ? await getConfig(this.db, CONFIG_KEYS.SIDEBAR_WIDTH)
        : undefined;

      if (typeof saved === "number" && Number.isFinite(saved) && saved > 0) {
        this.setSidebarWidth(saved);
      } else {
        this.setSidebarWidth(DEFAULT_SIDEBAR_WIDTH_PX);
      }
    } catch {
      this.setSidebarWidth(DEFAULT_SIDEBAR_WIDTH_PX);
    }

    let activePointerId: number | null = null;
    let startX = 0;
    let startWidth = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      const delta = event.clientX - startX;
      const nextWidth = startWidth + delta;
      this.setSidebarWidth(nextWidth);
      updateAria();
    };

    const stopResize = () => {
      if (activePointerId === null) {
        return;
      }

      activePointerId = null;
      handle.classList.remove("active");
      document.removeEventListener("pointermove", onPointerMove);

      const appBody = root.querySelector(".app-body");
      if (appBody instanceof HTMLElement) {
        const value = parseFloat(
          appBody.style.getPropertyValue("--sidebar-width"),
        );
        if (Number.isFinite(value) && value > 0) {
          void this.persistSidebarWidth(value);
        }
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      stopResize();
    };

    handle.addEventListener("pointerdown", (event: PointerEvent) => {
      if (
        event.pointerType === "mouse" &&
        event.button !== 0 &&
        event.button !== -1
      ) {
        return;
      }

      if (window.innerWidth < 896) {
        return;
      }

      event.preventDefault();
      activePointerId = event.pointerId;
      startX = event.clientX;
      startWidth = sidebar.getBoundingClientRect().width;
      handle.classList.add("active");

      handle.setPointerCapture(event.pointerId);
      document.addEventListener("pointermove", onPointerMove);
    });

    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", stopResize);
    handle.addEventListener("dblclick", () => {
      this.setSidebarWidth(DEFAULT_SIDEBAR_WIDTH_PX);
      void this.persistSidebarWidth(DEFAULT_SIDEBAR_WIDTH_PX);
      updateAria();
    });

    handle.addEventListener("keydown", (event: KeyboardEvent) => {
      if (window.innerWidth < 896) {
        return;
      }

      const step = event.shiftKey ? 32 : 12;
      const current = getCurrentWidth();
      let next: number | null = null;

      if (event.key === "ArrowRight") {
        next = current + step;
      } else if (event.key === "ArrowLeft") {
        next = current - step;
      } else if (event.key === "Home") {
        next = MIN_SIDEBAR_WIDTH_PX;
      } else if (event.key === "End") {
        next = this.clampSidebarWidth(Number.MAX_SAFE_INTEGER);
      }

      if (next === null) {
        return;
      }

      event.preventDefault();
      this.setSidebarWidth(next);
      updateAria();
      void this.persistSidebarWidth(this.clampSidebarWidth(getCurrentWidth()));
    });

    updateAria();

    this.addCleanup(() => {
      stopResize();
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", stopResize);
    });
  }

  /**
   * Update host element theme classes
   */
  updateHostTheme(theme: string) {
    if (theme === Themes.Dark) {
      this.classList.add("dark-mode");
      this.classList.remove("light-mode");
    } else {
      this.classList.add("light-mode");
      this.classList.remove("dark-mode");
    }
  }

  /**
   * Update theme toggle icons based on current theme
   */
  updateThemeIcons(theme: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const sunIcon: HTMLElement | null = root.querySelector(".sun-icon");
    const moonIcon: HTMLElement | null = root.querySelector(".moon-icon");

    if (sunIcon && moonIcon) {
      if (theme === Themes.Dark) {
        sunIcon.style.display = "block";
        sunIcon.removeAttribute("hidden");
        sunIcon.classList.remove("hidden");

        moonIcon.style.display = "none";
        moonIcon.setAttribute("hidden", "hidden");
        moonIcon.classList.add("hidden");
      } else {
        sunIcon.style.display = "none";
        sunIcon.setAttribute("hidden", "hidden");
        sunIcon.classList.add("hidden");

        moonIcon.style.display = "block";
        moonIcon.removeAttribute("hidden");
        moonIcon.classList.remove("hidden");
      }
    }
  }

  /**
   * Show a specific page
   */
  showPage(page: string, persist = true) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Hide all pages
    root.querySelectorAll(".page").forEach((p) => {
      const el = p;
      el.classList.remove("active");
    });

    root.querySelectorAll(".nav-item").forEach((n) => {
      const el = n;
      el.classList.remove("active");
    });

    // Show selected page
    const pageEl = root.querySelector(`[data-page-id="${page}"]`);
    if (pageEl) {
      const el = pageEl;
      el.classList.add("active");
    }

    const navEl = root.querySelector(`[data-page="${page}"]`);
    if (navEl) {
      const el = navEl;
      el.classList.add("active");
    }

    this.currentPage = page;
    if (persist && this.db) {
      orchestratorStore.setActivePage(this.db, page).catch(console.error);
    }

    this.scheduleTerminalPlacement();
    this.syncPageHeaderMainVisibilityOverride();
    this.updateHeaderMainToggle();
    this.updateActivityLogToggleVisibility();

    // Scroll to top
    const activePage = root.querySelector(".page.active");
    if (activePage) {
      const el = activePage;
      el.scrollTo(0, 0);
    }

    // Auto-refresh files if switching to the files tab
    if (page === "files" && this.db) {
      orchestratorStore.loadFiles(this.db).catch(console.error);
    }
  }

  toggleTerminalVisibility() {
    this.terminalVisible = !this.terminalVisible;
    this.updateTerminalToggle();
    this.scheduleTerminalPlacement();
  }

  scheduleTerminalPlacement() {
    if (this.terminalPlacementFrame !== null) {
      cancelAnimationFrame(this.terminalPlacementFrame);
    }

    this.terminalPlacementFrame = requestAnimationFrame(() => {
      this.terminalPlacementFrame = null;
      this.syncTerminalPlacement();
    });
  }

  syncTerminalPlacement() {
    const terminal = this.terminalElement;
    if (!terminal) {
      return;
    }

    const slot = this.getTerminalSlotForPage(this.currentPage);
    if (!slot) {
      return;
    }

    if (terminal.parentElement !== slot) {
      slot.appendChild(terminal);
    }

    const shouldHide = !this.terminalVisible;
    terminal.hidden = shouldHide;

    if (shouldHide) {
      slot.setAttribute("hidden", "hidden");
      this.shadowRoot
        ?.querySelector("shadow-claw-terminal")
        ?.setAttribute("hidden", "hidden");
    } else {
      slot.removeAttribute("hidden");
      this.shadowRoot
        ?.querySelector("shadow-claw-terminal")
        ?.removeAttribute("hidden");
    }
  }

  getTerminalSlotForPage(page: string): HTMLElement | null {
    const root = this.shadowRoot;
    if (!root || !["chat", "tasks", "files"].includes(page)) {
      return null;
    }

    const pageEl = root.querySelector(`[data-page-id="${page}"]`);
    if (!(pageEl instanceof HTMLElement)) {
      return null;
    }

    const child = pageEl.querySelector(
      "shadow-claw-chat, shadow-claw-tasks, shadow-claw-files",
    );

    const slot =
      child instanceof HTMLElement
        ? child.shadowRoot?.querySelector("[data-terminal-slot]")
        : null;

    return slot instanceof HTMLElement ? slot : null;
  }

  updateTerminalToggle() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const button = root.querySelector(".webvm-toggle");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const available = !this.vmStatus.error;

    button.hidden = !available;
    button.classList.toggle("hidden", !available);
    button.classList.remove(
      "webvm-toggle--hidden",
      "webvm-toggle--visible",
      "webvm-toggle--booting",
      "webvm-toggle--ready",
      "webvm-toggle--error",
    );

    if (!available) {
      button.classList.add("webvm-toggle--error");

      return;
    }

    button.classList.add(
      this.terminalVisible ? "webvm-toggle--visible" : "webvm-toggle--hidden",
    );

    if (this.vmStatus.ready) {
      button.classList.add("webvm-toggle--ready");
    } else if (this.vmStatus.booting || this.vmStatus.bootAttempted) {
      button.classList.add("webvm-toggle--booting");
    }

    button.setAttribute(
      "aria-label",
      this.terminalVisible ? "Hide WebVM terminal" : "Show WebVM terminal",
    );
    button.setAttribute(
      "title",
      this.terminalVisible ? "Hide WebVM terminal" : "Show WebVM terminal",
    );

    button.setAttribute("aria-pressed", String(this.terminalVisible));
  }

  getPageHeaderElements(): PageHeaderLikeElement[] {
    const root = this.shadowRoot;
    if (!root) {
      return [];
    }

    const containerSelectors = [
      "shadow-claw-chat",
      "shadow-claw-tasks",
      "shadow-claw-files",
      "shadow-claw-settings",
      "shadow-claw-tools",
      "shadow-claw-channels",
    ];

    const headers: PageHeaderLikeElement[] = [];

    for (const selector of containerSelectors) {
      const container = root.querySelector(selector);
      if (!(container instanceof HTMLElement)) {
        continue;
      }

      const header = container.shadowRoot?.querySelector(
        "shadow-claw-page-header",
      );
      if (header instanceof HTMLElement) {
        headers.push(header as PageHeaderLikeElement);
      }
    }

    return headers;
  }

  getActivePageHeaderElement(): PageHeaderLikeElement | null {
    const root = this.shadowRoot;
    if (!root) {
      return null;
    }

    const activePage = root.querySelector(".page.active");
    if (!(activePage instanceof HTMLElement)) {
      return null;
    }

    const pageContainer = activePage.querySelector(
      "shadow-claw-chat, shadow-claw-tasks, shadow-claw-files, shadow-claw-settings, shadow-claw-tools, shadow-claw-channels",
    );
    if (!(pageContainer instanceof HTMLElement)) {
      return null;
    }

    const header = pageContainer.shadowRoot?.querySelector(
      "shadow-claw-page-header",
    );

    return header instanceof HTMLElement
      ? (header as PageHeaderLikeElement)
      : null;
  }

  syncPageHeaderMainVisibilityOverride() {
    for (const header of this.getPageHeaderElements()) {
      header.setMainCollapsedOverride?.(this.headerMainCollapsedOverride);
    }
  }

  updateHeaderMainToggle() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const button = root.querySelector(".header-main-toggle");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const collapsed =
      typeof this.headerMainCollapsedOverride === "boolean"
        ? this.headerMainCollapsedOverride
        : (this.getActivePageHeaderElement()?.isMainCollapsed?.() ?? false);

    button.setAttribute(
      "aria-label",
      collapsed ? "Show action header" : "Hide action header",
    );
    button.setAttribute(
      "title",
      collapsed ? "Show action header" : "Hide action header",
    );
    button.setAttribute("aria-pressed", String(collapsed));
  }

  togglePageHeaderMainVisibility() {
    const currentCollapsed =
      typeof this.headerMainCollapsedOverride === "boolean"
        ? this.headerMainCollapsedOverride
        : (this.getActivePageHeaderElement()?.isMainCollapsed?.() ?? false);

    this.headerMainCollapsedOverride = !currentCollapsed;
    this.syncPageHeaderMainVisibilityOverride();
    this.updateHeaderMainToggle();
  }

  updateActivityLogToggleVisibility() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const button = root.querySelector(".activity-log-toggle");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.hidden = this.currentPage !== "chat";
  }

  updateActivityLogToggle() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const button = root.querySelector(".activity-log-toggle");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const autoCollapsed =
      typeof globalThis.matchMedia === "function"
        ? !globalThis.matchMedia("(min-width: 56rem) and (min-height: 401px)")
            .matches
        : false;

    const collapsed =
      typeof this.activityLogCollapsedOverride === "boolean"
        ? this.activityLogCollapsedOverride
        : autoCollapsed;

    button.setAttribute(
      "aria-label",
      collapsed ? "Show activity log" : "Hide activity log",
    );
    button.setAttribute(
      "title",
      collapsed ? "Show activity log" : "Hide activity log",
    );
    button.setAttribute("aria-pressed", String(collapsed));
  }

  toggleActivityLogVisibility() {
    const autoCollapsed =
      typeof globalThis.matchMedia === "function"
        ? !globalThis.matchMedia("(min-width: 56rem) and (min-height: 401px)")
            .matches
        : false;

    const currentCollapsed =
      typeof this.activityLogCollapsedOverride === "boolean"
        ? this.activityLogCollapsedOverride
        : autoCollapsed;

    this.activityLogCollapsedOverride = !currentCollapsed;
    this.syncActivityLogVisibilityOverride();
    this.updateActivityLogToggle();
  }

  syncActivityLogVisibilityOverride() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const chat = root.querySelector("shadow-claw-chat") as any;
    if (chat && typeof chat.setActivityLogCollapsedOverride === "function") {
      chat.setActivityLogCollapsedOverride(this.activityLogCollapsedOverride);
    }
  }

  /**
   * Setup reactive effects
   */
  setupEffects() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // React to orchestrator state for completion notifications
    effect(() => {
      const state = orchestratorStore.state;

      if (
        state === "idle" &&
        (this.previousOrchestratorState === "thinking" ||
          this.previousOrchestratorState === "responding")
      ) {
        showSuccess("Response complete", 2500);
      }

      this.previousOrchestratorState = state;
    });

    // React to page changes from store
    effect(() => {
      const page = orchestratorStore.activePage;
      if (page !== this.currentPage) {
        this.showPage(page, false);
      }
    });
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClaw);
}
