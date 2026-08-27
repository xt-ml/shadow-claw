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
      <div class="nav-item active" data-page="old"></div>
      <div class="nav-item" data-page="chat"></div>
    `;

    shadowClaw = {
      pagesSidebarHidden: false,
      currentPage: "old",
      terminalElement: {},
      terminalVisible: true,
      terminalPlacementFrame: null,
      headerMainCollapsedOverride: null,
      vmStatus: { ready: true },
    };
    db = {};
    oStore = {
      setActivePage: (jest.fn() as any).mockResolvedValue(undefined),
      loadFiles: (jest.fn() as any).mockResolvedValue(undefined),
      activityLog: [1, 2],
    };

    mockResolvePageForVisibility = jest.fn().mockReturnValue("chat");
    mockScheduleTerminalPlacement = jest.fn();
    mockSyncPageHeaderMainVisibilityOverride = jest.fn();
    mockUpdateActivityLogToggleVisibility = jest.fn();
    mockUpdateHeaderMainToggle = jest.fn();
    mockUpdateTerminalToggle = jest.fn();
    mockEnsureComponentLoaded = (jest.fn() as any).mockResolvedValue(undefined);

    jest.unstable_mockModule("./loadComponent.js", () => ({
      ensureComponentLoaded: mockEnsureComponentLoaded,
    }));

    jest.unstable_mockModule("./resolvePageForVisibility.js", () => ({
      resolvePageForVisibility: mockResolvePageForVisibility,
    }));
    jest.unstable_mockModule("./scheduleTerminalPlacement.js", () => ({
      scheduleTerminalPlacement: mockScheduleTerminalPlacement,
    }));
    jest.unstable_mockModule(
      "./syncPageHeaderMainVisibilityOverride.js",
      () => ({
        syncPageHeaderMainVisibilityOverride:
          mockSyncPageHeaderMainVisibilityOverride,
      }),
    );
    jest.unstable_mockModule("./updateActivityLogToggleVisibility.js", () => ({
      updateActivityLogToggleVisibility: mockUpdateActivityLogToggleVisibility,
    }));
    jest.unstable_mockModule("./updateHeaderMainToggle.js", () => ({
      updateHeaderMainToggle: mockUpdateHeaderMainToggle,
    }));
    jest.unstable_mockModule("./updateTerminalToggle.js", () => ({
      updateTerminalToggle: mockUpdateTerminalToggle,
    }));

    const module = await import("./showPage.js");
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
});
