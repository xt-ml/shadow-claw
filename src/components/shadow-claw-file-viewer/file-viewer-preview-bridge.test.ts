/**
 * @jest-environment jsdom
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jest } from "@jest/globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("file-viewer-preview-bridge.js (Preview IFrame Navigation & Broadcast Bridge)", () => {
  let originalPostMessage: any;

  beforeEach(() => {
    document.documentElement.className = "";
    document.documentElement.style.cssText = "";
    document.body.innerHTML = "";

    // Create a mock parent window object distinct from window itself
    // so the bridge's `window.parent !== window` check passes.
    const mockParent = { postMessage: jest.fn() };
    originalPostMessage = Object.getOwnPropertyDescriptor(window, "parent");
    Object.defineProperty(window, "parent", {
      value: mockParent,
      writable: true,
      configurable: true,
    });

    // Load and execute file-viewer-preview-bridge.js in jsdom context
    const bridgeScriptPath = path.resolve(
      __dirname,
      "file-viewer-preview-bridge.js",
    );
    const scriptCode = fs.readFileSync(bridgeScriptPath, "utf-8");
    // eslint-disable-next-line no-eval
    eval(scriptCode);
  });

  afterEach(() => {
    if (originalPostMessage) {
      Object.defineProperty(window, "parent", originalPostMessage);
    } else {
      Object.defineProperty(window, "parent", {
        value: window,
        writable: false,
        configurable: true,
      });
    }
    delete (window as any)._shadowClawBcBridgeInstalled;
  });

  describe("Theme Update Handling", () => {
    test("applies dark mode class and custom properties on shadow-claw-theme-update message", () => {
      const event = new MessageEvent("message", {
        data: {
          type: "shadow-claw-theme-update",
          theme: "dark",
          customProperties: {
            "--test-color": "#ff0000",
          },
        },
      });

      window.dispatchEvent(event);

      expect(document.documentElement.classList.contains("dark-mode")).toBe(
        true,
      );
      expect(
        document.documentElement.style.getPropertyValue("--test-color"),
      ).toBe("#ff0000");
    });

    test("removes dark mode class when theme is light", () => {
      document.documentElement.classList.add("dark-mode");

      const event = new MessageEvent("message", {
        data: {
          type: "shadow-claw-theme-update",
          theme: "light",
        },
      });

      window.dispatchEvent(event);

      expect(document.documentElement.classList.contains("dark-mode")).toBe(
        false,
      );
    });
  });

  describe("URL Parameters Update Handling", () => {
    test("updates history search state and re-invokes custom element connectedCallback on shadow-claw-update-url-params", () => {
      const mockConnectedCallback = jest.fn();
      const mockElement = document.createElement("custom-preview-element");
      (mockElement as any).connectedCallback = mockConnectedCallback;
      document.body.appendChild(mockElement);

      const event = new MessageEvent("message", {
        data: {
          type: "shadow-claw-update-url-params",
          search:
            "?gettingStarted=false&gameSave=https://example.com/assets/save.pdf",
        },
      });

      window.dispatchEvent(event);

      expect(window.location.search).toBe(
        "?gettingStarted=false&gameSave=https://example.com/assets/save.pdf",
      );
      expect(mockConnectedCallback).toHaveBeenCalled();
    });
  });

  describe("Link Interception", () => {
    test("intercepts internal relative links and posts shadow-claw-file-viewer-link message", () => {
      const link = document.createElement("a");
      link.href = "details.html";
      link.textContent = "Details";
      document.body.appendChild(link);

      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });

      link.dispatchEvent(clickEvent);

      expect(clickEvent.defaultPrevented).toBe(true);
      expect(window.parent.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-file-viewer-link",
          href: "details.html",
        }),
        "*",
      );
    });

    test("passes through fragment-only links without interception", () => {
      const link = document.createElement("a");
      link.href = "#section-2";
      link.textContent = "Section 2";
      document.body.appendChild(link);

      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });

      link.dispatchEvent(clickEvent);

      expect(clickEvent.defaultPrevented).toBe(false);
    });

    test("intercepts external links to prevent iframe self-navigation and posts shadow-claw-file-viewer-link", () => {
      const link = document.createElement("a");
      link.href =
        "https://kherrick.github.io/block-garden/?gettingStarted=false&gameSave=https://kherrick.github.io/block-garden/assets/game-saves/The-Garden.pdf";
      link.textContent = "The Garden PDF";
      document.body.appendChild(link);

      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });

      link.dispatchEvent(clickEvent);

      expect(clickEvent.defaultPrevented).toBe(true);
      expect(window.parent.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-file-viewer-link",
          href: "https://kherrick.github.io/block-garden/?gettingStarted=false&gameSave=https://kherrick.github.io/block-garden/assets/game-saves/The-Garden.pdf",
        }),
        "*",
      );
    });
  });

  describe("Navigation & Input Suppression", () => {
    test("suppresses swipe gestures on form inputs and data-no-swipe elements", () => {
      const container = document.createElement("div");
      container.setAttribute("data-no-swipe", "true");
      const input = document.createElement("input");
      container.appendChild(input);
      document.body.appendChild(container);

      // Simulate mouse swipe starting on input
      const mousedown = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 50,
        button: 0,
      });
      input.dispatchEvent(mousedown);

      const mouseup = new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        clientX: 50,
        clientY: 50,
        button: 0,
      });
      input.dispatchEvent(mouseup);

      expect(window.parent.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "shadow-claw-swipe" }),
        "*",
      );
    });
  });

  describe("Auto-Resize Height Measurement", () => {
    test("schedules height measurement and posts shadow-claw-iframe-resize", async () => {
      const content = document.createElement("div");
      content.style.height = "500px";
      document.body.appendChild(content);

      Object.defineProperty(document.body, "scrollHeight", {
        value: 500,
        configurable: true,
      });

      // Trigger resize event
      window.dispatchEvent(new Event("resize"));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(window.parent.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-iframe-resize",
          height: 500,
        }),
        "*",
      );
    });
  });
});
