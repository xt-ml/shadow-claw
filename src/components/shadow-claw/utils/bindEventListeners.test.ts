import { jest } from "@jest/globals";

import { Themes } from "../../../stores/theme.js";

describe("bindEventListeners", () => {
  let bindEventListeners: any;
  let win: Window;
  let doc: Document;
  let shadow: any;
  let shadowClaw: any;
  let db: any;
  let oStore: any;
  let fStore: any;
  let tStore: any;
  let url: URL;

  let mockGetDefaultSidebarPage: jest.Mock<any>;
  let mockRequestDialog: jest.Mock<any>;
  let mockScheduleTerminalPlacement: jest.Mock<any>;
  let mockSetPagesSidebarHidden: jest.Mock<any>;
  let mockSupportsNavigationApi: jest.Mock<any>;
  let mockSyncPageHeaderMainVisibilityOverride: jest.Mock<any>;
  let mockToggleActivityLogVisibility: jest.Mock<any>;
  let mockTogglePageHeaderMainVisibility: jest.Mock<any>;
  let mockToggleTerminalVisibility: jest.Mock<any>;
  let mockUpdateHeaderMainToggle: jest.Mock<any>;
  let mockUpdateHostTheme: jest.Mock<any>;
  let mockUpdateThemeIcons: jest.Mock<any>;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.unstable_mockModule("./applyRouteFromCurrentLocation.js", () => ({
      applyRouteFromCurrentLocation: jest.fn(),
    }));
    jest.unstable_mockModule("./getDefaultSidebarPage.js", () => ({
      getDefaultSidebarPage: jest.fn(),
    }));
    jest.unstable_mockModule("./initSidebarResize.js", () => ({
      initSidebarResize: jest.fn(),
    }));
    jest.unstable_mockModule("./requestDialog.js", () => ({
      requestDialog: jest.fn(),
    }));
    jest.unstable_mockModule("./scheduleTerminalPlacement.js", () => ({
      scheduleTerminalPlacement: jest.fn(),
    }));
    jest.unstable_mockModule("./setPagesSidebarHidden.js", () => ({
      setPagesSidebarHidden: jest.fn(),
    }));
    jest.unstable_mockModule("./supportsNavigationApi.js", () => ({
      supportsNavigationApi: jest.fn(),
    }));
    jest.unstable_mockModule(
      "./syncPageHeaderMainVisibilityOverride.js",
      () => ({
        syncPageHeaderMainVisibilityOverride: jest.fn(),
      }),
    );
    jest.unstable_mockModule("./toggleActivityLogVisibility.js", () => ({
      toggleActivityLogVisibility: jest.fn(),
    }));
    jest.unstable_mockModule("./togglePageHeaderMainVisibility.js", () => ({
      togglePageHeaderMainVisibility: jest.fn(),
    }));
    jest.unstable_mockModule("./toggleTerminalVisibility.js", () => ({
      toggleTerminalVisibility: jest.fn(),
    }));
    jest.unstable_mockModule("./updateHeaderMainToggle.js", () => ({
      updateHeaderMainToggle: jest.fn(),
    }));
    jest.unstable_mockModule("./updateHostTheme.js", () => ({
      updateHostTheme: jest.fn(),
    }));
    jest.unstable_mockModule("./updateThemeIcons.js", () => ({
      updateThemeIcons: jest.fn(),
    }));

    mockGetDefaultSidebarPage = (await import("./getDefaultSidebarPage.js"))
      .getDefaultSidebarPage as jest.Mock<any>;
    mockRequestDialog = (await import("./requestDialog.js"))
      .requestDialog as jest.Mock<any>;
    mockScheduleTerminalPlacement = (
      await import("./scheduleTerminalPlacement.js")
    ).scheduleTerminalPlacement as jest.Mock<any>;
    mockSetPagesSidebarHidden = (await import("./setPagesSidebarHidden.js"))
      .setPagesSidebarHidden as jest.Mock<any>;
    mockSupportsNavigationApi = (await import("./supportsNavigationApi.js"))
      .supportsNavigationApi as jest.Mock<any>;
    mockSyncPageHeaderMainVisibilityOverride = (
      await import("./syncPageHeaderMainVisibilityOverride.js")
    ).syncPageHeaderMainVisibilityOverride as jest.Mock<any>;
    mockToggleActivityLogVisibility = (
      await import("./toggleActivityLogVisibility.js")
    ).toggleActivityLogVisibility as jest.Mock<any>;
    mockTogglePageHeaderMainVisibility = (
      await import("./togglePageHeaderMainVisibility.js")
    ).togglePageHeaderMainVisibility as jest.Mock<any>;
    mockToggleTerminalVisibility = (
      await import("./toggleTerminalVisibility.js")
    ).toggleTerminalVisibility as jest.Mock<any>;
    mockUpdateHeaderMainToggle = (await import("./updateHeaderMainToggle.js"))
      .updateHeaderMainToggle as jest.Mock<any>;
    mockUpdateHostTheme = (await import("./updateHostTheme.js"))
      .updateHostTheme as jest.Mock<any>;
    mockUpdateThemeIcons = (await import("./updateThemeIcons.js"))
      .updateThemeIcons as jest.Mock<any>;

    bindEventListeners = (await import("./bindEventListeners.js"))
      .bindEventListeners;

    // Set up DOM mocks
    doc = {
      addEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      getElementById: jest.fn(),
      createEvent: jest.fn(),
    } as unknown as Document;

    win = {
      addEventListener: jest.fn(),
      innerWidth: 1024,
      matchMedia: jest.fn().mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    } as unknown as Window;
    globalThis.matchMedia = win.matchMedia;

    shadow = {
      querySelectorAll: jest.fn(),
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      addEventListener: jest.fn(),
    } as unknown as ShadowRoot;

    shadowClaw = {
      shadowClawNav: jest.fn(),
      handleNavigationApiNavigate: jest.fn(),
      navigationListenerAttached: false,
      popstateListener: null,
      fallbackClickListener: null,
      fallbackClickListenerAttached: false,
      headerMainCollapsedOverride: null,
      currentPage: "",
      terminalElement: null,
      terminalVisible: false,
      terminalPlacementFrame: 0,
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
      },
    };

    db = {} as any;
    oStore = {
      activeGroupId: "group1",
      switchConversation: jest.fn(),
      loadHistory: jest.fn(),
      loadFiles: jest.fn(),
      setCurrentPath: jest.fn(),
    } as any;
    fStore = {
      closeFile: jest.fn(),
      openFile: jest.fn(),
      file: undefined,
    } as any;
    tStore = {
      getTheme: jest.fn().mockReturnValue({ resolved: Themes.Dark }),
      setTheme: jest.fn(),
      resolved: Themes.Dark,
    } as any;
    url = new URL("https://example.com/test");

    // Mock querySelectorAll to return empty array by default
    shadow.querySelectorAll.mockReturnValue([]);

    // Mock getElementById and querySelector to return null by default
    shadow.getElementById.mockReturnValue(null);
    shadow.querySelector.mockReturnValue(null);

    // Mock getDefaultSidebarPage
    mockGetDefaultSidebarPage.mockReturnValue("files");
  });

  describe("when shadow is null", () => {
    it("should return early", () => {
      bindEventListeners(
        win,
        doc,
        null,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );
      expect(doc.addEventListener).not.toHaveBeenCalled();
      expect(win.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe("navigation items", () => {
    it("should add click event listener to nav items with data-page", () => {
      const navItem = document.createElement("li");
      navItem.className = "nav-item";
      navItem.setAttribute("data-page", "settings");
      jest.spyOn(navItem, "addEventListener");

      const list = [navItem];
      (list as any).forEach = Array.prototype.forEach;
      shadow.querySelectorAll.mockReturnValue(list);

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(navItem.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );

      navItem.dispatchEvent(new MouseEvent("click"));
      // Navigation is verified in UI tests.
    });

    it("should use default sidebar page when data-page is missing", () => {
      const navItem = document.createElement("li");
      navItem.className = "nav-item";
      jest.spyOn(navItem, "addEventListener");

      const list = [navItem];
      (list as any).forEach = Array.prototype.forEach;
      shadow.querySelectorAll.mockReturnValue(list);

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(navItem.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
      navItem.dispatchEvent(new MouseEvent("click"));

      // The click listener should call getDefaultSidebarPage
      expect(mockGetDefaultSidebarPage).toHaveBeenCalledWith(oStore);
    });
  });

  describe("menu toggle logic", () => {
    it("should set up menu button and sidebar listeners when both exist", () => {
      const menuButton = document.createElement("button");
      menuButton.id = "menu-button";
      const sidebar = document.createElement("div");
      sidebar.className = "sidebar";
      shadow.getElementById.mockReturnValue(menuButton);
      shadow.querySelector.mockReturnValue(sidebar);

      jest.spyOn(menuButton, "addEventListener");

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(menuButton.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
      expect(doc.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
      expect(win.matchMedia).toHaveBeenCalledWith("(min-width: 56rem)");
    });

    it("should not set up menu toggle if menuButton or sidebar is missing", () => {
      shadow.getElementById.mockReturnValue(null);
      shadow.querySelector.mockReturnValue(document.createElement("div"));

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      // Should not add the click listener to menuButton (since it's null)
      expect(doc.addEventListener).not.toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
    });
  });

  describe("settings button", () => {
    it("should add click listener to settings button when present", () => {
      const settingsBtn = document.createElement("button");
      settingsBtn.className = "settings-toggle";
      jest.spyOn(settingsBtn, "addEventListener");
      shadow.querySelector.mockReturnValue(settingsBtn);

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(settingsBtn.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );

      settingsBtn.dispatchEvent(new MouseEvent("click"));
      // The settings button click shows the settings page, verified in UI tests.
    });

    it("should not add listener if settings button is missing", () => {
      shadow.querySelector.mockReturnValue(null);
      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );
      // No assertion needed, just ensure it doesn't throw
    });
  });

  describe("header main toggle", () => {
    it("should add click listener to header-main-toggle when present", () => {
      const toggle = document.createElement("button");
      toggle.className = "header-main-toggle";
      jest.spyOn(toggle, "addEventListener");
      shadow.querySelector.mockReturnValue(toggle);

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(toggle.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );

      toggle.dispatchEvent(new MouseEvent("click"));

      expect(mockTogglePageHeaderMainVisibility).toHaveBeenCalledWith(
        shadowClaw,
      );
    });
  });

  describe("activity log toggle", () => {
    it("should add click listener to activity-log-toggle when present", () => {
      const toggle = document.createElement("button");
      toggle.className = "activity-log-toggle";
      jest.spyOn(toggle, "addEventListener");
      shadow.querySelector.mockReturnValue(toggle);

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(toggle.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );

      toggle.dispatchEvent(new MouseEvent("click"));

      expect(mockToggleActivityLogVisibility).toHaveBeenCalledWith(shadowClaw);
    });
  });

  describe("settingsEl navigate event", () => {
    it("should relay navigate event from settingsEl", () => {
      const settingsEl = document.createElement("shadow-claw-settings") as any;
      shadow.querySelector.mockReturnValue(settingsEl);

      jest.spyOn(settingsEl, "addEventListener");

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(settingsEl.addEventListener).toHaveBeenCalledWith(
        "navigate",
        expect.any(Function),
      );

      // Call the listener with a mock event
      const mockEvent = new CustomEvent("navigate", {
        detail: { page: "tools" },
      });
      settingsEl.dispatchEvent(mockEvent);

      expect(doc.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { page: "tools" },
          bubbles: true,
          composed: true,
        }),
      );
    });
  });

  describe("settingsEl sidebar-pages-visibility-change event", () => {
    it("should call setPagesSidebarHidden when event received", () => {
      const settingsEl = document.createElement("shadow-claw-settings") as any;
      shadow.querySelector.mockReturnValue(settingsEl);

      jest.spyOn(settingsEl, "addEventListener");

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(settingsEl.addEventListener).toHaveBeenCalledWith(
        "sidebar-pages-visibility-change",
        expect.any(Function),
      );

      const mockEvent = new CustomEvent("sidebar-pages-visibility-change", {
        detail: { hidden: true },
      });
      settingsEl.dispatchEvent(mockEvent);

      expect(mockSetPagesSidebarHidden).toHaveBeenCalledWith(
        shadow,
        shadowClaw,
        oStore,
        db,
        true,
      );
    });
  });

  describe("toolsPage navigate-back event", () => {
    it("should relay navigate-back event from toolsPage", () => {
      const toolsPage = document.createElement("shadow-claw-tools") as any;
      shadow.querySelector.mockReturnValue(toolsPage);

      jest.spyOn(toolsPage, "addEventListener");

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(toolsPage.addEventListener).toHaveBeenCalledWith(
        "navigate-back",
        expect.any(Function),
      );

      toolsPage.dispatchEvent(new Event("navigate-back"));

      expect(doc.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { page: "settings" },
          bubbles: true,
          composed: true,
        }),
      );
    });
  });

  describe("channelsPage navigate-back event", () => {
    it("should relay navigate-back event from channelsPage", () => {
      const channelsPage = document.createElement(
        "shadow-claw-channels",
      ) as any;
      shadow.querySelector.mockReturnValue(channelsPage);

      jest.spyOn(channelsPage, "addEventListener");

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(channelsPage.addEventListener).toHaveBeenCalledWith(
        "navigate-back",
        expect.any(Function),
      );

      channelsPage.dispatchEvent(new Event("navigate-back"));

      expect(doc.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { page: "settings" },
          bubbles: true,
          composed: true,
        }),
      );
    });
  });

  describe("theme toggle", () => {
    it("should add click listener to theme-mode-toggle and toggle theme", () => {
      const themeToggle = document.createElement("button");
      themeToggle.className = "theme-mode-toggle";
      jest.spyOn(themeToggle, "addEventListener");
      shadow.querySelector.mockReturnValue(themeToggle);

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(themeToggle.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );

      // Trigger the event
      themeToggle.dispatchEvent(new MouseEvent("click"));

      expect(tStore.setTheme).toHaveBeenCalledWith(Themes.Light);
    });
  });

  describe("webvm-toggle", () => {
    it("should add click listener to webvm-toggle and call toggleTerminalVisibility", () => {
      const webvmToggle = document.createElement("button");
      webvmToggle.className = "webvm-toggle";
      jest.spyOn(webvmToggle, "addEventListener");
      shadow.querySelector.mockReturnValue(webvmToggle);

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(webvmToggle.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );

      // Trigger the event
      webvmToggle.dispatchEvent(new MouseEvent("click"));

      expect(mockToggleTerminalVisibility).toHaveBeenCalledWith(
        shadow,
        shadowClaw,
      );
    });
  });

  describe("shadow-claw-terminal-slot-ready event", () => {
    it("should call scheduleTerminalPlacement, syncPageHeaderMainVisibilityOverride, and updateHeaderMainToggle", () => {
      shadow.addEventListener.mockImplementation(
        (event: any, listener: any) => {
          if (event === "shadow-claw-terminal-slot-ready") {
            shadow._terminalSlotReadyListener = listener;
          }
        },
      );

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(shadow.addEventListener).toHaveBeenCalledWith(
        "shadow-claw-terminal-slot-ready",
        expect.any(Function),
      );

      shadow._terminalSlotReadyListener();

      expect(mockScheduleTerminalPlacement).toHaveBeenCalledWith(
        shadow,
        shadowClaw.currentPage,
        shadowClaw.terminalElement,
        shadowClaw.terminalVisible,
        shadowClaw.terminalPlacementFrame,
      );
      expect(mockSyncPageHeaderMainVisibilityOverride).toHaveBeenCalledWith(
        shadow,
        shadowClaw.headerMainCollapsedOverride,
      );
      expect(mockUpdateHeaderMainToggle).toHaveBeenCalledWith(
        shadow,
        shadowClaw.headerMainCollapsedOverride,
      );
    });
  });

  describe("win resize event", () => {
    it("should call updateHeaderMainToggle on resize when headerMainCollapsedOverride is null", () => {
      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(win.addEventListener).toHaveBeenCalledWith(
        "resize",
        expect.any(Function),
      );

      const resizeListener = (win.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "resize",
      )[1];

      resizeListener();

      expect(mockUpdateHeaderMainToggle).toHaveBeenCalledWith(
        shadow,
        shadowClaw.headerMainCollapsedOverride,
      );
    });

    it("should not call updateHeaderMainToggle on resize when headerMainCollapsedOverride is not null", () => {
      shadowClaw.headerMainCollapsedOverride = true;
      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      const resizeListener = (win.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "resize",
      )[1];

      resizeListener();

      expect(mockUpdateHeaderMainToggle).not.toHaveBeenCalled();
    });
  });

  describe("shadow-claw-navigate event on document", () => {
    it("should add listener for shadow-claw-navigate on doc", () => {
      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(doc.addEventListener).toHaveBeenCalledWith(
        "shadow-claw-navigate",
        shadowClaw.shadowClawNav,
      );
    });
  });

  describe("navigation API branch", () => {
    it("should attach navigation API listener when supported", () => {
      mockSupportsNavigationApi.mockReturnValue(true);

      const nav = { addEventListener: jest.fn() };
      (win as any).navigation = nav;

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(mockSupportsNavigationApi).toHaveBeenCalled();
      expect(nav.addEventListener).toHaveBeenCalledWith(
        "navigate",
        shadowClaw.handleNavigationApiNavigate,
      );
      expect(shadowClaw.navigationListenerAttached).toBe(true);
      expect(win.addEventListener).not.toHaveBeenCalledWith(
        "popstate",
        expect.any(Function),
      );
    });

    it("should attach popstate and click listeners when navigation API not supported", () => {
      mockSupportsNavigationApi.mockReturnValue(false);

      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(mockSupportsNavigationApi).toHaveBeenCalled();
      expect(win.addEventListener).toHaveBeenCalledWith(
        "popstate",
        shadowClaw.popstateListener,
      );
      expect(doc.addEventListener).toHaveBeenCalledWith(
        "click",
        shadowClaw.fallbackClickListener,
      );
      expect(shadowClaw.fallbackClickListenerAttached).toBe(true);
      expect(shadowClaw.popstateListener).toBeInstanceOf(Function);
    });
  });

  describe("shadow-claw-theme-change event on window", () => {
    it("should add listener for theme change and call updateThemeIcons and updateHostTheme", () => {
      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(win.addEventListener).toHaveBeenCalledWith(
        "shadow-claw-theme-change",
        expect.any(Function),
      );

      const themeChangeListener = (win.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "shadow-claw-theme-change",
      )[1];

      const mockEvent = new CustomEvent("shadow-claw-theme-change", {
        detail: { theme: Themes.Light },
      });
      themeChangeListener(mockEvent);

      expect(mockUpdateThemeIcons).toHaveBeenCalledWith(shadow, Themes.Light);
      expect(mockUpdateHostTheme).toHaveBeenCalledWith(
        Themes.Light,
        shadowClaw.classList,
      );
    });
  });

  describe("shadow-claw-peer-error event on window", () => {
    it("should add listener for peer error and call requestDialog", () => {
      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(win.addEventListener).toHaveBeenCalledWith(
        "shadow-claw-peer-error",
        expect.any(Function),
      );

      const peerErrorListener = (win.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "shadow-claw-peer-error",
      )[1];

      const mockEvent = new CustomEvent("shadow-claw-peer-error", {
        detail: { remotePeerId: "peer123", error: "Connection timeout" },
      });
      peerErrorListener(mockEvent);

      expect(mockRequestDialog).toHaveBeenCalledWith(doc, shadow, {
        mode: "info",
        title: "Peer Connection Error",
        message: "Failed to communicate with peer peer123: Connection timeout",
        confirmLabel: "Dismiss",
      });
    });

    it("should handle peer error without remotePeerId", () => {
      mockRequestDialog.mockClear();
      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      const peerErrorListener = (win.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "shadow-claw-peer-error",
      )[1];

      const mockEvent = new CustomEvent("shadow-claw-peer-error", {
        detail: { remotePeerId: null, error: "Some error" },
      });
      peerErrorListener(mockEvent);

      expect(mockRequestDialog).toHaveBeenCalledWith(doc, shadow, {
        mode: "info",
        title: "Peer Connection Error",
        message: "PeerJS error: Some error",
        confirmLabel: "Dismiss",
      });
    });
  });

  describe("initial state", () => {
    it("should call updateThemeIcons and updateHostTheme with initial theme", () => {
      bindEventListeners(
        win,
        doc,
        shadow,
        shadowClaw,
        db,
        oStore,
        fStore,
        tStore,
        url,
      );

      expect(mockUpdateThemeIcons).toHaveBeenCalledWith(shadow, Themes.Dark);
      expect(mockUpdateHostTheme).toHaveBeenCalledWith(
        Themes.Dark,
        shadowClaw.classList,
      );
    });
  });
});
