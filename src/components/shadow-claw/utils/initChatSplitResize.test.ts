import { jest } from "@jest/globals";
import { initChatSplitResize } from "./initChatSplitResize.js";

describe("initChatSplitResize", () => {
  let shadowRoot: ShadowRoot;
  let mainContent: HTMLElement;
  let handle: HTMLElement;
  let shadowClaw: any;

  beforeEach(() => {
    const host = document.createElement("div");
    shadowRoot = host.attachShadow({ mode: "open" });

    mainContent = document.createElement("div");
    mainContent.classList.add("main-content");

    handle = document.createElement("div");
    handle.classList.add("chat-split-resize-handle");

    mainContent.appendChild(handle);
    shadowRoot.appendChild(mainContent);

    shadowClaw = {
      addCleanup: jest.fn(),
    };

    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = jest.fn();
    }
  });

  it("should initialize attributes and event listeners", async () => {
    await initChatSplitResize(shadowRoot, shadowClaw, handle, undefined);

    expect(handle.getAttribute("tabindex")).toBe("0");
    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
    expect(handle.getAttribute("aria-label")).toBe("Resize chat panel height");
    expect(shadowClaw.addCleanup).toHaveBeenCalled();
  });

  it("should update height on ArrowUp / ArrowDown keydown", async () => {
    await initChatSplitResize(shadowRoot, shadowClaw, handle, undefined);

    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    expect(
      mainContent.style.getPropertyValue("--chat-split-height"),
    ).toBeTruthy();

    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(
      mainContent.style.getPropertyValue("--chat-split-height"),
    ).toBeTruthy();
  });
});
