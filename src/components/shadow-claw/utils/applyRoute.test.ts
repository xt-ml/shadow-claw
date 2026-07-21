import { jest } from "@jest/globals";

describe("applyRoute", () => {
  let applyRoute: any;
  let shadow: ShadowRoot | null;
  let shadowClaw: any;
  let db: IDBDatabase | null;
  let fStore: any;
  let oStore: any;
  let route: any;
  let mockApplyBasePath: jest.Mock<any>;
  let mockBuildRoutePath: jest.Mock<any>;
  let mockApplyAnchorWithRetry: jest.Mock<any>;
  let mockHistoryState: jest.Mock<any>;
  let mockShowPage: jest.Mock<any>;

  beforeEach(async () => {
    jest.resetModules();

    jest.unstable_mockModule("../../../core/app-routes.js", () => ({
      applyBasePath: jest.fn(),
      buildRoutePath: jest.fn(),
      parseRouteFromUrl: jest.fn(),
      getAppBasePath: jest.fn(),
      resolveHrefAgainstRoute: jest.fn(),
      getFileRouteDirPath: jest.fn(),
      getWorkspaceRouteRequestPath: jest.fn(),
    }));

    jest.unstable_mockModule("./applyAnchorWithRetry.js", () => ({
      applyAnchorWithRetry: jest.fn(),
    }));

    jest.unstable_mockModule("./historyState.js", () => ({
      historyState: jest.fn(),
    }));

    jest.unstable_mockModule("./showPage.js", () => ({
      showPage: jest.fn(),
    }));

    const appRoutes = await import("../../../core/app-routes.js");
    mockApplyBasePath = appRoutes.applyBasePath as jest.Mock<any>;
    mockBuildRoutePath = appRoutes.buildRoutePath as jest.Mock<any>;

    const anchorModule = await import("./applyAnchorWithRetry.js");
    mockApplyAnchorWithRetry =
      anchorModule.applyAnchorWithRetry as jest.Mock<any>;

    const historyModule = await import("./historyState.js");
    mockHistoryState = historyModule.historyState as jest.Mock<any>;

    const showPageModule = await import("./showPage.js");
    mockShowPage = showPageModule.showPage as jest.Mock<any>;

    const module = await import("./applyRoute.js");
    applyRoute = module.applyRoute;

    // Set up common mocks
    shadow = {
      querySelector: jest.fn(),
    } as any;

    shadowClaw = {};
    db = {} as IDBDatabase;

    fStore = {
      closeFile: jest.fn(),
      openFile: jest.fn(),
      file: undefined,
    };

    oStore = {
      switchConversation: jest.fn(),
      loadHistory: jest.fn(),
      loadFiles: jest.fn(),
      setCurrentPath: jest.fn(),
      activeGroupId: "group1",
    };

    route = {
      page: "",
      groupId: undefined,
      path: undefined,
      anchor: undefined,
    };

    // Default mock implementations
    mockBuildRoutePath.mockReturnValue("/test");
    mockApplyBasePath.mockImplementation((path: any) => path);
    mockApplyAnchorWithRetry.mockResolvedValue(true as any);
    mockShowPage.mockResolvedValue(undefined as any);
  });

  describe("when options.replace is true", () => {
    it("should call historyState when finalPath differs from current path", async () => {
      const originalPath = window.location.pathname;
      window.history.pushState({}, "", "/current");

      mockApplyBasePath.mockReturnValue("/new");

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route, {
        replace: true,
      });

      expect(mockHistoryState).toHaveBeenCalledWith(
        globalThis.history,
        "/new",
        { replace: true, useTrailingSlash: false },
      );

      window.history.pushState({}, "", originalPath);
    });

    it("should not call historyState when finalPath equals current path", async () => {
      const originalPath = window.location.pathname;
      window.history.pushState({}, "", "/same");

      mockApplyBasePath.mockReturnValue("/same");

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route, {
        replace: true,
      });

      expect(mockHistoryState).not.toHaveBeenCalled();

      window.history.pushState({}, "", originalPath);
    });
  });

  describe("when db is null", () => {
    it("should return early", async () => {
      const result = await applyRoute(
        shadow,
        shadowClaw,
        null,
        fStore,
        oStore,
        route,
      );
      expect(result).toBeUndefined();

      // Ensure no further processing
      expect(mockShowPage).not.toHaveBeenCalled();
    });
  });

  describe("file viewer logic", () => {
    beforeEach(() => {
      route.page = "files";
      fStore.file = { path: "/old/file.txt" };
    });

    it("should close file viewer when navigating to a different file", async () => {
      route.path = "/new/file.txt";
      route.groupId = "group1";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(fStore.closeFile).toHaveBeenCalled();
    });

    it("should not close file viewer when navigating to the same file", async () => {
      route.path = "/old/file.txt";
      route.groupId = "group1";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(fStore.closeFile).not.toHaveBeenCalled();
    });

    it("should close file viewer when groupId differs", async () => {
      route.path = "/old/file.txt";
      route.groupId = "group2";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(fStore.closeFile).toHaveBeenCalled();
    });
  });

  describe("group switching", () => {
    it("should switch conversation when groupId differs and db exists", async () => {
      route.page = "chat";
      route.groupId = "group2";
      oStore.activeGroupId = "group1";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(oStore.switchConversation).toHaveBeenCalledWith(
        db,
        "group2",
        true,
      );
    });

    it("should load history when groupId matches active group", async () => {
      route.page = "tasks";
      route.groupId = "group1";
      oStore.activeGroupId = "group1";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(oStore.loadHistory).toHaveBeenCalled();
    });

    it("should load files for tasks or pages when groupId matches", async () => {
      route.page = "tasks";
      route.groupId = "group1";
      oStore.activeGroupId = "group1";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(oStore.loadFiles).toHaveBeenCalledWith(db);
    });
  });

  describe("page display", () => {
    it("should call showPage when page is set", async () => {
      route.page = "files";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(mockShowPage).toHaveBeenCalledWith(
        shadow,
        shadowClaw,
        db,
        oStore,
        "files",
      );
    });

    it("should not call showPage when page is empty", async () => {
      route.page = "";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(mockShowPage).not.toHaveBeenCalled();
    });
  });

  describe("file opening logic", () => {
    beforeEach(() => {
      route.page = "files";
    });

    it("should open file when path has extension", async () => {
      route.path = "/file.pdf";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(fStore.openFile).toHaveBeenCalledWith(db, "/file.pdf", "group1");
    });

    it("should apply anchor when file opened successfully", async () => {
      route.path = "/file.pdf#section";
      route.anchor = "section";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(mockApplyAnchorWithRetry).toHaveBeenCalled();
    });

    it("should set current path when path has no extension", async () => {
      route.path = "/folder";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(oStore.setCurrentPath).toHaveBeenCalledWith(db, "/folder");
    });

    it("should close file when opening folder", async () => {
      route.path = "/folder";

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(fStore.closeFile).toHaveBeenCalled();
    });
  });

  describe("pages logic", () => {
    let pagesComp: any;
    beforeEach(() => {
      route.page = "pages";
      route.path = "/test-page";
      pagesComp = {
        renderSelectedPage: jest.fn<any>().mockResolvedValue(undefined),
        handleAnchorNavigation: jest.fn().mockReturnValue(true),
      };

      if (shadow) {
        shadow.querySelector = jest.fn().mockImplementation((selector: any) => {
          if (selector === "shadow-claw-pages") {
            return pagesComp;
          }

          return null;
        });
      }
    });

    it("should set selectedPage and render when pages component exists", async () => {
      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(pagesComp.selectedPage).toEqual({
        groupId: "group1",
        path: "/test-page",
      });

      expect(pagesComp.renderSelectedPage).toHaveBeenCalled();
    });

    it("should apply anchor when pages component exists and has handler", async () => {
      route.anchor = "top";

      mockApplyAnchorWithRetry.mockImplementation(async (fn: Function) => {
        return fn();
      });

      await applyRoute(shadow, shadowClaw, db, fStore, oStore, route);

      expect(pagesComp.handleAnchorNavigation).toHaveBeenCalledWith("top");
      expect(mockApplyAnchorWithRetry).toHaveBeenCalled();
    });
  });
});
