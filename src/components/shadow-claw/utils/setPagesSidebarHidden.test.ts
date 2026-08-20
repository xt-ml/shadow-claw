import { jest } from "@jest/globals";

describe("setPagesSidebarHidden and setSidebarNavHidden", () => {
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let oStore: any;
  let db: any;

  let setPagesSidebarHidden: any;
  let setSidebarNavHidden: any;
  let mockApplySidebarNavVisibility: any;
  let mockGetDefaultSidebarPage: any;
  let mockShowPage: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = {
      pagesSidebarHidden: false,
      chatSidebarHidden: false,
      tasksSidebarHidden: false,
      filesSidebarHidden: false,
      currentPage: "chat",
    };
    oStore = {};
    db = {};

    mockApplySidebarNavVisibility = jest.fn();
    mockGetDefaultSidebarPage = jest.fn().mockReturnValue("default-page");
    mockShowPage = jest.fn();

    jest.unstable_mockModule("./sidebarVisibility.js", () => ({
      applySidebarNavVisibility: mockApplySidebarNavVisibility,
    }));
    jest.unstable_mockModule("./getDefaultSidebarPage.js", () => ({
      getDefaultSidebarPage: mockGetDefaultSidebarPage,
    }));
    jest.unstable_mockModule("./showPage.js", () => ({
      showPage: mockShowPage,
    }));

    const module = await import("./setPagesSidebarHidden.js");
    setPagesSidebarHidden = module.setPagesSidebarHidden;
    setSidebarNavHidden = module.setSidebarNavHidden;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should set pagesSidebarHidden to true and apply visibility", () => {
    setPagesSidebarHidden(shadowRoot, shadowClaw, oStore, db, true);

    expect(shadowClaw.pagesSidebarHidden).toBe(true);
    expect(mockApplySidebarNavVisibility).toHaveBeenCalledWith(
      shadowRoot,
      "pages",
      true,
    );
    expect(mockShowPage).not.toHaveBeenCalled();
  });

  it("should redirect to default page if hidden is true and currentPage is pages", () => {
    shadowClaw.currentPage = "pages";
    setPagesSidebarHidden(shadowRoot, shadowClaw, oStore, db, true);

    expect(shadowClaw.pagesSidebarHidden).toBe(true);
    expect(mockApplySidebarNavVisibility).toHaveBeenCalledWith(
      shadowRoot,
      "pages",
      true,
    );
    expect(mockGetDefaultSidebarPage).toHaveBeenCalledWith(oStore, shadowClaw);
    expect(mockShowPage).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      db,
      oStore,
      "default-page",
    );
  });

  it("should not redirect if hidden is false even if currentPage is pages", () => {
    shadowClaw.currentPage = "pages";
    setPagesSidebarHidden(shadowRoot, shadowClaw, oStore, db, false);

    expect(shadowClaw.pagesSidebarHidden).toBe(false);
    expect(mockApplySidebarNavVisibility).toHaveBeenCalledWith(
      shadowRoot,
      "pages",
      false,
    );
    expect(mockGetDefaultSidebarPage).not.toHaveBeenCalled();
    expect(mockShowPage).not.toHaveBeenCalled();
  });

  it("should support setSidebarNavHidden for chat, tasks, files", () => {
    shadowClaw.currentPage = "tasks";
    setSidebarNavHidden(shadowRoot, shadowClaw, oStore, db, "tasks", true);

    expect(shadowClaw.tasksSidebarHidden).toBe(true);
    expect(mockApplySidebarNavVisibility).toHaveBeenCalledWith(
      shadowRoot,
      "tasks",
      true,
    );
    expect(mockGetDefaultSidebarPage).toHaveBeenCalledWith(oStore, shadowClaw);
    expect(mockShowPage).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      db,
      oStore,
      "default-page",
    );
  });
});
