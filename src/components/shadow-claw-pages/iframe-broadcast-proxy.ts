/**
 * iframe-broadcast-proxy.ts
 *
 * Parent-side BroadcastChannel proxy for sandboxed iframes.
 * When allow-same-origin is omitted from preview iframes, the iframe operates
 * under an opaque (null) origin. Browser BroadcastChannel instances are partitioned
 * by origin, preventing direct communication between parent/worker tools and the iframe.
 *
 * This proxy is completely AGNOSTIC and generic. It dynamically tracks BroadcastChannels
 * instantiated on the parent origin and extracts channel names declaratively from tool
 * definitions registered via site-config/toolsStore.
 */

export class IframeBroadcastProxy {
  private commandChannels: Map<string, BroadcastChannel> = new Map();
  private originalBroadcastChannel: typeof BroadcastChannel | null = null;

  constructor(private getTargetWindow: () => WindowProxy | null) {
    if (typeof BroadcastChannel !== "undefined") {
      this.patchParentBroadcastChannel();
    }
  }

  /**
   * Automatically intercept BroadcastChannel creation on parent window to
   * dynamically track and forward any channel used by tools or parent scripts.
   */
  private patchParentBroadcastChannel(): void {
    if ((globalThis as any)._shadowClawParentBcPatched) {
      return;
    }
    (globalThis as any)._shadowClawParentBcPatched = true;

    const self = this;
    const NativeBc = globalThis.BroadcastChannel;
    this.originalBroadcastChannel = NativeBc;

    const WrappedBc = function (this: BroadcastChannel, channelName: string) {
      const instance = new NativeBc(channelName);
      self.registerChannel(channelName);
      return instance;
    } as any;

    WrappedBc.prototype = NativeBc.prototype;
    globalThis.BroadcastChannel = WrappedBc;
  }

  /**
   * Declaratively scan tool execution code definitions for BroadcastChannel names
   * and register them automatically.
   */
  public registerChannelsFromTools(
    tools: Array<{ execution?: { code?: string }; code?: string }>,
  ): void {
    if (!Array.isArray(tools)) return;

    const bcRegex = /new\s+BroadcastChannel\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    for (const tool of tools) {
      const code = tool.execution?.code || tool.code || "";
      if (!code) continue;

      let match: RegExpExecArray | null;
      bcRegex.lastIndex = 0;
      while ((match = bcRegex.exec(code)) !== null) {
        if (match[1]) {
          this.registerChannel(match[1]);
        }
      }
    }
  }

  /**
   * Register a channel name to forward parent messages to the sandboxed iframe.
   */
  public registerChannel(channelName: string): void {
    if (
      typeof BroadcastChannel === "undefined" ||
      !channelName ||
      channelName.endsWith("-results") ||
      this.commandChannels.has(channelName)
    ) {
      return;
    }
    this.listenOnCommandChannel(channelName);
  }

  private listenOnCommandChannel(channelName: string): void {
    try {
      const NativeBc =
        this.originalBroadcastChannel || globalThis.BroadcastChannel;
      const bc = new NativeBc(channelName);
      bc.onmessage = (evt) => {
        const target = this.getTargetWindow();
        if (target) {
          target.postMessage(
            {
              type: "shadow-claw-broadcast-command",
              channel: channelName,
              payload: evt.data,
            },
            "*",
          );
        }
      };
      this.commandChannels.set(channelName, bc);
    } catch (e) {
      console.warn(
        `[IframeBroadcastProxy] Failed to listen on channel ${channelName}:`,
        e,
      );
    }
  }

  /**
   * Handle incoming broadcast result/message from the sandboxed iframe and relay it
   * to the parent-origin BroadcastChannel.
   */
  public handleResultFromIframe(
    sourceWindow: WindowProxy,
    channelName: string,
    payload: unknown,
  ): boolean {
    const target = this.getTargetWindow();
    if (target && sourceWindow !== target) {
      return false;
    }

    if (channelName) {
      try {
        const NativeBc =
          this.originalBroadcastChannel || globalThis.BroadcastChannel;
        const resBc = new NativeBc(channelName);
        resBc.postMessage(payload);
        resBc.close();
        return true;
      } catch (e) {
        console.warn(
          `[IframeBroadcastProxy] Failed to relay result for channel ${channelName}:`,
          e,
        );
      }
    }
    return false;
  }

  public dispose(): void {
    for (const bc of this.commandChannels.values()) {
      try {
        bc.close();
      } catch (e) {}
    }
    this.commandChannels.clear();
  }
}
