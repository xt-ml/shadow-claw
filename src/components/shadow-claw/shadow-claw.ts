import type { Orchestrator } from "../../core/orchestrator/orchestrator.js";

import { ShadowClawDatabase, setDB } from "../../db/db.js";

import { VMStatus } from "../../shell/vm.js";

import { fileViewerStore } from "../../stores/file-viewer.js";

import {
  OrchestratorDisplayState,
  orchestratorStore,
} from "../../stores/orchestrator.js";

import { themeStore } from "../../stores/theme.js";

import { applyRoute } from "./utils/applyRoute.js";
import { applyRouteFromCurrentLocation } from "./utils/applyRouteFromCurrentLocation.js";
import { bindEventListeners } from "./utils/bindEventListeners.js";
import { clearBootPendingClass } from "../../core/utils/clearBootPendingClass.js";
import { getDefaultSidebarPage } from "./utils/getDefaultSidebarPage.js";
import { getRoute } from "./utils/getRoute.js";
import { getTargetPath } from "./utils/getTargetPath.js";
import { handleOrchestratorAskUser } from "./utils/handleOrchestratorAskUser.js";
import { handleOrchestratorOpenFile } from "./utils/handleOrchestratorOpenFile.js";
import { handleOrchestratorProviderHelp } from "./utils/handleOrchestratorProviderHelp.js";
import { handleOrchestratorRoomInvite } from "./utils/handleOrchestratorRoomInvite.js";
import { handleShadowClawNavigate } from "./utils/handleShadowClawNavigate.js";
import { historyState } from "./utils/historyState.js";
import { loadPagesSidebarVisibilityPreference } from "./utils/loadPagesSidebarVisibilityPreference.js";
import { processPeerQueryParam } from "./utils/processPeerQueryParam.js";
import { processPendingSharedPayloads } from "./utils/processPendingSharedPayloads.js";
import { processRoomQueryParam } from "./utils/processRoomQueryParam.js";
import { requestDialog } from "./utils/requestDialog.js";
import { scheduleTerminalPlacement } from "./utils/scheduleTerminalPlacement.js";
import { setupEffects } from "./utils/setupEffects.js";
import { showPage } from "./utils/showPage.js";
import { syncPageHeaderMainVisibilityOverride } from "./utils/syncPageHeaderMainVisibilityOverride.js";
import { updateActivityLogToggleVisibility } from "./utils/updateActivityLogToggleVisibility.js";
import { updateHeaderMainToggle } from "./utils/updateHeaderMainToggle.js";
import { updateTerminalToggle } from "./utils/updateTerminalToggle.js";

import type { RoomInvitePayload } from "../../subsystems/channels/peer-protocol.js";
import type { OpenFilePayload } from "../../subsystems/worker/types.js";
import type { AppDialogOptions } from "../../ui/types.js";
import type { ShadowClawTerminal } from "../shadow-claw-terminal/shadow-claw-terminal.js";
import type { ProviderHelpType } from "../types.js";

import ShadowClawElement from "../shadow-claw-element.js";

export {
  DEFAULT_SIDEBAR_WIDTH_PX,
  MIN_SIDEBAR_WIDTH_PX,
  MAX_SIDEBAR_WIDTH_PX,
} from "./constants.js";

import shadowClawStyles from "./shadow-claw.css" with { type: "css" };
import shadowClawTemplate from "./shadow-claw.html" with { type: "html" };

const elementName = "shadow-claw";

export class ShadowClaw extends ShadowClawElement {
  static styles = shadowClawStyles;
  static template = shadowClawTemplate;

  activityLogCollapsedOverride: boolean | null = null;
  currentPage: string = orchestratorStore.sidebarDefaultPage;
  db: ShadowClawDatabase | null = null;
  fallbackClickListenerAttached: boolean = false;
  headerMainCollapsedOverride: boolean | null = null;
  navigationListenerAttached: boolean = false;
  orchestrator!: Orchestrator;
  pagesSidebarHidden: boolean = false;
  chatSidebarHidden: boolean = false;
  tasksSidebarHidden: boolean = false;
  filesSidebarHidden: boolean = false;
  popstateListener: (() => void) | null = null;
  previousOrchestratorState: OrchestratorDisplayState = "idle";
  terminalElement: ShadowClawTerminal | null = null;
  terminalPlacementFrame: number | null = null;
  terminalVisible: boolean = false;

  vmStatus: VMStatus = {
    ready: false,
    booting: false,
    bootAttempted: false,
    error: null,
  };

  vmStatusCleanup: (() => void) | null = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    try {
      const { Orchestrator } =
        await import("../../core/orchestrator/orchestrator.js");

      // Lazily load non-critical UI components to reduce initial JS execution
      Promise.all([
        import("../shadow-claw-conversations/shadow-claw-conversations.js"),
        import("../shadow-claw-dialog/shadow-claw-dialog.js"),
        import("../shadow-claw-toast/shadow-claw-toast.js"),
      ]).catch(console.error);

      // Explicitly yield to the event loop to ensure Time to First Paint (TTFP)
      // fires before the heavy IndexedDB and Orchestrator init blocks the thread.
      await new Promise((resolve) => {
        if ("requestIdleCallback" in window) {
          (window as any).requestIdleCallback(() => resolve(null));
        } else {
          setTimeout(resolve, 0);
        }
      });

      if (!this.orchestrator) {
        this.orchestrator = new Orchestrator();
      }

      this.db = await this.orchestrator.init();

      // Initialize reactive app store wiring before child components rely on ready state.
      // We do this before setDB() so that components waiting on getDb() find a ready store.
      await orchestratorStore.init(this.db, this.orchestrator);
      setDB(this.db);

      await this.render();

      // Ensure initial route state matches persisted store state even when prerender
      // markup starts on a different page. On a fresh install (no persisted page),
      // trust the pre-rendered content instead of forcing to Chat — unless the
      // Pages sidebar is hidden, in which case we must redirect away from it.
      const isCurrentPageHidden =
        (orchestratorStore.activePage === "pages" && this.pagesSidebarHidden) ||
        (orchestratorStore.activePage === "chat" && this.chatSidebarHidden) ||
        (orchestratorStore.activePage === "tasks" && this.tasksSidebarHidden) ||
        (orchestratorStore.activePage === "files" && this.filesSidebarHidden);

      if (orchestratorStore.hadPersistedActivePage && !isCurrentPageHidden) {
        showPage(
          this.shadowRoot,
          this,
          this.db,
          orchestratorStore,
          orchestratorStore.activePage,
          false,
        );
      } else if (isCurrentPageHidden) {
        showPage(
          this.shadowRoot,
          this,
          this.db,
          orchestratorStore,
          getDefaultSidebarPage(orchestratorStore, this),
          false,
        );
      } else {
        showPage(
          this.shadowRoot,
          this,
          this.db,
          orchestratorStore,
          orchestratorStore.activePage,
          false,
        );
      }

      await applyRouteFromCurrentLocation(
        this.shadowRoot,
        this,
        this.db,
        fileViewerStore,
        orchestratorStore,
        new URL(window.location.href),
      );

      await processPeerQueryParam(
        this.shadowRoot,
        this,
        this.db,
        this.orchestrator,
      );

      await processRoomQueryParam(
        window,
        this.shadowRoot,
        this,
        this.db,
        this.orchestrator,
        orchestratorStore,
      );

      await processPendingSharedPayloads(
        window,
        this.shadowRoot,
        this,
        orchestratorStore,
        fileViewerStore,
        this.db,
        new URL(window.location.href),
      );

      console.log("ShadowClaw UI initialized");

      // Ensure the active page's component is fully upgraded before revealing the host.
      // applyRouteFromCurrentLocation only awaits the component if the URL explicitly
      // matches its route. When the URL is `/`, the route parser returns null, so
      // applyRoute is skipped. Awaiting here guarantees we never reveal stale SSR
      // markup (like the default prerendered page) before the CSR component
      // takes over and clears it, even on root URL loads.
      if (typeof customElements !== "undefined") {
        await customElements.whenDefined(`shadow-claw-${this.currentPage}`);
      }

      const { isMemoryStorageFallbackActive } =
        await import("../../storage/memoryStorage.js");
      if (isMemoryStorageFallbackActive()) {
        const { showWarning } = await import("../../ui/toast.js");
        showWarning(
          "Private Browsing / Limited Storage: Operating in temporary in-memory mode. Files and changes will not persist across page reloads.",
          7000,
        );
      }

      // Signal that the UI and initial routing are fully ready.
      // clearBootPendingClass is called immediately after setReady() so that
      // sc-prerender-override is removed only AFTER applyRouteFromCurrentLocation
      // has fully completed (including any await pagesComp.renderSelectedPage())
      // — eliminating the race where initializeApp's finally block would remove
      // the class while CSR content was still async-loading.
      orchestratorStore.setReady();
    } finally {
      // Always clear the boot-pending class so the app is never permanently
      // hidden behind sc-prerender-override, even if init throws.
      clearBootPendingClass(document);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.vmStatusCleanup) {
      this.vmStatusCleanup();
      this.vmStatusCleanup = null;
    }

    if (this.terminalPlacementFrame !== null) {
      cancelAnimationFrame(this.terminalPlacementFrame);
      this.terminalPlacementFrame = null;
    }

    document.removeEventListener("shadow-claw-navigate", this.shadowClawNav);

    if (this.popstateListener) {
      window.removeEventListener("popstate", this.popstateListener);
      this.popstateListener = null;
    }

    if (this.fallbackClickListenerAttached) {
      document.removeEventListener("click", this.fallbackClickListener);
      this.fallbackClickListenerAttached = false;
    }

    if (this.navigationListenerAttached) {
      const nav = (window as any).navigation;
      if (nav && typeof nav.removeEventListener === "function") {
        nav.removeEventListener("navigate", this.handleNavigationApiNavigate);
      }

      this.navigationListenerAttached = false;
    }
  }

  addCleanup(cb: () => void) {
    super.addCleanup(cb);
  }

  fallbackClickListener = (event: MouseEvent) => {
    if (typeof window === "undefined" || !window.location) {
      return;
    }

    const targetPath = getTargetPath(window.location, event);
    if (!targetPath) {
      return;
    }

    historyState(globalThis.history, targetPath, {
      replace: false,
      useTrailingSlash: false,
    });

    applyRouteFromCurrentLocation(
      this.shadowRoot,
      this,
      this.db,
      fileViewerStore,
      orchestratorStore,
      new URL(window.location.href),
    );
  };

  handleNavigationApiNavigate = (event: Event) => {
    const { parsedUrl, navigateEvent } = getRoute(this.db, event) ?? {};

    if (!parsedUrl || !navigateEvent) {
      return;
    }

    if (typeof navigateEvent.intercept === "function") {
      navigateEvent.intercept({
        handler: async () => {
          const { parseRouteFromUrlAsync } =
            await import("../../core/app-routes.js");
          const asyncRoute = await parseRouteFromUrlAsync(
            parsedUrl,
            orchestratorStore.activeGroupId,
          );
          if (!asyncRoute) {
            // Not a SPA route, we could assign location to force a server hit or just return.
            return;
          }

          await applyRoute(
            this.shadowRoot,
            this,
            this.db,
            fileViewerStore,
            orchestratorStore,
            asyncRoute,
          );
        },
      });
    }
  };

  shadowClawNav = (event: Event): void => {
    if (!this.shadowRoot || !this.db) {
      return;
    }

    handleShadowClawNavigate(
      this.shadowRoot,
      this,
      this.db,
      fileViewerStore,
      orchestratorStore,
      event,
    );
  };

  async render() {
    bindEventListeners(
      window,
      document,
      this.shadowRoot,
      this,
      this.db,
      orchestratorStore,
      fileViewerStore,
      themeStore,
      new URL(window.location.href),
    );

    await loadPagesSidebarVisibilityPreference(
      this.shadowRoot,
      this,
      orchestratorStore,
      this.db,
    );

    this.terminalElement = document.createElement(
      "shadow-claw-terminal",
    ) as ShadowClawTerminal;
    if (this.terminalElement) {
      this.terminalElement.orchestrator = this.orchestrator;
    }

    updateTerminalToggle(
      this.shadowRoot,
      this.currentPage,
      this.terminalVisible,
      this.vmStatus,
    );

    scheduleTerminalPlacement(
      this.shadowRoot,
      this.currentPage,
      this.terminalElement,
      this.terminalVisible,
      this.terminalPlacementFrame,
    );

    syncPageHeaderMainVisibilityOverride(
      this.shadowRoot,
      this.headerMainCollapsedOverride,
    );

    updateHeaderMainToggle(this.shadowRoot, this.headerMainCollapsedOverride);

    updateActivityLogToggleVisibility(
      this.shadowRoot,
      this.currentPage,
      orchestratorStore.activityLog.length,
    );

    const vmStatusListener = (status: VMStatus) => {
      this.vmStatus = status;

      // When WebVM is unavailable (for example mode = disabled), force-close
      // the panel before hiding the toggle so the UI cannot get stuck open.
      if (status.error && this.terminalVisible) {
        this.terminalVisible = false;
        if (this.terminalElement) {
          this.terminalElement.hidden = true;
        }

        scheduleTerminalPlacement(
          this.shadowRoot,
          this.currentPage,
          this.terminalElement,
          this.terminalVisible,
          this.terminalPlacementFrame,
        );
      }

      updateTerminalToggle(
        this.shadowRoot,
        this.currentPage,
        this.terminalVisible,
        this.vmStatus,
      );
    };

    this.vmStatus = this.orchestrator.vmStatus || this.vmStatus;

    updateTerminalToggle(
      this.shadowRoot,
      this.currentPage,
      this.terminalVisible,
      this.vmStatus,
    );

    this.orchestrator.events.on?.("vm-status", vmStatusListener);

    this.vmStatusCleanup = () => {
      this.orchestrator.events.off?.("vm-status", vmStatusListener);
    };

    // Bridge worker tool events to UI actions.
    this.orchestrator.events.on("open-file", (payload: OpenFilePayload) =>
      handleOrchestratorOpenFile(
        this.db,
        orchestratorStore,
        fileViewerStore,
        payload,
      ),
    );

    this.orchestrator.events.on(
      "provider-help",
      (payload: {
        providerId: string;
        reason?: string;
        helpType?: ProviderHelpType;
      }) => handleOrchestratorProviderHelp(document, this.shadowRoot, payload),
    );

    this.orchestrator.events.on("room-invite", (invite: RoomInvitePayload) =>
      handleOrchestratorRoomInvite(
        document,
        this.shadowRoot,
        this,
        this.db,
        orchestratorStore,
        invite,
      ),
    );

    this.orchestrator.events.on(
      "ask-user",
      (payload: {
        id: string;
        groupId: string;
        question: string;
        options?: string[];
      }) => handleOrchestratorAskUser(document, this.shadowRoot, this, payload),
    );

    // React to store changes using effect()
    setupEffects(this.shadowRoot, this, this.db, orchestratorStore);
  }

  async requestDialog(options: AppDialogOptions): Promise<boolean> {
    return requestDialog(document, this.shadowRoot, options);
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClaw);
}
