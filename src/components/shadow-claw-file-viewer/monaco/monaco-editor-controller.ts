import { resolveRuntimeAsset } from "../../../utils/runtime-assets.js";
import {
  MONACO_CONNECT_MESSAGE,
  type HostToEditorMessage,
  type MonacoCustomProperties,
  type MonacoInitMessage,
  type MonacoStatus,
  type MonacoThemeName,
} from "./types.js";
import { isEditorToHostMessage } from "./utils/is-monaco-message.js";

export interface MonacoEditorControllerOptions {
  onChange?: (value: string) => void;
  onSave?: () => void;
  onEscape?: () => void;
  onFallback?: (reason: string) => void;
  onStatusChange?: (status: MonacoStatus) => void;
  readyTimeoutMs?: number;
  getValueTimeoutMs?: number;
}

interface PendingValueRequest {
  resolve: (value: string) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_READY_TIMEOUT_MS = 10_000;
const DEFAULT_GET_VALUE_TIMEOUT_MS = 1_000;

/**
 * Owns the lazy Monaco iframe and its MessagePort channel.
 *
 * Intentionally does NOT import `monaco-editor` so the main app bundle never
 * pulls Monaco in until the user enables the setting and opens a text file.
 */
export class MonacoEditorController {
  private readonly options: MonacoEditorControllerOptions;
  private readonly readyTimeoutMs: number;
  private readonly getValueTimeoutMs: number;

  private iframe: HTMLIFrameElement | null = null;
  private port: MessagePort | null = null;
  private ready = false;
  private disposed = false;
  private fallbackTriggered = false;
  private cachedValue = "";
  private pendingInit: MonacoInitMessage | null = null;
  private queue: HostToEditorMessage[] = [];
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private valueRequests = new Map<string, PendingValueRequest>();
  private requestCounter = 0;

  private onIframeLoad = () => this.connectPort();
  private onIframeError = () =>
    this.triggerFallback("Monaco editor iframe failed to load");

  constructor(options: MonacoEditorControllerOptions = {}) {
    this.options = options;
    this.readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
    this.getValueTimeoutMs =
      options.getValueTimeoutMs ?? DEFAULT_GET_VALUE_TIMEOUT_MS;
  }

  isMounted(): boolean {
    return this.iframe !== null && !this.disposed;
  }

  isReady(): boolean {
    return this.ready && !this.disposed;
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  getCachedValue(): string {
    return this.cachedValue;
  }

  mount(container: HTMLElement, init: Omit<MonacoInitMessage, "type">): void {
    if (this.disposed || this.fallbackTriggered) {
      return;
    }

    this.cachedValue = init.value;

    if (this.iframe) {
      if (this.iframe.parentElement !== container) {
        container.appendChild(this.iframe);
      }

      this.iframe.setAttribute("title", init.ariaLabel);

      if (this.ready) {
        this.post({ type: "set-language", language: init.language });
        this.post({ type: "set-read-only", readOnly: init.readOnly });
        this.post({ type: "set-value", value: init.value });
        this.post({
          type: "theme",
          theme: init.theme,
          customProperties: init.customProperties,
          forcedColors: init.forcedColors,
        });
      } else {
        this.pendingInit = { type: "init", ...init };
      }

      return;
    }

    this.pendingInit = { type: "init", ...init };

    const iframe = document.createElement("iframe");
    iframe.className = "file-monaco-frame";
    iframe.setAttribute("title", init.ariaLabel);
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute(
      "src",
      resolveRuntimeAsset("/assets/monaco/monaco-host.html"),
    );

    iframe.addEventListener("load", this.onIframeLoad);
    iframe.addEventListener("error", this.onIframeError);

    this.iframe = iframe;
    this.options.onStatusChange?.("loading");

    this.readyTimer = setTimeout(() => {
      this.triggerFallback("Monaco editor timed out while loading");
    }, this.readyTimeoutMs);

    container.appendChild(iframe);
  }

  setValue(value: string): void {
    this.cachedValue = value;
    this.post({ type: "set-value", value });
  }

  setReadOnly(readOnly: boolean): void {
    this.post({ type: "set-read-only", readOnly });
  }

  setLanguage(language: string): void {
    this.post({ type: "set-language", language });
  }

  setTheme(
    theme: MonacoThemeName,
    customProperties: MonacoCustomProperties,
    forcedColors?: boolean,
  ): void {
    this.post({ type: "theme", theme, customProperties, forcedColors });
  }

  focus(): void {
    this.iframe?.focus?.();
    this.post({ type: "focus" });
  }

  getValue(): Promise<string> {
    if (!this.ready || !this.port || this.disposed) {
      return Promise.resolve(this.cachedValue);
    }

    const requestId = `req-${++this.requestCounter}`;
    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        this.valueRequests.delete(requestId);
        resolve(this.cachedValue);
      }, this.getValueTimeoutMs);

      this.valueRequests.set(requestId, { resolve, timer });
      this.post({ type: "get-value", requestId });
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.cleanupChannelAndIframe();
  }

  private connectPort(): void {
    if (this.disposed || this.fallbackTriggered || !this.iframe) {
      return;
    }

    const win = this.iframe.contentWindow;
    if (!win || typeof MessageChannel === "undefined") {
      this.triggerFallback(
        "Monaco iframe window or MessageChannel unavailable",
      );
      return;
    }

    try {
      this.closePort();
      const channel = new MessageChannel();
      this.port = channel.port1;
      channel.port1.onmessage = (event: MessageEvent) =>
        this.handlePortMessage(event.data);
      channel.port1.start?.();

      win.postMessage(
        { type: MONACO_CONNECT_MESSAGE },
        window.location.origin,
        [channel.port2],
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.triggerFallback(`Failed to connect to Monaco iframe: ${message}`);
    }
  }

  private handlePortMessage(data: unknown): void {
    if (this.disposed || !isEditorToHostMessage(data)) {
      return;
    }

    switch (data.type) {
      case "ready": {
        this.clearReadyTimer();
        this.ready = true;
        this.options.onStatusChange?.("ready");

        if (this.pendingInit) {
          this.port?.postMessage(this.pendingInit);
          this.pendingInit = null;
        }

        while (this.queue.length > 0) {
          const msg = this.queue.shift()!;
          this.port?.postMessage(msg);
        }
        break;
      }
      case "change":
        this.cachedValue = data.value;
        this.options.onChange?.(data.value);
        break;
      case "save-request":
        this.options.onSave?.();
        break;
      case "escape":
        this.options.onEscape?.();
        break;
      case "value": {
        this.cachedValue = data.value;
        const pending = this.valueRequests.get(data.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.valueRequests.delete(data.requestId);
          pending.resolve(data.value);
        }
        break;
      }
      case "error":
        this.triggerFallback(data.message);
        break;
    }
  }

  private post(message: HostToEditorMessage): void {
    if (this.disposed || this.fallbackTriggered) {
      return;
    }

    if (this.ready && this.port) {
      this.port.postMessage(message);
    } else {
      this.queue.push(message);
    }
  }

  private triggerFallback(reason: string): void {
    if (this.disposed || this.fallbackTriggered) {
      return;
    }

    this.fallbackTriggered = true;
    this.cleanupChannelAndIframe();
    this.options.onStatusChange?.("fallback");
    this.options.onFallback?.(reason);
  }

  private clearReadyTimer(): void {
    if (this.readyTimer !== null) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }

  private closePort(): void {
    if (this.port) {
      this.port.onmessage = null;
      this.port.close();
      this.port = null;
    }
  }

  private cleanupChannelAndIframe(): void {
    this.clearReadyTimer();
    this.ready = false;
    this.pendingInit = null;
    this.queue = [];

    for (const [id, pending] of this.valueRequests) {
      clearTimeout(pending.timer);
      pending.resolve(this.cachedValue);
      this.valueRequests.delete(id);
    }

    this.closePort();

    if (this.iframe) {
      this.iframe.removeEventListener("load", this.onIframeLoad);
      this.iframe.removeEventListener("error", this.onIframeError);
      this.iframe.remove();
      this.iframe = null;
    }
  }
}
