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
  const MIN_SIDEBAR_WIDTH_PX = 200;

  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule("./clampSidebarWidth.js", () => ({
      clampSidebarWidth: jest.fn(),
    }));

    jest.unstable_mockModule("./persistSidebarWidth.js", () => ({
      persistSidebarWidth: jest.fn(),
    }));

    jest.unstable_mockModule("./setSidebarWidth.js", () => ({
      setSidebarWidth: jest.fn(),
    }));

    jest.unstable_mockModule("../../../db/getConfig.js", () => ({
      getConfig: jest.fn(),
    }));

    jest.unstable_mockModule("../shadow-claw.js", () => ({
      DEFAULT_SIDEBAR_WIDTH_PX: 300,
      MIN_SIDEBAR_WIDTH_PX: 200,
    }));

    mockClampSidebarWidth = (await import("./clampSidebarWidth.js"))
      .clampSidebarWidth as jest.Mock<any>;
    mockPersistSidebarWidth = (await import("./persistSidebarWidth.js"))
      .persistSidebarWidth as jest.Mock<any>;
    mockSetSidebarWidth = (await import("./setSidebarWidth.js"))
      .setSidebarWidth as jest.Mock<any>;
    mockGetConfig = (await import("../../../db/getConfig.js"))
      .getConfig as jest.Mock<any>;

    initSidebarResize = (await import("./initSidebarResize.js"))
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
      String(MIN_SIDEBAR_WIDTH_PX),
    );

    expect(mockSetSidebarWidthMock).toHaveBeenCalledWith(
      mockShadow,
      DEFAULT_SIDEBAR_WIDTH_PX,
    );
  });

  it("should restore saved sidebar width if present in DB", async () => {
    const savedWidth = 350;
    const dummyDb: ShadowClawDatabase = {
      /* mocked DB */
    } as any;
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
});
