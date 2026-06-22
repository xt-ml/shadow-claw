import { effect } from "../../effect.js";
import {
  buildRoutePath,
  parseRouteFromUrl,
  applyBasePath,
  type ShadowClawAppRoute,
} from "../../app-routes.js";
import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../../config.js";
import { ShadowClawNavigateDetail } from "../../utils/utils.js";

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
import { ulid } from "../../utils/ulid.js";
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
import type { RoomInvitePayload } from "../../channels/peer-protocol.js";
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
import "../shadow-claw-pages/shadow-claw-pages.js";
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

function historyState(finalPath: string, options) {
  const finalPathWithSlash =
    options.useTrailingSlash && !finalPath.includes("#")
      ? finalPath.endsWith("/")
        ? finalPath
        : finalPath + "/"
      : finalPath;

  if (options.replace) {
    window.history.replaceState({}, "", finalPathWithSlash);
  } else {
    window.history.pushState({}, "", finalPathWithSlash);
  }
}

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

  currentPage: string = orchestratorStore.sidebarDefaultPage;
  orchestrator: Orchestrator = new Orchestrator();
  previousOrchestratorState: OrchestratorState = "idle";
  terminalElement: ShadowClawTerminal | null = null;
  terminalPlacementFrame: number | null = null;
  terminalVisible: boolean = false;
  pagesSidebarHidden: boolean = false;
  vmStatusCleanup: (() => void) | null = null;
  headerMainCollapsedOverride: boolean | null = null;
  activityLogCollapsedOverride: boolean | null = null;
  popstateListener: (() => void) | null = null;
  fallbackClickListenerAttached: boolean = false;
  navigationListenerAttached: boolean = false;

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
      this.showPage(orchestratorStore.activePage, false);
    } else if (this.pagesSidebarHidden) {
      this.showPage(this.getDefaultSidebarPage(), false);
    } else {
      this.showPage(orchestratorStore.activePage, false);
    }

    await this.applyRouteFromCurrentLocation();

    await this.processPeerQueryParam();

    await this.processRoomQueryParam();

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

  private async processPeerQueryParam(): Promise<void> {
    if (!this.db) {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const peerParam = currentUrl.searchParams.get("peer");
    if (!peerParam) {
      return;
    }

    const remotePeerId = peerParam.trim();
    if (!remotePeerId) {
      return;
    }

    try {
      // 1. Ensure PeerJS channel is enabled and configured
      const cfg = this.orchestrator.getPeerJsConfig();
      let myPeerId = cfg.myPeerId;
      if (!myPeerId) {
        myPeerId = ulid().toLowerCase();
      }

      // Automatically trust the remote peer we are connecting to
      const trusted = new Set(cfg.trustedPeerIds);
      trusted.add(remotePeerId);

      // Save/configure
      await this.orchestrator.configurePeerJs(
        this.db,
        myPeerId,
        Array.from(trusted),
        cfg.serverHost,
        cfg.serverPort,
        cfg.serverPath,
        cfg.serverSecure,
      );

      if (!cfg.enabled) {
        await this.orchestrator.setChannelEnabled(this.db, "peerjs", true);
      }

      // 2. Ensure peer conversation exists in the list
      const targetGroupId = await orchestratorStore.ensurePeerConversation(
        this.db,
        remotePeerId,
      );

      // 3. Switch conversation and navigate to chat
      await orchestratorStore.switchConversation(this.db, targetGroupId);
      this.showPage("chat");

      // 4. Remove 'peer' from URL params to prevent re-triggering
      currentUrl.searchParams.delete("peer");
      const cleaned = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      window.history.replaceState({}, "", cleaned || "/");

      showSuccess(`Connected to Peer: ${remotePeerId.substring(0, 8)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to process peer parameter: ${message}`, 6000);
    }
  }

  private async processRoomQueryParam(): Promise<void> {
    if (!this.db) {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const roomId = (currentUrl.searchParams.get("room") || "").trim();
    const hostPeerId = (currentUrl.searchParams.get("host") || "").trim();
    const roomName =
      (currentUrl.searchParams.get("name") || "").trim() || "Room";

    if (!roomId || !hostPeerId) {
      return;
    }

    try {
      // 1. Ensure PeerJS channel is enabled and the host is trusted
      const cfg = this.orchestrator.getPeerJsConfig();
      let myPeerId = cfg.myPeerId;
      if (!myPeerId) {
        myPeerId = ulid().toLowerCase();
      }

      const trusted = new Set(cfg.trustedPeerIds);
      trusted.add(hostPeerId);

      await this.orchestrator.configurePeerJs(
        this.db,
        myPeerId,
        Array.from(trusted),
        cfg.serverHost,
        cfg.serverPort,
        cfg.serverPath,
        cfg.serverSecure,
      );

      if (!cfg.enabled) {
        await this.orchestrator.setChannelEnabled(this.db, "peerjs", true);
      }

      // 2. Join the room (connects to host + announces membership)
      this.orchestrator.joinRoomViaLink(roomId, hostPeerId, roomName);

      // 3. Navigate to the room conversation
      await orchestratorStore.switchConversation(this.db, `room:${roomId}`);
      this.showPage("chat");

      // 4. Clean the URL to prevent re-triggering
      currentUrl.searchParams.delete("room");
      currentUrl.searchParams.delete("host");
      currentUrl.searchParams.delete("name");
      const cleaned = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      window.history.replaceState({}, "", cleaned || "/");

      showSuccess(`Joined room "${roomName}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to join room: ${message}`, 6000);
    }
  }

  async render() {
    // Bind event listeners
    this.bindEventListeners(this.db);

    await this.loadPagesSidebarVisibilityPreference();

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

    this.orchestrator.events.on(
      "room-invite",
      async (invite: RoomInvitePayload) => {
        if (!this.db || !invite?.roomId || !invite?.hostPeerId) {
          return;
        }

        const from = invite.fromAlias || invite.fromPeerId;
        const accepted = await this.requestConfirmation({
          title: "Room invitation",
          message: `${from} invited you to join "${invite.roomName}".`,
          confirmLabel: "Join",
          cancelLabel: "Decline",
        });

        if (!accepted) {
          return;
        }

        try {
          this.orchestrator.joinRoomViaLink(
            invite.roomId,
            invite.hostPeerId,
            invite.roomName,
          );

          await orchestratorStore.switchConversation(
            this.db,
            `room:${invite.roomId}`,
          );
          this.showPage("chat");
          showSuccess(`Joined room "${invite.roomName}"`);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          showError(`Failed to join room: ${message}`, 6000);
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

    document.removeEventListener(
      "shadow-claw-navigate",
      this.handleShadowClawNavigate,
    );

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

  private supportsNavigationApi(): boolean {
    const nav = (window as any).navigation;

    return !!(
      nav &&
      typeof nav.addEventListener === "function" &&
      typeof nav.navigate === "function"
    );
  }

  private fallbackClickListener = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const path = event.composedPath();
    let link: HTMLAnchorElement | null = null;
    for (const el of path) {
      if (el instanceof HTMLAnchorElement) {
        link = el;

        break;
      }
    }

    if (!link) {
      return;
    }

    const href = link.getAttribute("href") || "";
    if (
      !href ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      return;
    }

    if (link.target && link.target !== "_self") {
      return;
    }

    if (link.origin !== window.location.origin) {
      return;
    }

    if (
      link.pathname === window.location.pathname &&
      link.search === window.location.search &&
      link.hash !== window.location.hash
    ) {
      return;
    }

    event.preventDefault();
    const targetPath = `${link.pathname}${link.search}${link.hash}`;

    historyState(targetPath, { replace: false, useTrailingSlash: false });
    void this.applyRouteFromCurrentLocation();
  };

  private async applyRouteFromCurrentLocation(): Promise<void> {
    const parsed = parseRouteFromUrl(
      new URL(window.location.href),
      orchestratorStore.activeGroupId,
    );
    if (!parsed) {
      return;
    }

    await this.applyRoute(parsed);
  }

  private normalizePageRoute(page: string): ShadowClawAppRoute["page"] {
    const normalized = String(page || "chat").toLowerCase();

    if (
      normalized === "chat" ||
      normalized === "files" ||
      normalized === "tasks" ||
      normalized === "pages" ||
      normalized === "settings" ||
      normalized === "tools" ||
      normalized === "channels"
    ) {
      return normalized;
    }

    return "chat";
  }

  private async navigateToRoute(
    route: ShadowClawAppRoute,
    options: { replace?: boolean } = { replace: true },
  ): Promise<void> {
    const targetPath = buildRoutePath(route);
    const finalPath = applyBasePath(targetPath);

    if (this.supportsNavigationApi()) {
      const nav = (window as any).navigation;

      nav.navigate(finalPath, {
        history: options.replace ? "replace" : "auto",
      });

      historyState(finalPath, options);

      return;
    }

    // historyState(finalPath, { replace: true });

    await this.applyRoute(route, options);
  }

  private async applyAnchorWithRetry(
    apply: () => boolean,
    maxAttempts = 3,
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (apply()) {
        return;
      }

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
  }

  handleNavigationApiNavigate = (event: Event) => {
    if (!this.db) {
      return;
    }

    const navigateEvent = event as any;
    const destinationUrl = navigateEvent?.destination?.url;
    if (typeof destinationUrl !== "string") {
      return;
    }

    const parsedUrl = new URL(destinationUrl);
    if (parsedUrl.origin !== window.location.origin) {
      return;
    }

    const route = parseRouteFromUrl(parsedUrl, orchestratorStore.activeGroupId);
    if (!route) {
      return;
    }

    if (typeof navigateEvent.intercept === "function") {
      navigateEvent.intercept({
        handler: async () => {
          await this.applyRoute(route, { replace: true });
        },
      });
    }
  };

  applyRoute = async (
    route: ShadowClawAppRoute,
    options: { replace?: boolean } = { replace: false },
  ) => {
    if (options.replace) {
      const targetPath = buildRoutePath(route);
      const finalPath = applyBasePath(targetPath);

      if (finalPath !== window.location.pathname) {
        historyState(finalPath, { ...options, useTrailingSlash: false });
      }
    }

    const { page, groupId, path, anchor } = route;
    if (!this.db) {
      return;
    }

    const resolvedPage = page ? String(page).toLowerCase() : "";

    if (resolvedPage && fileViewerStore.file) {
      const targetIsSameFile =
        resolvedPage === "files" &&
        path &&
        path === fileViewerStore.file.path &&
        (!groupId || groupId === orchestratorStore.activeGroupId);

      if (!targetIsSameFile) {
        const viewer = this.shadowRoot?.querySelector(
          "shadow-claw-file-viewer",
        ) as any;
        if (viewer && typeof viewer.requestCloseViewer === "function") {
          const closed = await viewer.requestCloseViewer();
          if (!closed) {
            return;
          }
        } else {
          fileViewerStore.closeFile();
        }
      }
    }

    if (groupId && groupId !== orchestratorStore.activeGroupId) {
      await orchestratorStore.switchConversation(
        this.db,
        groupId,
        resolvedPage === "chat",
      );
    } else if (groupId) {
      // groupId matches the currently active group (restored from last session),
      // but content may not have loaded yet — ensure it is present.
      void orchestratorStore.loadHistory();
      if (resolvedPage === "tasks" || resolvedPage === "files") {
        if (this.db) {
          void orchestratorStore.loadFiles(this.db);
        }
      }
    }

    if (resolvedPage) {
      this.showPage(resolvedPage);
    }

    if (resolvedPage === "files" && path) {
      const hasExtension = /\.[^./]+$/u.test(path);
      if (hasExtension) {
        try {
          await fileViewerStore.openFile(
            this.db,
            path,
            groupId || orchestratorStore.activeGroupId,
          );
          if (anchor) {
            await this.applyAnchorWithRetry(() => {
              const viewer = this.shadowRoot?.querySelector(
                "shadow-claw-file-viewer",
              ) as any;
              if (
                viewer &&
                typeof viewer.handleAnchorNavigation === "function"
              ) {
                return !!viewer.handleAnchorNavigation(anchor);
              }

              return false;
            });
          }
        } catch (err) {
          console.error("Failed to open file via route navigation:", path, err);
        }
      } else {
        try {
          await orchestratorStore.setCurrentPath(this.db, path);
          fileViewerStore.closeFile();
        } catch (err) {
          console.error(
            "Failed to open folder via route navigation:",
            path,
            err,
          );
        }
      }
    }

    if (resolvedPage === "pages" && path) {
      const pagesComp = this.shadowRoot?.querySelector(
        "shadow-claw-pages",
      ) as any;
      if (pagesComp) {
        pagesComp.selectedPage = {
          groupId:
            groupId || orchestratorStore.activeGroupId || DEFAULT_GROUP_ID,
          path: path,
        };
        await pagesComp.renderSelectedPage();
        if (anchor) {
          await this.applyAnchorWithRetry(() => {
            if (typeof pagesComp.handleAnchorNavigation === "function") {
              return !!pagesComp.handleAnchorNavigation(anchor);
            }

            return false;
          });
        }
      }
    }
  };

  handleShadowClawNavigate = async (event: Event) => {
    const customEvent = event as CustomEvent<ShadowClawNavigateDetail>;
    const detail = customEvent.detail;
    if (!detail) {
      return;
    }

    await this.navigateToRoute({
      page: this.normalizePageRoute(String(detail.page || "chat")),
      groupId: detail.groupId,
      path: detail.path,
      anchor: detail.anchor,
    });
  };

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
    detailsEl.replaceChildren();
    linksEl.replaceChildren();

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
      (item as HTMLLIElement).addEventListener("click", () => {
        const page =
          (item as HTMLLIElement).dataset.page || this.getDefaultSidebarPage();
        document.dispatchEvent(
          new CustomEvent("shadow-claw-navigate", {
            detail: { page },
            bubbles: true,
            composed: true,
          }),
        );
      });
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

      // Close sidebar when clicking outside of it (mobile only).
      // Use composedPath() instead of e.target because Shadow DOM event
      // retargeting makes e.target the host element at the document level,
      // so contains() checks on shadow-root children always return false.
      document.addEventListener("click", (e: MouseEvent) => {
        const path = e.composedPath();
        if (
          window.innerWidth < 896 &&
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

      void this.initSidebarResize(sidebar as HTMLElement);
    }

    // Settings button
    const settingsBtn = root.querySelector('[data-action="show-settings"]');
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("shadow-claw-navigate", {
            detail: { page: "settings" },
            bubbles: true,
            composed: true,
          }),
        );
      });
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
        document.dispatchEvent(
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
        this.setPagesSidebarHidden(hidden);
      },
    );

    // Tools page "Back to Settings" navigation
    const toolsPage = root.querySelector("shadow-claw-tools");
    toolsPage?.addEventListener("navigate-back", () =>
      document.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail: { page: "settings" },
          bubbles: true,
          composed: true,
        }),
      ),
    );

    // Channels page "Back to Settings" navigation
    const channelsPage = root.querySelector("shadow-claw-channels");
    channelsPage?.addEventListener("navigate-back", () =>
      document.dispatchEvent(
        new CustomEvent("shadow-claw-navigate", {
          detail: { page: "settings" },
          bubbles: true,
          composed: true,
        }),
      ),
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

    document.addEventListener(
      "shadow-claw-navigate",
      this.handleShadowClawNavigate,
    );

    if (this.supportsNavigationApi()) {
      const nav = (window as any).navigation;
      nav.addEventListener("navigate", this.handleNavigationApiNavigate);
      this.navigationListenerAttached = true;
    } else {
      this.popstateListener = () => {
        void this.applyRouteFromCurrentLocation();
      };
      window.addEventListener("popstate", this.popstateListener);

      document.addEventListener("click", this.fallbackClickListener);
      this.fallbackClickListenerAttached = true;
    }

    // Listen for theme changes to update icons and host class
    window.addEventListener("shadow-claw-theme-change", (e: Event) => {
      const theme = (e as CustomEvent).detail.theme;
      this.updateThemeIcons(theme);
      this.updateHostTheme(theme);
    });

    // Listen for PeerJS connection errors
    window.addEventListener("shadow-claw-peer-error", (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const remotePeerId = detail.remotePeerId;
      const errorMessage = detail.error;

      const title = "Peer Connection Error";
      const message = remotePeerId
        ? `Failed to communicate with peer ${remotePeerId}: ${errorMessage}`
        : `PeerJS error: ${errorMessage}`;

      void this.requestDialog({
        mode: "info",
        title,
        message,
        confirmLabel: "Dismiss",
      });
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

    const resolvedPage = this.resolvePageForVisibility(page);

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
    const pageEl = root.querySelector(`[data-page-id="${resolvedPage}"]`);
    if (pageEl) {
      const el = pageEl;
      el.classList.add("active");
    }

    const navEl = root.querySelector(`[data-page="${resolvedPage}"]`);
    if (navEl) {
      const el = navEl;
      el.classList.add("active");
    }

    this.currentPage = resolvedPage;
    if (persist && this.db) {
      orchestratorStore
        .setActivePage(this.db, resolvedPage)
        .catch(console.error);
    }

    this.scheduleTerminalPlacement();
    this.syncPageHeaderMainVisibilityOverride();
    this.updateHeaderMainToggle();
    this.updateActivityLogToggleVisibility();
    this.updateTerminalToggle();

    // Scroll to top
    const activePage = root.querySelector(".page.active");
    if (activePage) {
      const el = activePage;
      if (typeof el.scrollTo === "function") {
        el.scrollTo(0, 0);
      }
    }

    // Auto-refresh files if switching to the files tab
    if (resolvedPage === "files" && this.db) {
      orchestratorStore.loadFiles(this.db).catch(console.error);
    }
  }

  private resolvePageForVisibility(page: string): string {
    if (this.pagesSidebarHidden && page === "pages") {
      return this.getDefaultSidebarPage();
    }

    return page;
  }

  private getDefaultSidebarPage(): "chat" | "tasks" | "files" {
    const page = orchestratorStore.sidebarDefaultPage;
    if (page === "chat" || page === "tasks" || page === "files") {
      return page;
    }

    return "chat";
  }

  private parseConfigBoolean(value: unknown): boolean {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value === 1;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      return normalized === "true" || normalized === "1";
    }

    return false;
  }

  private applyPagesSidebarVisibility() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const pagesNavItem = root.querySelector(
      '.nav-item[data-page="pages"]',
    ) as HTMLElement | null;

    if (!pagesNavItem) {
      return;
    }

    pagesNavItem.hidden = this.pagesSidebarHidden;
    pagesNavItem.setAttribute("aria-hidden", String(this.pagesSidebarHidden));
  }

  private setPagesSidebarHidden(hidden: boolean) {
    this.pagesSidebarHidden = hidden;
    this.applyPagesSidebarVisibility();

    if (hidden && this.currentPage === "pages") {
      this.showPage(this.getDefaultSidebarPage());
    }
  }

  private async loadPagesSidebarVisibilityPreference(): Promise<void> {
    if (!this.db) {
      this.setPagesSidebarHidden(false);

      return;
    }

    try {
      const raw = await getConfig(this.db, CONFIG_KEYS.SIDEBAR_PAGES_HIDDEN);
      this.setPagesSidebarHidden(this.parseConfigBoolean(raw));
    } catch {
      this.setPagesSidebarHidden(false);
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

    const available =
      this.currentPage === "chat" || this.currentPage === "files";

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
      "shadow-claw-pages",
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
      "shadow-claw-chat, shadow-claw-tasks, shadow-claw-files, shadow-claw-pages, shadow-claw-settings, shadow-claw-tools, shadow-claw-channels",
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

    button.hidden =
      this.currentPage !== "chat" || orchestratorStore.activityLog.length === 0;
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

    // React to activityLog changes to show/hide the activity-log-toggle button.
    effect(() => {
      void orchestratorStore.activityLog; // track signal read
      this.updateActivityLogToggleVisibility();
    });
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClaw);
}
