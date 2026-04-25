import { jest } from "@jest/globals";
import {
  TransformStream,
  ReadableStream,
  WritableStream,
} from "node:stream/web";

import "fake-indexeddb/auto";

class MockAudioContext {
  state: "suspended" | "running" = "suspended";
  currentTime: number = 0;

  resume(): Promise<void> {
    this.state = "running";

    return Promise.resolve();
  }

  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 440 },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    };
  }

  get destination() {
    return {};
  }
}

import fs from "node:fs";
import path from "node:path";

// Add generic Web APIs for JSDOM from Node globals
globalThis.Response = global.Response;
globalThis.Request = global.Request;
globalThis.Headers = global.Headers;

// Implement a filesystem-aware fetch for component templates/styles
globalThis.fetch = jest.fn((url: string | URL | Request) => {
  const urlStr = url.toString();
  if (urlStr.startsWith("http")) {
    return (global as any).fetch(url);
  }

  // Resolve relative paths from the src directory
  let filePath: string;
  if (path.isAbsolute(urlStr)) {
    filePath = urlStr;
  } else {
    // If it starts with src/, it's relative to CWD
    if (urlStr.startsWith("src/")) {
      filePath = path.join(process.cwd(), urlStr);
    } else {
      // Otherwise assume it's relative to src/
      filePath = path.join(process.cwd(), "src", urlStr);
    }
  }

  // Handle leading slashes (from components)
  if (urlStr.startsWith("/")) {
    if (urlStr.startsWith("/src/")) {
      filePath = path.join(process.cwd(), urlStr);
    } else {
      filePath = path.join(process.cwd(), "src", urlStr);
    }
  }

  try {
    console.log(`[fetch mock] URL: ${urlStr} -> Resolved Path: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.error(`[fetch mock] File not found: ${filePath}`);

      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(""),
      } as Response);
    }

    const content = fs.readFileSync(filePath, "utf8");

    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(content),
      json: () => Promise.resolve(JSON.parse(content)),
      blob: () => Promise.resolve(new Blob([content])),
      arrayBuffer: () => Promise.resolve(Buffer.from(content).buffer),
    } as Response);
  } catch (err) {
    console.error(`Fetch failed for ${urlStr} (resolved to ${filePath}):`, err);

    return Promise.reject(new Error(`Failed to fetch ${urlStr}: ${err}`));
  }
}) as any;

(globalThis as any).TransformStream = TransformStream;
(globalThis as any).ReadableStream = ReadableStream;
(globalThis as any).WritableStream = WritableStream;
(globalThis as any).AudioContext = MockAudioContext;

// Polyfill CSSStyleSheet and adoptedStyleSheets for JSDOM
if (typeof globalThis.CSSStyleSheet === "undefined") {
  (globalThis as any).CSSStyleSheet = class MockCSSStyleSheet {
    _css: string = "";
    replaceSync(css: string) {
      this._css = css;
    }

    replace(css: string) {
      this._css = css;

      return Promise.resolve(this);
    }
  };
} else {
  const proto = globalThis.CSSStyleSheet.prototype as any;
  if (typeof proto.replaceSync === "undefined") {
    proto.replaceSync = function (css: string) {
      this._css = css;
    };
  }
}

Object.defineProperty(ShadowRoot.prototype, "adoptedStyleSheets", {
  configurable: true,
  set(sheets: any[]) {
    (this as any)._adoptedStyleSheets = sheets;
    if (Array.isArray(sheets)) {
      sheets.forEach((sheet) => {
        if (sheet._css) {
          const style = document.createElement("style");
          style.textContent = sheet._css;
          this.appendChild(style);
        }
      });
    }
  },
  get() {
    return (this as any)._adoptedStyleSheets || [];
  },
});
