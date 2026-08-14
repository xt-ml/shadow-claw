import { jest } from "@jest/globals";

describe("navigateToRoute", () => {
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let db: any;
  let fStore: any;
  let oStore: any;
  let route: any;
  let mockNav: any;

  let navigateToRoute: any;
  let mockApplyBasePath: any;
  let mockBuildRoutePath: any;
  let mockApplyRoute: any;
  let mockHistoryState: any;
  let mockSupportsNavigationApi: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = {};
    db = {};
    fStore = {};
    oStore = {};
    route = { page: "chat" };

    mockApplyBasePath = jest.fn();
    mockBuildRoutePath = jest.fn();
    mockApplyRoute = jest.fn();
    mockHistoryState = jest.fn();
    mockSupportsNavigationApi = jest.fn();

    mockBuildRoutePath.mockReturnValue("/chat");
    mockApplyBasePath.mockReturnValue("/base/chat");

    mockNav = { navigate: jest.fn() };
    (window as any).navigation = mockNav;

    jest.unstable_mockModule("../../../core/app-routes.js", () => ({
      applyBasePath: mockApplyBasePath,
      buildRoutePath: mockBuildRoutePath,
    }));
    jest.unstable_mockModule("./applyRoute.js", () => ({
      applyRoute: mockApplyRoute,
    }));
    jest.unstable_mockModule("./historyState.js", () => ({
      historyState: mockHistoryState,
    }));
    jest.unstable_mockModule("./supportsNavigationApi.js", () => ({
      supportsNavigationApi: mockSupportsNavigationApi,
    }));

    const module = await import("./navigateToRoute.js");
    navigateToRoute = module.navigateToRoute;
  });

  afterEach(() => {
    delete (window as any).navigation;
    jest.resetModules();
  });

  it("should use the Navigation API if supported", async () => {
    mockSupportsNavigationApi.mockReturnValue(true);

    await navigateToRoute(shadowRoot, shadowClaw, db, fStore, oStore, route);

    expect(mockBuildRoutePath).toHaveBeenCalledWith(route);
    expect(mockApplyBasePath).toHaveBeenCalledWith("/chat");
    expect(mockSupportsNavigationApi).toHaveBeenCalled();
    expect(mockNav.navigate).toHaveBeenCalledWith("/base/chat", {
      history: "push",
    });
    expect(mockHistoryState).not.toHaveBeenCalled();
    expect(mockApplyRoute).not.toHaveBeenCalled();
  });

  it("should use history: replace when options.replace is true", async () => {
    mockSupportsNavigationApi.mockReturnValue(true);

    await navigateToRoute(shadowRoot, shadowClaw, db, fStore, oStore, route, {
      replace: true,
    });

    expect(mockNav.navigate).toHaveBeenCalledWith("/base/chat", {
      history: "replace",
    });
    expect(mockHistoryState).not.toHaveBeenCalled();
  });

  it("should fallback to applyRoute and call historyState if Navigation API is not supported", async () => {
    mockSupportsNavigationApi.mockReturnValue(false);

    await navigateToRoute(shadowRoot, shadowClaw, db, fStore, oStore, route, {
      replace: false,
    });

    expect(mockSupportsNavigationApi).toHaveBeenCalled();
    expect(mockNav.navigate).not.toHaveBeenCalled();
    expect(mockHistoryState).toHaveBeenCalledWith(
      globalThis.history,
      "/base/chat",
      { replace: false, useTrailingSlash: false },
    );
    expect(mockApplyRoute).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      db,
      fStore,
      oStore,
      route,
    );
  });
});
