import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { MONACO_CONNECT_MESSAGE } from "./types.js";
import { MonacoEditorController } from "./monaco-editor-controller.js";

class FakePort {
  onmessage: ((event: MessageEvent) => void) | null = null;
  posted: unknown[] = [];
  closed = false;
  peer?: FakePort;

  postMessage(data: unknown) {
    this.posted.push(data);
    if (this.peer && !this.peer.closed) {
      this.peer.onmessage?.({ data } as MessageEvent);
    }
  }

  start() {}

  close() {
    this.closed = true;
    this.onmessage = null;
  }
}

class FakeMessageChannel {
  port1 = new FakePort();
  port2 = new FakePort();

  constructor() {
    this.port1.peer = this.port2;
    this.port2.peer = this.port1;
  }
}

const baseInit = {
  value: "console.log(1);",
  language: "javascript",
  readOnly: true,
  theme: "dark" as const,
  customProperties: { "--shadow-claw-bg-primary": "#0f172a" },
  ariaLabel: "Code editor: app.js",
};

describe("MonacoEditorController", () => {
  const OriginalMessageChannel = globalThis.MessageChannel;

  beforeEach(() => {
    jest.useFakeTimers();
    (globalThis as any).MessageChannel = FakeMessageChannel;
  });

  afterEach(() => {
    jest.useRealTimers();
    (globalThis as any).MessageChannel = OriginalMessageChannel;
    document.body.innerHTML = "";
  });

  function setupIframeMock(container: HTMLElement) {
    let remotePort: FakePort | null = null;
    const postToWindow = jest.fn(
      (msg: unknown, _origin: string, transfer?: unknown[]) => {
        if (
          msg &&
          typeof msg === "object" &&
          (msg as any).type === MONACO_CONNECT_MESSAGE &&
          Array.isArray(transfer) &&
          transfer[0] instanceof FakePort
        ) {
          remotePort = transfer[0] as FakePort;
        }
      },
    );

    const origCreate = document.createElement.bind(document);
    const spy = jest
      .spyOn(document, "createElement")
      .mockImplementation((tag: string, options?: any) => {
        const el = origCreate(tag, options);
        if (tag.toLowerCase() === "iframe") {
          Object.defineProperty(el, "contentWindow", {
            configurable: true,
            value: { postMessage: postToWindow },
          });
        }
        return el;
      });

    return {
      container,
      postToWindow,
      getRemotePort: () => remotePort,
      restore: () => spy.mockRestore(),
    };
  }

  it("does not create an iframe before mount is called", () => {
    const controller = new MonacoEditorController();
    expect(controller.isMounted()).toBe(false);
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("creates one accessible same-origin iframe on mount and performs the MessagePort handshake", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const mock = setupIframeMock(container);

    try {
      const onStatusChange = jest.fn();
      const controller = new MonacoEditorController({ onStatusChange });
      controller.mount(container, baseInit);

      const iframe = container.querySelector("iframe.file-monaco-frame");
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute("title")).toBe("Code editor: app.js");
      expect(iframe?.getAttribute("sandbox")).toBe(
        "allow-scripts allow-same-origin",
      );
      expect(iframe?.getAttribute("referrerpolicy")).toBe("no-referrer");
      expect(iframe?.getAttribute("src")).toContain(
        "assets/monaco/monaco-host.html",
      );
      expect(onStatusChange).toHaveBeenCalledWith("loading");

      iframe?.dispatchEvent(new Event("load"));
      expect(mock.postToWindow).toHaveBeenCalledWith(
        { type: MONACO_CONNECT_MESSAGE },
        window.location.origin,
        [expect.any(FakePort)],
      );

      const remote = mock.getRemotePort()!;
      remote.postMessage({ type: "ready" });

      expect(onStatusChange).toHaveBeenCalledWith("ready");
      expect(remote.peer?.posted).toContainEqual({
        type: "init",
        ...baseInit,
      });

      // Re-mounting reuses the same iframe
      controller.mount(container, { ...baseInit, value: "next" });
      expect(
        container.querySelectorAll("iframe.file-monaco-frame").length,
      ).toBe(1);

      controller.dispose();
    } finally {
      mock.restore();
    }
  });

  it("queues commands before ready and flushes them in order once ready", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const mock = setupIframeMock(container);

    try {
      const controller = new MonacoEditorController();
      controller.mount(container, baseInit);
      controller.setReadOnly(false);
      controller.setLanguage("typescript");
      controller.focus();

      const iframe = container.querySelector("iframe")!;
      iframe.dispatchEvent(new Event("load"));
      const remote = mock.getRemotePort()!;
      remote.postMessage({ type: "ready" });

      const sent = remote.peer!.posted.map((m: any) => m.type);
      expect(sent).toEqual(["init", "set-read-only", "set-language", "focus"]);

      controller.dispose();
    } finally {
      mock.restore();
    }
  });

  it("handles change, save-request, and escape events from the iframe", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const mock = setupIframeMock(container);

    try {
      const onChange = jest.fn();
      const onSave = jest.fn();
      const onEscape = jest.fn();
      const controller = new MonacoEditorController({
        onChange,
        onSave,
        onEscape,
      });
      controller.mount(container, baseInit);
      container.querySelector("iframe")!.dispatchEvent(new Event("load"));
      const remote = mock.getRemotePort()!;
      remote.postMessage({ type: "ready" });

      remote.postMessage({ type: "change", value: "updated" });
      expect(controller.getCachedValue()).toBe("updated");
      expect(onChange).toHaveBeenCalledWith("updated");

      remote.postMessage({ type: "save-request" });
      expect(onSave).toHaveBeenCalledTimes(1);

      remote.postMessage({ type: "escape" });
      expect(onEscape).toHaveBeenCalledTimes(1);

      controller.dispose();
    } finally {
      mock.restore();
    }
  });

  it("resolves getValue() from the iframe and falls back to cached value on timeout", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const mock = setupIframeMock(container);

    try {
      const controller = new MonacoEditorController({ getValueTimeoutMs: 500 });
      controller.mount(container, baseInit);
      container.querySelector("iframe")!.dispatchEvent(new Event("load"));
      const remote = mock.getRemotePort()!;
      remote.postMessage({ type: "ready" });

      // Normal reply
      const p1 = controller.getValue();
      const req = remote.peer!.posted.find(
        (m: any) => m.type === "get-value",
      ) as any;
      remote.postMessage({
        type: "value",
        requestId: req.requestId,
        value: "live-buffer",
      });
      await expect(p1).resolves.toBe("live-buffer");

      // Timeout fallback
      controller.setValue("cached-text");
      const p2 = controller.getValue();
      jest.advanceTimersByTime(501);
      await expect(p2).resolves.toBe("cached-text");

      controller.dispose();
    } finally {
      mock.restore();
    }
  });

  it("triggers onFallback once on ready timeout or error and removes the iframe", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const mock = setupIframeMock(container);

    try {
      const onFallback = jest.fn();
      const onStatusChange = jest.fn();
      const controller = new MonacoEditorController({
        onFallback,
        onStatusChange,
        readyTimeoutMs: 5000,
      });

      controller.mount(container, baseInit);
      jest.advanceTimersByTime(5001);

      expect(onFallback).toHaveBeenCalledTimes(1);
      expect(onStatusChange).toHaveBeenCalledWith("fallback");
      expect(container.querySelector("iframe")).toBeNull();

      // A second error does not double-fire
      const c2 = new MonacoEditorController({
        onFallback,
        readyTimeoutMs: 5000,
      });
      c2.mount(container, baseInit);
      c2.dispose();
    } finally {
      mock.restore();
    }
  });

  it("disposes cleanly, closing the port and removing listeners and iframe", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const mock = setupIframeMock(container);

    try {
      const controller = new MonacoEditorController();
      controller.mount(container, baseInit);
      const iframe = container.querySelector("iframe")!;
      iframe.dispatchEvent(new Event("load"));
      const remote = mock.getRemotePort()!;
      remote.postMessage({ type: "ready" });

      controller.dispose();
      expect(controller.isDisposed()).toBe(true);
      expect(controller.isMounted()).toBe(false);
      expect(container.querySelector("iframe")).toBeNull();
      expect(remote.peer?.closed).toBe(true);
    } finally {
      mock.restore();
    }
  });
});
