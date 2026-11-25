export interface ToolAdapterToolMetadata {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  input_schema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface ToolAdapterBridgeOptions {
  lockName: string;
  commandsChannel: string;
  resultsChannel: string;
  stateChannel?: string;
  tools?: ToolAdapterToolMetadata[];
  dispatch: (name: string, params: Record<string, any>) => Promise<any> | any;
  getStateSnapshot?: () => unknown;
  shouldBroadcastInterval?: () => boolean;
  broadcastIntervalMs?: number;
  onLeaderChange?: (isLeader: boolean) => void;
}

export interface ToolAdapterBridge {
  init: () => Promise<void>;
  dispose: () => void;
  broadcastState: () => void;
  isLeader: () => boolean;
}

/**
 * Registers declarative tools with native Chrome/browser WebMCP (`document.modelContext`
 * or `navigator.modelContext`) when available.
 */
export async function registerNativeWebMcp(
  tools: ToolAdapterToolMetadata[] = [],
  dispatch: (name: string, params: Record<string, any>) => Promise<any> | any,
): Promise<void> {
  const modelContext =
    typeof document !== "undefined" && (document as any).modelContext
      ? (document as any).modelContext
      : typeof navigator !== "undefined" && (navigator as any).modelContext
        ? (navigator as any).modelContext
        : null;

  if (!modelContext || typeof modelContext.registerTool !== "function") {
    return;
  }

  for (const tool of tools || []) {
    try {
      const res = modelContext.registerTool({
        name: tool.name,
        title: tool.title || tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema ||
          tool.input_schema || { type: "object", properties: {} },
        annotations: tool.annotations || {
          readOnlyHint: false,
          consequentialHint: false,
        },
        execute: async (input: Record<string, any>) =>
          await dispatch(tool.name, input || {}),
      });

      if (res && typeof res.catch === "function") {
        await res.catch(() => {});
      }
    } catch {}
  }
}

/**
 * Creates a reusable Web Locks leader-elected BroadcastChannel RPC bridge and
 * native WebMCP registrar for tool adapters.
 */
export function createToolAdapterBridge(
  options: ToolAdapterBridgeOptions,
): ToolAdapterBridge {
  const {
    lockName,
    commandsChannel,
    resultsChannel,
    stateChannel,
    tools = [],
    dispatch,
    getStateSnapshot,
    shouldBroadcastInterval,
    broadcastIntervalMs = 100,
    onLeaderChange,
  } = options;

  let cmdChannel: BroadcastChannel | null = null;
  let resChannel: BroadcastChannel | null = null;
  let stChannel: BroadcastChannel | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let initialized = false;
  let leader = false;
  let releaseLock: (() => void) | null = null;

  const setLeader = (next: boolean) => {
    leader = next;
    if (typeof onLeaderChange === "function") {
      onLeaderChange(next);
    }
  };

  const broadcastState = () => {
    if (!stChannel || typeof getStateSnapshot !== "function") {
      return;
    }
    const payload = getStateSnapshot();
    if (payload !== undefined) {
      stChannel.postMessage(payload);
    }
  };

  const setupLeaderChannels = () => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    cmdChannel = new BroadcastChannel(commandsChannel);
    resChannel = new BroadcastChannel(resultsChannel);

    cmdChannel.addEventListener("message", async (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || !msg.requestId || !msg.type) {
        return;
      }

      resChannel?.postMessage({ requestId: msg.requestId, ack: true });

      try {
        const result = await dispatch(msg.type, msg.params || {});
        resChannel?.postMessage({ requestId: msg.requestId, result });
        broadcastState();
      } catch (err: any) {
        resChannel?.postMessage({
          requestId: msg.requestId,
          error: err?.message || String(err),
        });
      }
    });

    if (
      typeof getStateSnapshot === "function" &&
      typeof shouldBroadcastInterval === "function" &&
      broadcastIntervalMs > 0
    ) {
      intervalId = setInterval(() => {
        if (shouldBroadcastInterval()) {
          broadcastState();
        }
      }, broadcastIntervalMs);
    }
  };

  const init = async () => {
    if (initialized) {
      return;
    }
    initialized = true;

    if (stateChannel && typeof BroadcastChannel !== "undefined") {
      stChannel = new BroadcastChannel(stateChannel);
    }

    const locks =
      typeof navigator !== "undefined" ? (navigator as any).locks : undefined;

    if (locks && typeof locks.request === "function") {
      try {
        await new Promise<void>((resolveInit) => {
          let settled = false;
          const finish = () => {
            if (!settled) {
              settled = true;
              resolveInit();
            }
          };

          const lockPromise = locks.request(
            lockName,
            { ifAvailable: true },
            async (lock: any) => {
              if (!lock) {
                setLeader(false);
                finish();
                return;
              }

              setLeader(true);
              setupLeaderChannels();
              finish();

              return new Promise<void>((resolveHold) => {
                releaseLock = resolveHold;
              });
            },
          );

          if (lockPromise && typeof lockPromise.catch === "function") {
            lockPromise.catch(() => {
              setLeader(true);
              setupLeaderChannels();
              finish();
            });
          }
        });
      } catch {
        setLeader(true);
        setupLeaderChannels();
      }
    } else {
      setLeader(true);
      setupLeaderChannels();
    }

    if (tools.length > 0) {
      await registerNativeWebMcp(tools, dispatch);
    }
  };

  const dispose = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }

    if (cmdChannel) {
      try {
        cmdChannel.close();
      } catch {}
      cmdChannel = null;
    }

    if (resChannel) {
      try {
        resChannel.close();
      } catch {}
      resChannel = null;
    }

    if (stChannel) {
      try {
        stChannel.close();
      } catch {}
      stChannel = null;
    }

    if (releaseLock) {
      releaseLock();
      releaseLock = null;
    }

    leader = false;
    initialized = false;
  };

  return {
    init,
    dispose,
    broadcastState,
    isLeader: () => leader,
  };
}
