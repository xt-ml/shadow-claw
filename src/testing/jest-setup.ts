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
    decode(buf?: Uint8Array | ArrayBuffer): string {
      if (!buf) return "";
      if (buf instanceof Uint8Array) {
        return Buffer.from(buf).toString("utf-8");
      }
      return Buffer.from(new Uint8Array(buf)).toString("utf-8");
    }
  };
}

// Polyfill HTMLDialogElement in JSDOM
if (typeof globalThis.HTMLDialogElement !== "undefined") {
  if (!globalThis.HTMLDialogElement.prototype.showModal) {
    globalThis.HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
  }
  if (!globalThis.HTMLDialogElement.prototype.close) {
    globalThis.HTMLDialogElement.prototype.close = function (
      returnValue?: string,
    ) {
      this.removeAttribute("open");
      if (returnValue !== undefined) {
        this.returnValue = returnValue;
      }
    };
  }
}

class MockHeaders {
  private map = new Map<string, string>();
  constructor(init?: any) {
    if (init) {
      if (typeof init.forEach === "function") {
        init.forEach((v: string, k: string) =>
          this.map.set(k.toLowerCase(), v),
        );
      } else if (Array.isArray(init)) {
        for (const [k, v] of init) this.map.set(k.toLowerCase(), String(v));
      } else if (typeof init === "object") {
        for (const [k, v] of Object.entries(init)) {
          if (v != null) this.map.set(k.toLowerCase(), String(v));
        }
      }
    }
  }
  get(name: string) {
    return this.map.get(name.toLowerCase()) ?? null;
  }
  set(name: string, value: string) {
    this.map.set(name.toLowerCase(), String(value));
  }
  has(name: string) {
    return this.map.has(name.toLowerCase());
  }
  delete(name: string) {
    this.map.delete(name.toLowerCase());
  }
  forEach(callback: (value: string, key: string) => void) {
    this.map.forEach((v, k) => callback(v, k));
  }
  entries() {
    return this.map.entries();
  }
  keys() {
    return this.map.keys();
  }
  values() {
    return this.map.values();
  }
  [Symbol.iterator]() {
    return this.map.entries();
  }
}

class MockBlob {
  private parts: any[];
  public size: number;
  public type: string;
  constructor(parts?: any[], options?: { type?: string }) {
    this.parts = parts || [];
    this.type = options?.type || "";
    this.size = this.parts.reduce(
      (acc, p) =>
        acc +
        (p?.byteLength ||
          p?.length ||
          (typeof p === "string" ? Buffer.byteLength(p) : 0)),
      0,
    );
  }
  async arrayBuffer(): Promise<ArrayBuffer> {
    const combined = new Uint8Array(this.size);
    let offset = 0;
    for (const p of this.parts) {
      if (p instanceof Uint8Array) {
        combined.set(p, offset);
        offset += p.byteLength;
      } else if (p instanceof ArrayBuffer) {
        combined.set(new Uint8Array(p), offset);
        offset += p.byteLength;
      } else if (typeof p === "string") {
        const encoded = new (globalThis as any).TextEncoder().encode(p);
        combined.set(encoded, offset);
        offset += encoded.byteLength;
      }
    }
    return combined.buffer;
  }
  async text(): Promise<string> {
    const ab = await this.arrayBuffer();
    return new (globalThis as any).TextDecoder().decode(ab);
  }
  stream() {
    let resolved = false;
    let bytes: Uint8Array | null = null;
    const blobPromise = this.arrayBuffer().then((ab) => {
      bytes = new Uint8Array(ab);
      resolved = true;
    });
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        if (!resolved) await blobPromise;
        if (bytes && bytes.byteLength > 0) controller.enqueue(bytes);
        controller.close();
      },
    });
  }
}

class MockResponse {
  body: any;
  headers: any;
  status: number;
  statusText: string;
  ok: boolean;
  constructor(body?: any, init?: any) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? (this.status === 200 ? "OK" : "");
    this.ok = this.status >= 200 && this.status < 300;
    const HeadersClass = (globalThis as any).Headers || MockHeaders;
    this.headers =
      init?.headers instanceof HeadersClass
        ? init.headers
        : new HeadersClass(init?.headers);
  }
  async json() {
    if (typeof this.body === "string") return JSON.parse(this.body);
    if (this.body instanceof Uint8Array) {
      return JSON.parse(Buffer.from(this.body).toString("utf-8"));
    }
    return this.body;
  }
  async text() {
    if (typeof this.body === "string") return this.body;
    if (this.body instanceof Uint8Array) {
      return Buffer.from(this.body).toString("utf-8");
    }
    if (this.body && typeof this.body.text === "function") {
      return this.body.text();
    }
    return String(this.body ?? "");
  }
  async arrayBuffer() {
    if (this.body instanceof Uint8Array) {
      return this.body.buffer.slice(
        this.body.byteOffset,
        this.body.byteOffset + this.body.byteLength,
      );
    }
    if (this.body instanceof ArrayBuffer) return this.body;
    if (this.body && typeof this.body.arrayBuffer === "function") {
      return this.body.arrayBuffer();
    }
    if (typeof this.body === "string") {
      return new (globalThis as any).TextEncoder().encode(this.body).buffer;
    }
    return new ArrayBuffer(0);
  }
  async blob() {
    if (this.body instanceof (globalThis as any).Blob) return this.body;
    const ab = await this.arrayBuffer();
    const BlobClass = (globalThis as any).Blob || MockBlob;
    return new BlobClass([ab]);
  }
}

if (typeof (globalThis as any).Headers === "undefined") {
  (globalThis as any).Headers = MockHeaders;
  (global as any).Headers = MockHeaders;
}

if (typeof (globalThis as any).Blob === "undefined") {
  (globalThis as any).Blob = MockBlob;
  (global as any).Blob = MockBlob;
}

if (typeof (globalThis as any).Response === "undefined") {
  (globalThis as any).Response = MockResponse;
  (global as any).Response = MockResponse;
}

if (typeof (globalThis as any).Request === "undefined") {
  (globalThis as any).Request = class MockRequest {
    url: string;
    method: string;
    headers: any;
    constructor(input: any, init?: any) {
      this.url = typeof input === "string" ? input : input?.url || "";
      this.method = init?.method || "GET";
      const HeadersClass = (globalThis as any).Headers || MockHeaders;
      this.headers =
        init?.headers instanceof HeadersClass
          ? init.headers
          : new HeadersClass(init?.headers);
    }
  };
  (global as any).Request = (globalThis as any).Request;
}

(globalThis as any).__PRERENDER_MAIN_MEMORY__ = false;

if (typeof (globalThis as any).Worker === "undefined") {
  (globalThis as any).Worker = MockWorker;
}

if (typeof globalThis.structuredClone !== "function") {
  (globalThis as any).structuredClone = <T>(value: T): T =>
    deserialize(serialize(value));
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
      blob: () => Promise.resolve(new (globalThis as any).Blob()),
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
      blob: () => Promise.resolve(new (globalThis as any).Blob([content])),
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

// Polyfill ResizeObserver for JSDOM
if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as any).ResizeObserver = class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const BaseMouseEvent: any =
  typeof globalThis.MouseEvent !== "undefined"
    ? globalThis.MouseEvent
    : typeof globalThis.Event !== "undefined"
      ? globalThis.Event
      : class MockEvent {
          type: string;
          bubbles: boolean;
          cancelable: boolean;
          defaultPrevented = false;
          constructor(type: string, init?: any) {
            this.type = type;
            this.bubbles = init?.bubbles ?? false;
            this.cancelable = init?.cancelable ?? false;
          }
          preventDefault() {
            this.defaultPrevented = true;
          }
          stopPropagation() {}
        };

if (typeof globalThis.PointerEvent === "undefined") {
  (globalThis as any).PointerEvent = class PointerEvent extends BaseMouseEvent {
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
    constructor(type: string, init?: any) {
      super(type, init);
      this.pointerId = init?.pointerId ?? 0;
      this.pointerType = init?.pointerType ?? "mouse";
      this.clientX = init?.clientX ?? 0;
      this.clientY = init?.clientY ?? 0;
    }
  };
}

if (typeof globalThis.DragEvent === "undefined") {
  (globalThis as any).DragEvent = class DragEvent extends BaseMouseEvent {
    dataTransfer: any;
    constructor(type: string, init?: any) {
      super(type, init);
      this.dataTransfer = init?.dataTransfer ?? null;
    }
  };
}

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

if (typeof ShadowRoot !== "undefined") {
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
}

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
  "PeerJsChannel: connection closed with",
  "[WebVM] Ignoring invalid VM boot host:",
  "[WebVM] Ignoring invalid VM relay URL:",
  "[WebVM]",
  "[WebVM:ui]",
  "[WebVM boot]",
  "[shadow-claw-a2ui] Failed to load workspace",
  "[shadow-claw-a2ui] groupId not set, cannot resolve workspace files",
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
  "Failed to retrieve WebMCP tools via getTools():",
  "[Security] Registration blocked:",
  "[Security] Removing unapproved custom element:",
  "Failed to retrieve local storage handle from DB:",
  "fetch proxy: config updated",
  "Error reaching huggingface.co:",
  "Error reaching hf-mirror.com:",
  "Hugging Face main domain unreachable",
  "writePartialMeta error:",
  "flushChunkToCache error:",
  "[Proxy] Llamafile runtime:",
  "[Proxy] Mesh LLM request for model:",
  "[Proxy] Fetching Mesh LLM catalog...",
  "Ollama invoke error:",
  "Ollama models discovery error:",
  "Failed to check Prompt API onboarding:",
  "[webrtc-listen]",
  "[ShadowClaw MCP]",
  "fatal: not a git repository",
  "Stopping at filesystem boundary",
];

function isExpectedLog(...args: any[]) {
  const str = args
    .map((a) =>
      typeof a === "object" && a instanceof Error ? a.toString() : String(a),
    )
    .join(" ");
  return expectedLogs.some((expected) => str.includes(expected));
}

const originalStderrWrite = process.stderr.write.bind(process.stderr);
(process.stderr as any).write = (chunk: any, ...args: any[]): boolean => {
  const str = typeof chunk === "string" ? chunk : (chunk?.toString?.() ?? "");
  if (isExpectedLog(str)) {
    const cb = args.find((a) => typeof a === "function");
    if (cb) cb();
    return true;
  }
  return (originalStderrWrite as any)(chunk, ...args);
};

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
