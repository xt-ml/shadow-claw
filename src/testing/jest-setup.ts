import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";
import process from "node:process";

process.setMaxListeners(20);
EventEmitter.defaultMaxListeners = 20;

import "fake-indexeddb/auto";

jest.unstable_mockModule("peerjs", () => ({
  Peer: jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      destroy: jest.fn(),
    };
  }),
}));

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { deserialize, serialize } from "node:v8";
import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from "node:stream/web";

class MockAudioContext {
  currentTime: number = 0;
  state: "suspended" | "running" = "suspended";

  createGain() {
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    };
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

  get destination() {
    return {};
  }

  resume(): Promise<void> {
    this.state = "running";

    return Promise.resolve();
  }
}

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;

  addEventListener() {}

  postMessage() {}

  removeEventListener() {}

  terminate() {}
}

// Add generic Web APIs for JSDOM from Node globals
globalThis.Response = global.Response;
globalThis.Request = global.Request;
globalThis.Headers = global.Headers;
(globalThis as any).__PRERENDER_MAIN_MEMORY__ = false;

if (typeof (globalThis as any).Worker === "undefined") {
  (globalThis as any).Worker = MockWorker;
}

if (typeof globalThis.structuredClone !== "function") {
  (globalThis as any).structuredClone = <T>(value: T): T =>
    deserialize(serialize(value));
}

// Patch TextEncoder
if (typeof globalThis.TextEncoder === "undefined") {
  (globalThis as any).TextEncoder = class TextEncoder {
    encode(str: string): Uint8Array {
      return new Uint8Array(Buffer.from(str, "utf-8"));
    }
  };
}

// Patch TextDecoder
if (typeof globalThis.TextDecoder === "undefined") {
  (globalThis as any).TextDecoder = class TextDecoder {
    decode(buf: Uint8Array): string {
      return Buffer.from(buf).toString("utf-8");
    }
  };
}

// Implement a filesystem-aware fetch for component templates/styles
globalThis.fetch = jest.fn((url: string | URL | Request) => {
  const urlStr = url.toString();
  if (urlStr.startsWith("http")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(""),
      json: () => Promise.resolve({}),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response);
  }

  // Resolve relative paths from the src directory
  let filePath: string;
  if (isAbsolute(urlStr)) {
    filePath = urlStr;
  } else {
    // If it starts with src/, it's relative to CWD
    if (urlStr.startsWith("src/")) {
      filePath = join(process.cwd(), urlStr);
    } else {
      // Otherwise assume it's relative to src/
      filePath = join(process.cwd(), "src", urlStr);
    }
  }

  // Handle leading slashes (from components)
  if (urlStr.startsWith("/")) {
    if (urlStr.startsWith("/src/")) {
      filePath = join(process.cwd(), urlStr);
    } else {
      filePath = join(process.cwd(), "src", urlStr);
    }
  }

  try {
    if (!existsSync(filePath)) {
      console.error(`[fetch mock] File not found: ${filePath}`);

      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve(""),
      } as Response);
    }

    const content = readFileSync(filePath, "utf8");

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

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;

const expectedLogs = [
  "Task t3 has no groupId - refusing to execute",
  "Failed to delete task from server \u2014 queued for replay",
  "Server rejected task deletion:",
  "Failed to delete task from server:",
  "Server rejected task sync:",
  "[ModelRegistry] Error fetching models for",
  "[ShadowClaw] Chat-template control token(s) detected and stripped",
  "Failed to parse tool arguments:",
  "[shadow-claw-a2ui] Tab spec is missing or invalid for component id:",
  "ShadowClaw UI initialized",
  "[WebVM] Failed to sync host workspace into VM:",
  "PeerTaskManager: invalid transition",
  "PeerTaskManager: task",
  "[ShadowClaw] Failed to load models from",
  "PeerJsChannel: connected to signaling server",
  "PeerJsChannel: connection opened with",
  "PeerJsChannel: rejecting connection from untrusted peer:",
  "[WebVM] Ignoring invalid VM boot host:",
  "[WebVM] Ignoring invalid VM relay URL:",
  "[WebVM:ui] Starting boot - checking assets...",
  "[WebVM boot] Mode",
  "[WebVM:ui] Assets not found.",
  "Failed to fetch Vertex AI models dynamically:",
  "Vertex AI proxy error:",
  "Error: Not implemented: navigation (except hash changes)",
  "GetAgentCard returned error:",
  "[ShadowClaw] Service worker update failed.",
  "[ModelRegistry] Registered",
  "Failed to ensure main workspace Memory:",
  "Failed to open file: a/b/c.txt",
  "Failed to import chat data:",
  "Failed to parse peerjs_peer_aliases",
  "iMessage bridge poll error: TypeError: Cannot read properties of undefined (reading 'ok')",
  "iMessage bridge poll error: TypeError: response.json is not a function",
  "Save error: TypeError: dialog?.close is not a function",
  "Found 1 legacy scheduled task(s) with NULL subscriber_id for group br:main",
  "🦞 ShadowClaw initializing...",
  "✅ ShadowClaw initialized successfully",
  "[fetch mock] File not found:",
  "Failed to load files in store:",
  "DOMException",
  "ERR_VM_MODULE_NOT_MODULE",
  "Provided module is not an instance of Module",
  "Test environment has been torn down",
  "Polyfill: window.",
  "Built-in AI Polyfill:",
];

function isExpectedLog(...args: any[]) {
  const str = args
    .map((a) =>
      typeof a === "object" && a instanceof Error ? a.toString() : String(a),
    )
    .join(" ");
  return expectedLogs.some((expected) => str.includes(expected));
}

console.error = (...args: any[]) => {
  if (isExpectedLog(...args)) return;
  originalConsoleError(...args);
};
console.warn = (...args: any[]) => {
  if (isExpectedLog(...args)) return;
  originalConsoleWarn(...args);
};
console.log = (...args: any[]) => {
  if (isExpectedLog(...args)) return;
  originalConsoleLog(...args);
};
console.info = (...args: any[]) => {
  if (isExpectedLog(...args)) return;
  originalConsoleInfo(...args);
};
