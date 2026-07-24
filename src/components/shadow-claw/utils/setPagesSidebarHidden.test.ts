import { jest } from "@jest/globals";

describe("setPagesSidebarHidden", () => {
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let oStore: any;
  let db: any;

  let setPagesSidebarHidden: any;
  let mockApplyPagesSidebarVisibility: any;
  let mockGetDefaultSidebarPage: any;
  let mockShowPage: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = { pagesSidebarHidden: false, currentPage: "chat" };
    oStore = {};
    db = {};

    mockApplyPagesSidebarVisibility = jest.fn();
    mockGetDefaultSidebarPage = jest.fn().mockReturnValue("default-page");
    mockShowPage = jest.fn();

    jest.unstable_mockModule("./applyPagesSidebarVisibility.js", () => ({
      applyPagesSidebarVisibility: mockApplyPagesSidebarVisibility,
    }));
    jest.unstable_mockModule("./getDefaultSidebarPage.js", () => ({
      getDefaultSidebarPage: mockGetDefaultSidebarPage,
    }));
    jest.unstable_mockModule("./showPage.js", () => ({
      showPage: mockShowPage,
    }));

    const module = await import("./setPagesSidebarHidden.js");
    setPagesSidebarHidden = module.setPagesSidebarHidden;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should set pagesSidebarHidden to true and apply visibility", () => {
    setPagesSidebarHidden(shadowRoot, shadowClaw, oStore, db, true);

    expect(shadowClaw.pagesSidebarHidden).toBe(true);
    expect(mockApplyPagesSidebarVisibility).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
    );
    expect(mockShowPage).not.toHaveBeenCalled();
  });

  it("should redirect to default page if hidden is true and currentPage is pages", () => {
    shadowClaw.currentPage = "pages";
    setPagesSidebarHidden(shadowRoot, shadowClaw, oStore, db, true);

    expect(shadowClaw.pagesSidebarHidden).toBe(true);
    expect(mockApplyPagesSidebarVisibility).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
    );
    expect(mockGetDefaultSidebarPage).toHaveBeenCalledWith(oStore);
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
    expect(mockApplyPagesSidebarVisibility).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
    );
    expect(mockGetDefaultSidebarPage).not.toHaveBeenCalled();
    expect(mockShowPage).not.toHaveBeenCalled();
  });
});
