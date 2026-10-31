import { jest } from "@jest/globals";

describe("showPage", () => {
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let db: any;
  let oStore: any;

  let showPage: any;
  let mockResolvePageForVisibility: any;
  let mockScheduleTerminalPlacement: any;
  let mockSyncPageHeaderMainVisibilityOverride: any;
  let mockUpdateActivityLogToggleVisibility: any;
  let mockUpdateHeaderMainToggle: any;
  let mockUpdateTerminalToggle: any;
  let mockEnsureComponentLoaded: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowRoot.innerHTML = `
      <div class="page active" data-page-id="old"></div>
      <div class="page" data-page-id="chat"></div>
      <div class="page" data-page-id="tasks"></div>
      <div class="page" data-page-id="files"></div>
      <div class="page" data-page-id="pages"></div>
      <div class="nav-item active" data-page="old"></div>
      <div class="nav-item" data-page="chat"></div>
      <div class="nav-item" data-page="tasks"></div>
      <div class="nav-item" data-page="files"></div>
      <div class="nav-item" data-page="pages"></div>
    `;

    shadowClaw = {
      pagesSidebarHidden: false,
      chatSidebarHidden: false,
      tasksSidebarHidden: false,
      filesSidebarHidden: false,
      currentPage: "old",
      terminalElement: {},
      terminalVisible: true,
      terminalPlacementFrame: null,
      headerMainCollapsedOverride: null,
      vmStatus: { ready: true },
      orchestrator: {
        ensureWorkerReady: jest.fn().mockResolvedValue(undefined as never),
      },
    };
    db = {};
    oStore = {
      setActivePage: (jest.fn() as any).mockResolvedValue(undefined),
      loadFiles: (jest.fn() as any).mockResolvedValue(undefined),
      loadHistory: (jest.fn() as any).mockResolvedValue(undefined),
      loadTasks: (jest.fn() as any).mockResolvedValue(undefined),
      activityLog: [1, 2],
    };

    mockResolvePageForVisibility = jest.fn().mockReturnValue("chat");
    mockScheduleTerminalPlacement = jest.fn();
    mockSyncPageHeaderMainVisibilityOverride = jest.fn();
    mockUpdateActivityLogToggleVisibility = jest.fn();
    mockUpdateHeaderMainToggle = jest.fn();
    mockUpdateTerminalToggle = jest.fn();
    mockEnsureComponentLoaded = (jest.fn() as any).mockResolvedValue(undefined);

    jest.unstable_mockModule("./load-component.js", () => ({
      ensureComponentLoaded: mockEnsureComponentLoaded,
    }));

    jest.unstable_mockModule("./resolve-page-for-visibility.js", () => ({
      resolvePageForVisibility: mockResolvePageForVisibility,
    }));
    jest.unstable_mockModule("./schedule-terminal-placement.js", () => ({
      scheduleTerminalPlacement: mockScheduleTerminalPlacement,
    }));
    jest.unstable_mockModule(
      "./sync-page-header-main-visibility-override.js",
      () => ({
        syncPageHeaderMainVisibilityOverride:
          mockSyncPageHeaderMainVisibilityOverride,
      }),
    );
    jest.unstable_mockModule(
      "./update-activity-log-toggle-visibility.js",
      () => ({
        updateActivityLogToggleVisibility:
          mockUpdateActivityLogToggleVisibility,
      }),
    );
    jest.unstable_mockModule("./update-header-main-toggle.js", () => ({
      updateHeaderMainToggle: mockUpdateHeaderMainToggle,
    }));
    jest.unstable_mockModule("./update-terminal-toggle.js", () => ({
      updateTerminalToggle: mockUpdateTerminalToggle,
    }));

    const module = await import("./show-page.js");
    showPage = module.showPage;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should return early if shadowRoot is null", () => {
    showPage(null, shadowClaw, db, oStore, "chat");
    expect(mockResolvePageForVisibility).not.toHaveBeenCalled();
  });

  it("should update classes, update states, and call side-effect functions", () => {
    const chatPage = shadowRoot.querySelector(
      "[data-page-id='chat']",
    ) as HTMLElement;
    chatPage.scrollTo = jest.fn();

    showPage(shadowRoot, shadowClaw, db, oStore, "chat", true);

    expect(mockResolvePageForVisibility).toHaveBeenCalledWith(
      oStore,
      "chat",
      false,
      shadowClaw,
    );

    // Check classes
    expect(
      shadowRoot
        .querySelector("[data-page-id='old']")
        ?.classList.contains("active"),
    ).toBe(false);
    expect(
      shadowRoot
        .querySelector("[data-page='old']")
        ?.classList.contains("active"),
    ).toBe(false);
    expect(
      shadowRoot
        .querySelector("[data-page-id='chat']")
        ?.classList.contains("active"),
    ).toBe(true);
    expect(
      shadowRoot
        .querySelector("[data-page='chat']")
        ?.classList.contains("active"),
    ).toBe(true);

    expect(shadowClaw.currentPage).toBe("chat");
    expect(oStore.setActivePage).toHaveBeenCalledWith(db, "chat");

    expect(mockScheduleTerminalPlacement).toHaveBeenCalled();
    expect(mockSyncPageHeaderMainVisibilityOverride).toHaveBeenCalled();
    expect(mockUpdateHeaderMainToggle).toHaveBeenCalled();
    expect(mockUpdateActivityLogToggleVisibility).toHaveBeenCalledWith(
      shadowRoot,
      "chat",
      2,
    );
    expect(mockUpdateTerminalToggle).toHaveBeenCalled();

    // scrollTo should have been called
    expect(chatPage.scrollTo).toHaveBeenCalledWith(0, 0);

    // loadFiles should not have been called since page is not files
    expect(oStore.loadFiles).not.toHaveBeenCalled();
  });

  it("should call oStore.loadFiles if resolved page is 'files' and db is present", () => {
    mockResolvePageForVisibility.mockReturnValue("files");
    showPage(shadowRoot, shadowClaw, db, oStore, "files", true);
    expect(oStore.loadFiles).toHaveBeenCalledWith(db);
  });

  it("should not call setActivePage if persist is false or db is undefined", () => {
    showPage(shadowRoot, shadowClaw, db, oStore, "chat", false);
    expect(oStore.setActivePage).not.toHaveBeenCalled();

    showPage(shadowRoot, shadowClaw, undefined, oStore, "chat", true);
    expect(oStore.setActivePage).not.toHaveBeenCalled();
  });

  it("should activate horizontal split view when chatSplitViewEnabled is true and target page is not chat", () => {
    shadowRoot.innerHTML = `
      <div class="main-content">
        <div class="page" data-page-id="pages"></div>
        <div class="page" data-page-id="chat"></div>
        <div class="chat-split-resize-handle" hidden></div>
      </div>
    `;
    mockResolvePageForVisibility.mockReturnValue("pages");
    shadowClaw.chatSplitViewEnabled = true;

    showPage(shadowRoot, shadowClaw, db, oStore, "pages", false);

    const mainContent = shadowRoot.querySelector(".main-content");
    const handle = shadowRoot.querySelector(".chat-split-resize-handle");

    expect(mainContent?.classList.contains("split-chat-active")).toBe(true);
    expect(handle?.hasAttribute("hidden")).toBe(false);
  });

  it("should suppress horizontal split view when resolved page is chat", () => {
    shadowRoot.innerHTML = `
      <div class="main-content split-chat-active">
        <div class="page" data-page-id="pages"></div>
        <div class="page" data-page-id="chat"></div>
        <div class="chat-split-resize-handle"></div>
      </div>
    `;
    mockResolvePageForVisibility.mockReturnValue("chat");
    shadowClaw.chatSplitViewEnabled = true;

    showPage(shadowRoot, shadowClaw, db, oStore, "chat", false);

    const mainContent = shadowRoot.querySelector(".main-content");
    const handle = shadowRoot.querySelector(".chat-split-resize-handle");

    expect(mainContent?.classList.contains("split-chat-active")).toBe(false);
    expect(handle?.hasAttribute("hidden")).toBe(true);
  });

  it("should not scroll to (0, 0) when resetScroll is false", () => {
    shadowRoot.innerHTML = `
      <div class="main-content">
        <div class="page" data-page-id="pages"></div>
      </div>
    `;
    mockResolvePageForVisibility.mockReturnValue("pages");
    const activePage = shadowRoot.querySelector(
      '[data-page-id="pages"]',
    ) as HTMLElement;
    activePage.scrollTo = jest.fn();

    showPage(shadowRoot, shadowClaw, db, oStore, "pages", false, false);

    expect(activePage.scrollTo).not.toHaveBeenCalled();
  });

  it("should dynamically load chat, conversations, and boot worker when navigating to chat", () => {
    mockResolvePageForVisibility.mockReturnValue("chat");
    showPage(shadowRoot, shadowClaw, db, oStore, "chat");

    expect(mockEnsureComponentLoaded).toHaveBeenCalledWith("chat");
    expect(mockEnsureComponentLoaded).toHaveBeenCalledWith("conversations");
    expect(shadowClaw.orchestrator.ensureWorkerReady).toHaveBeenCalled();
    expect(oStore.loadHistory).toHaveBeenCalled();
  });

  it("should dynamically load tasks and invoke oStore.loadTasks and ensureWorkerReady when navigating to tasks", () => {
    mockResolvePageForVisibility.mockReturnValue("tasks");
    showPage(shadowRoot, shadowClaw, db, oStore, "tasks");

    expect(mockEnsureComponentLoaded).toHaveBeenCalledWith("tasks");
    expect(shadowClaw.orchestrator.ensureWorkerReady).toHaveBeenCalled();
    expect(oStore.loadTasks).toHaveBeenCalledWith(db);
  });

  it("should dynamically load files and invoke oStore.loadFiles when navigating to files", () => {
    mockResolvePageForVisibility.mockReturnValue("files");
    showPage(shadowRoot, shadowClaw, db, oStore, "files");

    expect(mockEnsureComponentLoaded).toHaveBeenCalledWith("files");
    expect(oStore.loadFiles).toHaveBeenCalledWith(db);
  });

  it("should dynamically load pages and stamp shadow-claw-pages when navigating to pages", () => {
    mockResolvePageForVisibility.mockReturnValue("pages");
    if (!customElements.get("shadow-claw-pages")) {
      customElements.define("shadow-claw-pages", class extends HTMLElement {});
    }

    showPage(shadowRoot, shadowClaw, db, oStore, "pages");

    expect(mockEnsureComponentLoaded).toHaveBeenCalledWith("pages");
    const pagesContainer = shadowRoot.querySelector('[data-page-id="pages"]');
    expect(pagesContainer?.querySelector("shadow-claw-pages")).not.toBeNull();
  });

  it("should not call ensureComponentLoaded for hidden inactive pages", () => {
    mockResolvePageForVisibility.mockReturnValue("pages");
    showPage(shadowRoot, shadowClaw, db, oStore, "pages");

    expect(mockEnsureComponentLoaded).not.toHaveBeenCalledWith("chat");
    expect(mockEnsureComponentLoaded).not.toHaveBeenCalledWith("tasks");
    expect(mockEnsureComponentLoaded).not.toHaveBeenCalledWith("files");
  });
});
