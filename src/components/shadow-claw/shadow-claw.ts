import { effect } from "../../effect.js";

import { ShadowClawDatabase, setDB } from "../../db/db.js";
import { Orchestrator, OrchestratorState } from "../../orchestrator.js";
import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { Themes, themeStore } from "../../stores/theme.js";
import { toolsStore } from "../../stores/tools.js";
import { showError, showSuccess } from "../../toast.js";
import { ConfirmationDialogOptions, OpenFilePayload } from "../../types.js";
import { VMStatus } from "../../vm.js";

import "../shadow-claw-chat/shadow-claw-chat.js";
import "../shadow-claw-channels/shadow-claw-channels.js";
import "../shadow-claw-conversations/shadow-claw-conversations.js";
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

export default class ShadowClaw extends ShadowClawElement {
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

    // React to store changes using effect()
    this.setupEffects();

    console.log("ShadowClaw UI initialized");

    // Signal that the UI is fully ready (listeners bound, etc.)
    orchestratorStore._ready.set(true);
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

  async requestConfirmation(options: ConfirmationDialogOptions) {
    const root = this.shadowRoot;
    if (!root) {
      return false;
    }

    const dialog = root.querySelector(
      ".app-confirm-dialog",
    ) as HTMLDialogElement | null;
    const titleEl = root.querySelector(
      ".app-confirm-dialog__title",
    ) as HTMLElement | null;
    const messageEl = root.querySelector(
      ".app-confirm-dialog__message",
    ) as HTMLElement | null;
    const confirmBtn = root.querySelector(
      ".app-confirm-dialog__btn--confirm",
    ) as HTMLButtonElement | null;
    const cancelBtn = root.querySelector(
      ".app-confirm-dialog__btn--cancel",
    ) as HTMLButtonElement | null;

    if (!dialog || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
      return false;
    }

    if (dialog.open) {
      dialog.close();
    }

    titleEl.textContent = options.title;
    messageEl.textContent = options.message;
    confirmBtn.textContent = options.confirmLabel || "Confirm";
    cancelBtn.textContent = options.cancelLabel || "Cancel";

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

  /**
   * Bind all event listeners to the component
   */
  bindEventListeners(db: ShadowClawDatabase): void {
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
    }

    // Settings button
    const settingsBtn = root.querySelector('[data-action="show-settings"]');
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => this.showPage("settings"));
    }

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
    const themeToggle = root.querySelector(".theme-toggle:not(.webvm-toggle)");
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

    button.setAttribute("aria-pressed", String(this.terminalVisible));
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
