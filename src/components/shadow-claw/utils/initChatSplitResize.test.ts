import { jest } from "@jest/globals";
import {
  DEFAULT_CHAT_SPLIT_HEIGHT_PX,
  MIN_CHAT_SPLIT_HEIGHT_PX,
} from "../constants.js";

const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

const { initChatSplitResize } = await import("./initChatSplitResize.js");

describe("initChatSplitResize", () => {
  let shadowRoot: ShadowRoot;
  let mainContent: HTMLElement;
  let chatPage: HTMLElement;
  let handle: HTMLElement;
  let shadowClaw: any;
  let cleanups: Array<() => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    cleanups = [];

    // Mock desktop window dimensions
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 900,
    });

    const host = document.createElement("div");
    shadowRoot = host.attachShadow({ mode: "open" });

    mainContent = document.createElement("div");
    mainContent.classList.add("main-content");
    mainContent.getBoundingClientRect = () => ({
      height: 900,
      width: 1200,
      top: 0,
      left: 0,
      bottom: 900,
      right: 1200,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    chatPage = document.createElement("div");
    chatPage.classList.add("chat-page");
    chatPage.getBoundingClientRect = () => ({
      height: 300,
      width: 400,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    handle = document.createElement("div");
    handle.classList.add("chat-split-resize-handle");

    mainContent.appendChild(handle);
    mainContent.appendChild(chatPage);
    shadowRoot.appendChild(mainContent);

    shadowClaw = {
      addCleanup: jest.fn((fn: () => void) => {
        cleanups.push(fn);
      }),
    };

    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = jest.fn();
    }
  });

  afterEach(() => {
    for (const fn of cleanups) {
      fn();
    }
  });

  it("handles null shadow or null handle safely", async () => {
    await initChatSplitResize(null, shadowClaw, handle, undefined);
    expect(shadowClaw.addCleanup).not.toHaveBeenCalled();

    await initChatSplitResize(shadowRoot, shadowClaw, null as any, undefined);
    expect(shadowClaw.addCleanup).not.toHaveBeenCalled();
  });

  it("loads saved height from db or defaults", async () => {
    const mockDb: any = {};
    mockGetConfig.mockResolvedValueOnce(450);

    await initChatSplitResize(shadowRoot, shadowClaw, handle, mockDb);
    expect(mainContent.style.getPropertyValue("--chat-split-height")).toBe(
      "450px",
    );

    // String saved value
    mockGetConfig.mockResolvedValueOnce("350");
    await initChatSplitResize(shadowRoot, shadowClaw, handle, mockDb);
    expect(mainContent.style.getPropertyValue("--chat-split-height")).toBe(
      "350px",
    );

    // Fallback on error
    mockGetConfig.mockRejectedValueOnce(new Error("DB error"));
    await initChatSplitResize(shadowRoot, shadowClaw, handle, mockDb);
    expect(mainContent.style.getPropertyValue("--chat-split-height")).toBe(
      `${DEFAULT_CHAT_SPLIT_HEIGHT_PX}px`,
    );
  });

  it("handles pointer drag resize workflow", async () => {
    const mockDb: any = {};
    await initChatSplitResize(shadowRoot, shadowClaw, handle, mockDb);

    // Pointer down to start drag
    const pointerDownEvent = new Event("pointerdown", { bubbles: true }) as any;
    pointerDownEvent.pointerId = 1;
    pointerDownEvent.pointerType = "mouse";
    pointerDownEvent.button = 0;
    pointerDownEvent.clientY = 500;
    pointerDownEvent.preventDefault = jest.fn();

    handle.dispatchEvent(pointerDownEvent);
    expect(handle.classList.contains("active")).toBe(true);

    // Pointer move dragging upward (delta = 500 - 400 = 100 increase)
    const pointerMoveEvent = new Event("pointermove", { bubbles: true }) as any;
    pointerMoveEvent.pointerId = 1;
    pointerMoveEvent.clientY = 400;
    document.dispatchEvent(pointerMoveEvent);

    // Pointer up to finish drag
    const pointerUpEvent = new Event("pointerup", { bubbles: true }) as any;
    pointerUpEvent.pointerId = 1;
    handle.dispatchEvent(pointerUpEvent);

    expect(handle.classList.contains("active")).toBe(false);
  });

  it("handles dblclick to reset to default height", async () => {
    const mockDb: any = {};
    await initChatSplitResize(shadowRoot, shadowClaw, handle, mockDb);

    mainContent.style.setProperty("--chat-split-height", "600px");
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(mainContent.style.getPropertyValue("--chat-split-height")).toBe(
      `${DEFAULT_CHAT_SPLIT_HEIGHT_PX}px`,
    );
  });

  it("handles keyboard navigation with Home, End, Shift+Arrow", async () => {
    const mockDb: any = {};
    await initChatSplitResize(shadowRoot, shadowClaw, handle, mockDb);

    // Home key sets to min height
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    expect(mainContent.style.getPropertyValue("--chat-split-height")).toBe(
      `${MIN_CHAT_SPLIT_HEIGHT_PX}px`,
    );

    // End key sets to max clamped height
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    expect(
      mainContent.style.getPropertyValue("--chat-split-height"),
    ).toBeTruthy();

    // Shift + ArrowUp increases by 32
    handle.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(
      mainContent.style.getPropertyValue("--chat-split-height"),
    ).toBeTruthy();
  });

  it("ignores resize events on mobile screen width (< 896px)", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 600,
    });

    await initChatSplitResize(shadowRoot, shadowClaw, handle, undefined);

    const pointerDownEvent = new Event("pointerdown", { bubbles: true }) as any;
    pointerDownEvent.pointerId = 1;
    pointerDownEvent.clientY = 500;
    pointerDownEvent.button = 0;

    handle.dispatchEvent(pointerDownEvent);
    expect(handle.classList.contains("active")).toBe(false);

    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
  });
});
