import { jest } from "@jest/globals";

import type { ShadowClawDatabase } from "../../../db/db.js";

describe("initSidebarResize", () => {
  let initSidebarResize: any;

  let mockShadow: any;
  let mockShadowClaw: any;
  let mockSidebar: any;
  let mockHandle: any;
  let mockAppBody: any;

  let mockClampSidebarWidth: jest.Mock<any>;
  let mockPersistSidebarWidth: jest.Mock<any>;
  let mockSetSidebarWidth: jest.Mock<any>;
  let mockGetConfig: jest.Mock<any>;

  const DEFAULT_SIDEBAR_WIDTH_PX = 300;
  const MIN_SIDEBAR_WIDTH_PX = 175;
  const SIDEBAR_COLLAPSED_WIDTH_PX = 0;

  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule("./clamp-sidebar-width.js", () => ({
      clampSidebarWidth: jest.fn(),
    }));

    jest.unstable_mockModule("./persist-sidebar-width.js", () => ({
      persistSidebarWidth: jest.fn(),
    }));

    jest.unstable_mockModule("./set-sidebar-width.js", () => ({
      setSidebarWidth: jest.fn(),
    }));

    jest.unstable_mockModule("../../../db/get-config.js", () => ({
      getConfig: jest.fn(),
    }));

    jest.unstable_mockModule("../constants.js", () => ({
      DEFAULT_SIDEBAR_WIDTH_PX: 300,
      MIN_SIDEBAR_WIDTH_PX: 175,
      SIDEBAR_COLLAPSED_WIDTH_PX: 0,
    }));

    mockClampSidebarWidth = (await import("./clamp-sidebar-width.js"))
      .clampSidebarWidth as jest.Mock<any>;
    mockPersistSidebarWidth = (await import("./persist-sidebar-width.js"))
      .persistSidebarWidth as jest.Mock<any>;
    mockSetSidebarWidth = (await import("./set-sidebar-width.js"))
      .setSidebarWidth as jest.Mock<any>;
    mockGetConfig = (await import("../../../db/get-config.js"))
      .getConfig as jest.Mock<any>;

    initSidebarResize = (await import("./init-sidebar-resize.js"))
      .initSidebarResize;
    // Mock DOM elements
    mockShadow = {
      querySelector: jest.fn(),
    };
    mockShadowClaw = {
      querySelector: jest.fn(),
      addCleanup: jest.fn(),
    };
    mockSidebar = {
      getBoundingClientRect: jest.fn(),
    };

    // Mock handle (resize handle element)
    mockHandle = document.createElement("div");
    mockHandle.setAttribute = jest.fn();
    mockHandle.setPointerCapture = jest.fn();
    mockHandle.classList.add = jest.fn();
    mockHandle.classList.remove = jest.fn();

    mockAppBody = document.createElement("div");
    mockAppBody.style.getPropertyValue = jest.fn();

    // Configure querySelector mocks
    mockShadow.querySelector.mockImplementation((selector: string) => {
      switch (selector) {
        case ".sidebar-resize-handle":
          return mockHandle;
        case ".app-body":
          return mockAppBody;
        default:
          return null;
      }
    });

    mockShadowClaw.querySelector.mockImplementation((selector: string) => {
      switch (selector) {
        case ".sidebar-resize-handle":
          return mockHandle;
        default:
          return null;
      }
    });

    // Default return values for getBoundingClientRect
    mockSidebar.getBoundingClientRect.mockReturnValue({ width: 400 });
  });

  afterEach(() => {
    for (const [fn] of mockShadowClaw?.addCleanup?.mock?.calls ?? []) {
      if (typeof fn === "function") {
        fn();
      }
    }
    jest.clearAllMocks();
  });

  it("should set up the resize handle attributes and ARIA properties on init", async () => {
    const dummyDb: ShadowClawDatabase = {} as any;

    // Mock getConfig to return undefined
    (mockGetConfig as jest.Mock<any>).mockResolvedValue(undefined);

    // Ensure mockSetSidebarWidth and mockPersistSidebarWidth are jest.fn()
    const mockSetSidebarWidthMock = mockSetSidebarWidth.mockImplementation(
      () => {},
    );

    const _mockPersistSidebarWidthMock =
      mockPersistSidebarWidth.mockImplementation(() => {});
    _mockPersistSidebarWidthMock;

    // Call the function
    const setAttributeSpy = jest.spyOn(mockHandle, "setAttribute");
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    // Verify attributes set on handle
    expect(setAttributeSpy).toHaveBeenCalledWith("tabindex", "0");
    expect(setAttributeSpy).toHaveBeenCalledWith("role", "separator");
    expect(setAttributeSpy).toHaveBeenCalledWith(
      "aria-orientation",
      "vertical",
    );
    expect(setAttributeSpy).toHaveBeenCalledWith(
      "aria-label",
      "Resize sidebar width",
    );

    // Verify ARIA value attributes
    expect(setAttributeSpy).toHaveBeenCalledWith(
      "aria-valuemin",
      String(SIDEBAR_COLLAPSED_WIDTH_PX),
    );

    expect(mockSetSidebarWidthMock).toHaveBeenCalledWith(
      mockShadow,
      DEFAULT_SIDEBAR_WIDTH_PX,
    );
  });

  it("should restore saved sidebar width if present in DB", async () => {
    const savedWidth = 350;
    const dummyDb: ShadowClawDatabase = {/* mocked DB */} as any;
    (mockGetConfig as jest.Mock<any>).mockResolvedValue(savedWidth);

    // Spy on mockSetSidebarWidth
    const mockSetSidebarWidthMock = jest.fn();
    (mockSetSidebarWidth as jest.Mock).mockImplementation(
      mockSetSidebarWidthMock,
    );

    // Call the function
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    // Should have called mockSetSidebarWidth with saved width
    expect(mockSetSidebarWidthMock).toHaveBeenCalledWith(
      mockShadow,
      savedWidth,
    );
  });

  it("should handle pointerdown, pointermove, pointerup, pointercancel events", async () => {
    const dummyDb: ShadowClawDatabase = {} as any;
    (mockGetConfig as jest.Mock<any>).mockResolvedValue(undefined);

    // Capture references to event handlers
    const addEventListenerMock = jest.spyOn(mockHandle, "addEventListener");

    // Call the function
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    // Verify listeners added
    expect(addEventListenerMock).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
    );
    expect(addEventListenerMock).toHaveBeenCalledWith(
      "pointerup",
      expect.any(Function),
    );
    expect(addEventListenerMock).toHaveBeenCalledWith(
      "pointercancel",
      expect.any(Function),
    );

    // Simulate pointerdown event
    const pointerDownEvent: any = new Event("pointerdown");
    pointerDownEvent.pointerId = 1;
    pointerDownEvent.pointerType = "mouse";
    pointerDownEvent.button = 0;
    pointerDownEvent.clientX = 50;
    jest.spyOn(pointerDownEvent, "preventDefault");

    mockHandle.dispatchEvent(pointerDownEvent);

    // Verify setPointerCapture was called with correct id
    expect(mockHandle.setPointerCapture).toHaveBeenCalledWith(1);
    expect(pointerDownEvent.preventDefault).toHaveBeenCalled();

    // Simulate pointermove event with different clientX
    const pointerMoveEvent: any = new Event("pointermove");
    pointerMoveEvent.pointerId = 1;
    pointerMoveEvent.clientX = 80; // delta of +30
    jest.spyOn(pointerMoveEvent, "preventDefault");

    const mockSetSidebarWidthMock = jest.fn();
    (mockSetSidebarWidth as jest.Mock).mockImplementation(
      mockSetSidebarWidthMock,
    );

    document.dispatchEvent(pointerMoveEvent);
    expect(mockSetSidebarWidthMock).toHaveBeenCalled();
  });

  it("should clamp sidebar width within bounds", async () => {
    const clampedValue = 250;
    (mockClampSidebarWidth as jest.Mock).mockReturnValue(clampedValue);

    const dummyDb: ShadowClawDatabase = {} as any;
    (mockGetConfig as jest.Mock<any>).mockResolvedValue(undefined);

    const _mockSetSidebarWidthMock = jest.fn();
    _mockSetSidebarWidthMock;
    (mockSetSidebarWidth as jest.Mock).mockImplementation(() => {});

    const setAttributeSpy = jest.spyOn(mockHandle, "setAttribute");
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    expect(setAttributeSpy).toHaveBeenCalledWith(
      "aria-valuenow",
      String(clampedValue),
    );
  });

  it("should return early if shadow is null", async () => {
    await initSidebarResize(null, mockShadowClaw, mockSidebar, {} as any);
    expect(mockHandle.setAttribute).not.toHaveBeenCalled();
  });

  it("should return early if handle is not found", async () => {
    mockShadow.querySelector.mockReturnValue(null);
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, {} as any);
    expect(mockHandle.setAttribute).not.toHaveBeenCalled();
  });

  it("should return default width if appBody is not an HTMLElement", async () => {
    // Force getCurrentWidth to use fallback
    mockShadow.querySelector.mockImplementation((selector: string) => {
      if (selector === ".sidebar-resize-handle") return mockHandle;
      return null; // appBody is null
    });
    mockClampSidebarWidth.mockReturnValue(300);
    const setAttributeSpy = jest.spyOn(mockHandle, "setAttribute");
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, undefined);

    // It should have called aria-valuenow with current width (clamped DEFAULT_SIDEBAR_WIDTH_PX)
    expect(setAttributeSpy).toHaveBeenCalledWith("aria-valuenow", "300");
  });

  it("should handle error during DB fetch gracefully", async () => {
    (mockGetConfig as jest.Mock<any>).mockRejectedValue(new Error("DB Error"));
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, {} as any);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(
      mockShadow,
      DEFAULT_SIDEBAR_WIDTH_PX,
    );
  });

  it("should handle pointerup and pointercancel to stop resize", async () => {
    // Need innerWidth large enough
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    const dummyDb: ShadowClawDatabase = {} as any;

    // Return a finite string for parseFloat
    mockAppBody.style.getPropertyValue.mockReturnValue("250");

    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    // Start resize
    const pointerDownEvent = new Event("pointerdown") as any;
    pointerDownEvent.pointerId = 1;
    pointerDownEvent.pointerType = "mouse";
    pointerDownEvent.button = 0;
    pointerDownEvent.clientX = 50;
    mockHandle.dispatchEvent(pointerDownEvent);

    // Test pointerup
    const pointerUpEvent = new Event("pointerup") as any;
    pointerUpEvent.pointerId = 1;
    mockHandle.dispatchEvent(pointerUpEvent);

    expect(mockHandle.classList.remove).toHaveBeenCalledWith("active");
    expect(mockPersistSidebarWidth).toHaveBeenCalledWith(dummyDb, 250);
  });

  it("should ignore pointermove and pointerup if pointerId does not match", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, {} as any);

    // Start resize
    const pointerDownEvent = new Event("pointerdown") as any;
    pointerDownEvent.pointerId = 1;
    pointerDownEvent.pointerType = "mouse";
    pointerDownEvent.button = 0;
    mockHandle.dispatchEvent(pointerDownEvent);

    // Mismatched pointerMove
    const pointerMoveEvent = new Event("pointermove") as any;
    pointerMoveEvent.pointerId = 2; // different id
    document.dispatchEvent(pointerMoveEvent);

    // Ensure setSidebarWidth is not called again by pointerMove
    mockSetSidebarWidth.mockClear();
    document.dispatchEvent(pointerMoveEvent);
    expect(mockSetSidebarWidth).not.toHaveBeenCalled();

    // Mismatched pointerUp
    mockHandle.classList.remove.mockClear();
    const pointerUpEvent = new Event("pointerup") as any;
    pointerUpEvent.pointerId = 2; // different id
    mockHandle.dispatchEvent(pointerUpEvent);
    expect(mockHandle.classList.remove).not.toHaveBeenCalled();
  });

  it("should reset width on dblclick", async () => {
    const dummyDb: ShadowClawDatabase = {} as any;
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    mockHandle.dispatchEvent(new Event("dblclick"));

    expect(mockSetSidebarWidth).toHaveBeenCalledWith(
      mockShadow,
      DEFAULT_SIDEBAR_WIDTH_PX,
    );
    expect(mockPersistSidebarWidth).toHaveBeenCalledWith(
      dummyDb,
      DEFAULT_SIDEBAR_WIDTH_PX,
    );
  });

  it("should handle keyboard resizing", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    const dummyDb: ShadowClawDatabase = {} as any;

    // Let current width be 300
    mockAppBody.style.getPropertyValue.mockReturnValue("300");
    mockClampSidebarWidth.mockImplementation((_s, w) => w);

    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    // ArrowRight
    mockSetSidebarWidth.mockImplementation((_s, w) => {
      mockAppBody.style.getPropertyValue.mockReturnValue(String(w));
    });

    const arrowRight = new KeyboardEvent("keydown", { key: "ArrowRight" });
    jest.spyOn(arrowRight, "preventDefault");
    mockHandle.dispatchEvent(arrowRight);

    expect(arrowRight.preventDefault).toHaveBeenCalled();
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 300 + 12);
    expect(mockPersistSidebarWidth).toHaveBeenCalledWith(dummyDb, 312);

    // Home
    mockSetSidebarWidth.mockClear();
    const home = new KeyboardEvent("keydown", { key: "Home" });
    mockHandle.dispatchEvent(home);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(
      mockShadow,
      SIDEBAR_COLLAPSED_WIDTH_PX,
    );

    // End
    mockSetSidebarWidth.mockClear();
    const end = new KeyboardEvent("keydown", { key: "End" });
    mockHandle.dispatchEvent(end);
    expect(mockSetSidebarWidth).toHaveBeenCalled();
  });

  it("should ignore events on small screens", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, {} as any);

    // Pointerdown
    const pointerDown = new Event("pointerdown") as any;
    pointerDown.pointerId = 1;
    pointerDown.pointerType = "mouse";
    pointerDown.button = 0;
    mockHandle.dispatchEvent(pointerDown);
    expect(mockHandle.setPointerCapture).not.toHaveBeenCalled();

    // Keydown
    mockSetSidebarWidth.mockClear();
    const arrowRight = new KeyboardEvent("keydown", { key: "ArrowRight" });
    mockHandle.dispatchEvent(arrowRight);
    expect(mockSetSidebarWidth).not.toHaveBeenCalledWith(
      mockShadow,
      expect.any(Number),
    );
  });

  it("should cleanup event listeners on shadowClaw cleanup", async () => {
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, {} as any);

    expect(mockShadowClaw.addCleanup).toHaveBeenCalled();
    const cleanupFn = mockShadowClaw.addCleanup.mock.calls[0][0];

    const removeEventListenerSpy = jest.spyOn(
      mockHandle,
      "removeEventListener",
    );
    cleanupFn();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pointerup",
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pointercancel",
      expect.any(Function),
    );
  });

  it("should set aria-controls, aria-valuetext, and handle title for expanded and collapsed states", async () => {
    const dummyDb: ShadowClawDatabase = {} as any;
    mockGetConfig.mockResolvedValue(undefined);
    mockClampSidebarWidth.mockReturnValue(300);
    mockAppBody.style.getPropertyValue.mockReturnValue("300px");

    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    expect(mockHandle.setAttribute).toHaveBeenCalledWith(
      "aria-controls",
      "sidebar",
    );
    expect(mockHandle.setAttribute).toHaveBeenCalledWith(
      "aria-valuetext",
      "300px",
    );
    expect(mockHandle.title).toBe("Drag to resize sidebar");
  });

  it("should ignore saved sidebar widths below MIN_SIDEBAR_WIDTH_PX (e.g. 0 or 120) and fall back to default", async () => {
    const dummyDb: ShadowClawDatabase = {} as any;
    mockClampSidebarWidth.mockImplementation((_s, w) => w);

    mockGetConfig.mockResolvedValue(0);
    mockAppBody.style.getPropertyValue.mockReturnValue("300px");
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(
      mockShadow,
      DEFAULT_SIDEBAR_WIDTH_PX,
    );

    mockSetSidebarWidth.mockClear();
    mockGetConfig.mockResolvedValue(120);
    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(
      mockShadow,
      DEFAULT_SIDEBAR_WIDTH_PX,
    );
  });

  it("should snap shut to 0 and remove sidebar-resizing when dragging below 175px", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    mockGetConfig.mockResolvedValue(200);
    mockAppBody.style.getPropertyValue.mockReturnValue("200px");
    mockSidebar.getBoundingClientRect.mockReturnValue({ width: 200 });
    mockClampSidebarWidth.mockImplementation((_s, w) => w);
    mockSetSidebarWidth.mockImplementation((_s, w) => {
      mockAppBody.style.getPropertyValue.mockReturnValue(`${w}px`);
    });

    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, {} as any);
    mockSetSidebarWidth.mockClear();

    const pointerDown = new Event("pointerdown") as any;
    pointerDown.pointerId = 1;
    pointerDown.pointerType = "mouse";
    pointerDown.button = 0;
    pointerDown.clientX = 200;
    mockHandle.dispatchEvent(pointerDown);

    expect(mockAppBody.classList.contains("sidebar-resizing")).toBe(true);

    // Dragging within [175, 560] keeps sidebar-resizing enabled
    const moveInsideRange = new Event("pointermove") as any;
    moveInsideRange.pointerId = 1;
    moveInsideRange.clientX = 185;
    document.dispatchEvent(moveInsideRange);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 185);
    expect(mockAppBody.classList.contains("sidebar-resizing")).toBe(true);

    // Dragging below 175 snaps shut to 0 and removes sidebar-resizing so CSS animates collapse
    const moveBelowMin = new Event("pointermove") as any;
    moveBelowMin.pointerId = 1;
    moveBelowMin.clientX = 170;
    document.dispatchEvent(moveBelowMin);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 0);
    expect(mockAppBody.classList.contains("sidebar-resizing")).toBe(false);
    expect(mockHandle.setAttribute).toHaveBeenCalledWith("aria-valuenow", "0");
    expect(mockHandle.setAttribute).toHaveBeenCalledWith(
      "aria-valuetext",
      "Collapsed (0px)",
    );
    expect(mockHandle.title).toBe("Drag or double-click to expand sidebar");
  });

  it("should not persist collapsed 0 width on pointerup, while persisting widths >= 175", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    const dummyDb: ShadowClawDatabase = {} as any;
    mockAppBody.style.getPropertyValue.mockReturnValue("0px");

    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    const pointerDown = new Event("pointerdown") as any;
    pointerDown.pointerId = 1;
    pointerDown.pointerType = "mouse";
    pointerDown.button = 0;
    pointerDown.clientX = 0;
    mockHandle.dispatchEvent(pointerDown);

    const pointerUp = new Event("pointerup") as any;
    pointerUp.pointerId = 1;
    mockHandle.dispatchEvent(pointerUp);

    expect(mockPersistSidebarWidth).not.toHaveBeenCalled();

    mockAppBody.style.getPropertyValue.mockReturnValue("250px");
    const pointerDown2 = new Event("pointerdown") as any;
    pointerDown2.pointerId = 2;
    pointerDown2.pointerType = "mouse";
    pointerDown2.button = 0;
    pointerDown2.clientX = 250;
    mockHandle.dispatchEvent(pointerDown2);

    const pointerUp2 = new Event("pointerup") as any;
    pointerUp2.pointerId = 2;
    mockHandle.dispatchEvent(pointerUp2);

    expect(mockPersistSidebarWidth).toHaveBeenCalledWith(dummyDb, 250);
  });

  it("should re-open sidebar by dragging right across 175px from 0 width", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    mockGetConfig.mockResolvedValue(undefined);
    mockAppBody.style.getPropertyValue.mockReturnValue("0px");
    mockSidebar.getBoundingClientRect.mockReturnValue({ width: 0 });
    mockClampSidebarWidth.mockImplementation((_s, w) => w);
    mockSetSidebarWidth.mockImplementation((_s, w) => {
      mockAppBody.style.getPropertyValue.mockReturnValue(`${w}px`);
    });

    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, {} as any);
    mockSetSidebarWidth.mockClear();
    mockAppBody.style.getPropertyValue.mockReturnValue("0px");

    const pointerDown = new Event("pointerdown") as any;
    pointerDown.pointerId = 1;
    pointerDown.pointerType = "mouse";
    pointerDown.button = 0;
    pointerDown.clientX = 0;
    mockHandle.dispatchEvent(pointerDown);

    // Below 175 stays snapped at 0
    const moveStillCollapsed = new Event("pointermove") as any;
    moveStillCollapsed.pointerId = 1;
    moveStillCollapsed.clientX = 100;
    document.dispatchEvent(moveStillCollapsed);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 0);

    // Crossing >= 175 opens to 220 and removes sidebar-resizing for snap-open transition
    const moveOpen = new Event("pointermove") as any;
    moveOpen.pointerId = 1;
    moveOpen.clientX = 220;
    document.dispatchEvent(moveOpen);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 220);
    expect(mockAppBody.classList.contains("sidebar-resizing")).toBe(false);
  });

  it("should snap shut below 175px on ArrowLeft/Home without persisting, snap to 175px on ArrowRight, and toggle via Enter/Space", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    const dummyDb: ShadowClawDatabase = {} as any;
    mockGetConfig.mockResolvedValue(180);
    mockAppBody.style.getPropertyValue.mockReturnValue("180px");
    mockClampSidebarWidth.mockImplementation((_s, w) => w);
    mockSetSidebarWidth.mockImplementation((_s, w) => {
      mockAppBody.style.getPropertyValue.mockReturnValue(`${w}px`);
    });

    await initSidebarResize(mockShadow, mockShadowClaw, mockSidebar, dummyDb);

    // ArrowLeft from 180 -> 168 (< 175) snaps shut to 0 and does not persist
    mockSetSidebarWidth.mockClear();
    mockPersistSidebarWidth.mockClear();
    const arrowLeft = new KeyboardEvent("keydown", { key: "ArrowLeft" });
    mockHandle.dispatchEvent(arrowLeft);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 0);
    expect(mockPersistSidebarWidth).not.toHaveBeenCalled();

    // ArrowRight from 0 snaps open to MIN_SIDEBAR_WIDTH_PX (175) and persists 175
    mockSetSidebarWidth.mockClear();
    mockPersistSidebarWidth.mockClear();
    const arrowRight = new KeyboardEvent("keydown", { key: "ArrowRight" });
    mockHandle.dispatchEvent(arrowRight);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(
      mockShadow,
      MIN_SIDEBAR_WIDTH_PX,
    );
    expect(mockPersistSidebarWidth).toHaveBeenCalledWith(
      dummyDb,
      MIN_SIDEBAR_WIDTH_PX,
    );

    // Expand to 300 via ArrowRight/mock then collapse with Enter
    mockAppBody.style.getPropertyValue.mockReturnValue("300px");
    mockSetSidebarWidth.mockClear();
    mockPersistSidebarWidth.mockClear();
    const enterCollapse = new KeyboardEvent("keydown", { key: "Enter" });
    jest.spyOn(enterCollapse, "preventDefault");
    mockHandle.dispatchEvent(enterCollapse);

    expect(enterCollapse.preventDefault).toHaveBeenCalled();
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 0);
    expect(mockPersistSidebarWidth).not.toHaveBeenCalled();

    // Enter from 0 restores last expanded width (300) and persists 300
    mockSetSidebarWidth.mockClear();
    mockPersistSidebarWidth.mockClear();
    const enterExpand = new KeyboardEvent("keydown", { key: "Enter" });
    mockHandle.dispatchEvent(enterExpand);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 300);
    expect(mockPersistSidebarWidth).toHaveBeenCalledWith(dummyDb, 300);

    // Home collapses to 0 without persisting
    mockSetSidebarWidth.mockClear();
    mockPersistSidebarWidth.mockClear();
    const home = new KeyboardEvent("keydown", { key: "Home" });
    mockHandle.dispatchEvent(home);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 0);
    expect(mockPersistSidebarWidth).not.toHaveBeenCalled();

    // Space toggles back open to 300 and persists 300
    mockSetSidebarWidth.mockClear();
    mockPersistSidebarWidth.mockClear();
    const spaceExpand = new KeyboardEvent("keydown", { key: " " });
    jest.spyOn(spaceExpand, "preventDefault");
    mockHandle.dispatchEvent(spaceExpand);
    expect(spaceExpand.preventDefault).toHaveBeenCalled();
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 300);
    expect(mockPersistSidebarWidth).toHaveBeenCalledWith(dummyDb, 300);

    // Space again collapses to 0 without persisting
    mockSetSidebarWidth.mockClear();
    mockPersistSidebarWidth.mockClear();
    const spaceCollapse = new KeyboardEvent("keydown", { key: " " });
    mockHandle.dispatchEvent(spaceCollapse);
    expect(mockSetSidebarWidth).toHaveBeenCalledWith(mockShadow, 0);
    expect(mockPersistSidebarWidth).not.toHaveBeenCalled();
  });
});
