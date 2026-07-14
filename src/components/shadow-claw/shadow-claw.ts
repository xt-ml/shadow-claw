import { Orchestrator, OrchestratorState } from "../../core/orchestrator.js";

import { ShadowClawDatabase, setDB } from "../../db/db.js";

import { VMStatus } from "../../shell/vm.js";

import { fileViewerStore } from "../../stores/file-viewer.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { themeStore } from "../../stores/theme.js";
import { toolsStore } from "../../stores/tools.js";

import { applyRoute } from "./utils/applyRoute.js";
import { applyRouteFromCurrentLocation } from "./utils/applyRouteFromCurrentLocation.js";
import { bindEventListeners } from "./utils/bindEventListeners.js";
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

import "../shadow-claw-channels/shadow-claw-channels.js";
import "../shadow-claw-chat/shadow-claw-chat.js";
import "../shadow-claw-conversations/shadow-claw-conversations.js";
import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../shadow-claw-file-viewer/shadow-claw-file-viewer.js";
import "../shadow-claw-files/shadow-claw-files.js";
import "../shadow-claw-pages/shadow-claw-pages.js";
import "../shadow-claw-pdf-viewer/shadow-claw-pdf-viewer.js";
import "../shadow-claw-settings/shadow-claw-settings.js";
import "../shadow-claw-tasks/shadow-claw-tasks.js";
import "../shadow-claw-terminal/shadow-claw-terminal.js";
import "../shadow-claw-toast/shadow-claw-toast.js";
import "../shadow-claw-tools/shadow-claw-tools.js";

import ShadowClawElement from "../shadow-claw-element.js";

export const DEFAULT_SIDEBAR_WIDTH_PX = 250;
export const MIN_SIDEBAR_WIDTH_PX = 200;
export const MAX_SIDEBAR_WIDTH_PX = 560;

const elementName = "shadow-claw";

export class ShadowClaw extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClaw.componentPath}/${elementName}.css`;
  static template = `${ShadowClaw.componentPath}/${elementName}.html`;

  activityLogCollapsedOverride: boolean | null = null;
  currentPage: string = orchestratorStore.sidebarDefaultPage;
  db: ShadowClawDatabase | null = null;
  fallbackClickListenerAttached: boolean = false;
  headerMainCollapsedOverride: boolean | null = null;
  navigationListenerAttached: boolean = false;
  orchestrator: Orchestrator = new Orchestrator();
  pagesSidebarHidden: boolean = false;
  popstateListener: (() => void) | null = null;
  previousOrchestratorState: OrchestratorState = "idle";
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

    // Ensure initial route state matches persisted store state even when prerender
    // markup starts on a different page. On a fresh install (no persisted page),
    // trust the pre-rendered content instead of forcing to Chat — unless the
    // Pages sidebar is hidden, in which case we must redirect away from it.
    if (orchestratorStore.hadPersistedActivePage) {
      showPage(
        this.shadowRoot,
        this,
        this.db,
        orchestratorStore,
        orchestratorStore.activePage,
        false,
      );
    } else if (this.pagesSidebarHidden) {
      showPage(
        this.shadowRoot,
        this,
        this.db,
        orchestratorStore,
        getDefaultSidebarPage(orchestratorStore),
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
    const { route, navigateEvent } =
      getRoute(this.db, orchestratorStore, event) ?? {};

    if (!route || !navigateEvent) {
      return;
    }

    if (typeof navigateEvent.intercept === "function") {
      navigateEvent.intercept({
        handler: async () => {
          await applyRoute(
            this.shadowRoot,
            this,
            this.db,
            fileViewerStore,
            orchestratorStore,
            route,
            { replace: true },
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

    this.vmStatus = this.orchestrator.getVMStatus?.() || this.vmStatus;

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

    // Load persisted tool configuration
    await toolsStore.load(this.db);

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

    console.log("ShadowClaw UI initialized");

    // Signal that the UI is fully ready (listeners bound, etc.)
    orchestratorStore.setReady();
  }

  async requestDialog(options: AppDialogOptions): Promise<boolean> {
    return requestDialog(document, this.shadowRoot, options);
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClaw);
}
