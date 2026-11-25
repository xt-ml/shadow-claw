import { jest } from "@jest/globals";
import {
  registerNativeWebMcp,
  createToolAdapterBridge,
} from "./tool-adapter-bridge.js";

describe("tool-adapter-bridge", () => {
  let originalBroadcastChannel: typeof BroadcastChannel;
  let originalLocks: any;
  let originalDocModelContext: any;
  let originalNavModelContext: any;
  let channels: Map<
    string,
    {
      name: string;
      listeners: Map<string, Array<(evt: any) => void>>;
      addEventListener: jest.Mock;
      postMessage: jest.Mock;
      close: jest.Mock;
      emitMessage: (data: any) => Promise<void>;
    }
  >;

  beforeEach(() => {
    channels = new Map();
    originalBroadcastChannel = globalThis.BroadcastChannel;
    originalLocks = (navigator as any).locks;
    originalDocModelContext = (document as any).modelContext;
    originalNavModelContext = (navigator as any).modelContext;

    (globalThis as any).BroadcastChannel = jest
      .fn()
      .mockImplementation((...args: any[]) => {
        const name = String(args[0] || "");
        const listeners = new Map<string, Array<(evt: any) => void>>();
        const instance = {
          name,
          listeners,
          addEventListener: jest.fn((type: string, cb: (evt: any) => void) => {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type)!.push(cb);
          }),
          postMessage: jest.fn(),
          close: jest.fn(),
          async emitMessage(data: any) {
            const cbs = listeners.get("message") || [];
            for (const cb of cbs) {
              await cb({ data });
            }
          },
        };
        channels.set(name, instance);
        return instance;
      });
  });

  afterEach(() => {
    if (originalBroadcastChannel) {
      globalThis.BroadcastChannel = originalBroadcastChannel;
    } else {
      delete (globalThis as any).BroadcastChannel;
    }
    Object.defineProperty(navigator, "locks", {
      value: originalLocks,
      configurable: true,
    });
    Object.defineProperty(document, "modelContext", {
      value: originalDocModelContext,
      configurable: true,
    });
    Object.defineProperty(navigator, "modelContext", {
      value: originalNavModelContext,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  it("registerNativeWebMcp registers tools on document.modelContext (and falls back to navigator.modelContext)", async () => {
    const registered: any[] = [];
    Object.defineProperty(document, "modelContext", {
      value: {
        registerTool: jest.fn((def: any) => {
          registered.push(def);
          return Promise.resolve();
        }),
      },
      configurable: true,
    });

    const dispatch = jest.fn(async (name: string, params: any) => ({
      name,
      params,
    }));

    await registerNativeWebMcp(
      [
        {
          name: "tool_a",
          description: "Tool A",
          input_schema: {
            type: "object",
            properties: { x: { type: "number" } },
          },
        },
        {
          name: "tool_b",
          title: "Tool B",
          description: "Tool B desc",
          inputSchema: { type: "object", properties: {} },
          annotations: { readOnlyHint: true, consequentialHint: false },
        },
      ],
      dispatch,
    );

    expect(registered).toHaveLength(2);
    expect(registered[0].title).toBe("tool_a");
    expect(registered[0].inputSchema).toEqual({
      type: "object",
      properties: { x: { type: "number" } },
    });
    expect(await registered[0].execute({ x: 42 })).toEqual({
      name: "tool_a",
      params: { x: 42 },
    });

    // Navigator fallback + rejected promise resilience
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "modelContext", {
      value: {
        registerTool: jest.fn(() => Promise.reject(new Error("SecurityError"))),
      },
      configurable: true,
    });
    await expect(
      registerNativeWebMcp([{ name: "tool_c", description: "C" }], dispatch),
    ).resolves.toBeUndefined();
  });

  it("elects leader via navigator.locks, handles RPC ack/result/error, broadcasts state, and disposes cleanly", async () => {
    let lockCb: ((lock: any) => Promise<void>) | null = null;
    Object.defineProperty(navigator, "locks", {
      value: {
        request: jest.fn((_name: string, _opts: any, cb: any) => {
          lockCb = cb;
          return cb({ name: "my-lock" });
        }),
      },
      configurable: true,
    });

    const leaderChanges: boolean[] = [];
    const dispatch = jest.fn(async (type: string, params: any) => {
      if (type === "fail") throw new Error("Boom");
      return { ok: true, type, params };
    });

    const bridge = createToolAdapterBridge({
      lockName: "demo-lock",
      commandsChannel: "demo-commands",
      resultsChannel: "demo-results",
      stateChannel: "demo-state",
      tools: [{ name: "ping", description: "Ping" }],
      dispatch,
      getStateSnapshot: () => ({ type: "snapshot", count: 1 }),
      onLeaderChange: (isL) => leaderChanges.push(isL),
    });

    await bridge.init();
    // Idempotent second init
    await bridge.init();
    expect(lockCb).not.toBeNull();
    expect(bridge.isLeader()).toBe(true);
    expect(leaderChanges).toEqual([true]);

    const cmdChan = channels.get("demo-commands")!;
    const resChan = channels.get("demo-results")!;
    const stateChan = channels.get("demo-state")!;

    // Malformed messages ignored
    await cmdChan.emitMessage({ type: "ping" });
    await cmdChan.emitMessage({ requestId: "r0" });
    expect(resChan.postMessage).not.toHaveBeenCalled();

    // Successful command: ACK, result, state snapshot
    await cmdChan.emitMessage({
      requestId: "r1",
      type: "ping",
      params: { a: 1 },
    });
    expect(resChan.postMessage).toHaveBeenNthCalledWith(1, {
      requestId: "r1",
      ack: true,
    });
    expect(resChan.postMessage).toHaveBeenNthCalledWith(2, {
      requestId: "r1",
      result: { ok: true, type: "ping", params: { a: 1 } },
    });
    expect(stateChan.postMessage).toHaveBeenCalledWith({
      type: "snapshot",
      count: 1,
    });

    // Failing command: ACK then error
    await cmdChan.emitMessage({ requestId: "r2", type: "fail" });
    expect(resChan.postMessage).toHaveBeenLastCalledWith({
      requestId: "r2",
      error: "Boom",
    });

    bridge.dispose();
    expect(cmdChan.close).toHaveBeenCalled();
    expect(resChan.close).toHaveBeenCalled();
    expect(stateChan.close).toHaveBeenCalled();
    expect(bridge.isLeader()).toBe(false);
  });

  it("operates in follower mode when Web Lock is held by another tab, and standalone when navigator.locks is absent", async () => {
    Object.defineProperty(navigator, "locks", {
      value: {
        request: jest.fn((_name: string, _opts: any, cb: any) => cb(null)),
      },
      configurable: true,
    });

    const followerChanges: boolean[] = [];
    const followerBridge = createToolAdapterBridge({
      lockName: "demo-lock",
      commandsChannel: "demo-commands",
      resultsChannel: "demo-results",
      dispatch: async () => ({}),
      onLeaderChange: (isL) => followerChanges.push(isL),
    });

    await followerBridge.init();
    expect(followerBridge.isLeader()).toBe(false);
    expect(followerChanges).toEqual([false]);
    expect(channels.has("demo-commands")).toBe(false);
    followerBridge.dispose();

    // Without navigator.locks -> standalone leader
    Object.defineProperty(navigator, "locks", {
      value: undefined,
      configurable: true,
    });
    const standaloneBridge = createToolAdapterBridge({
      lockName: "demo-lock",
      commandsChannel: "standalone-commands",
      resultsChannel: "standalone-results",
      dispatch: async () => ({}),
    });
    await standaloneBridge.init();
    expect(standaloneBridge.isLeader()).toBe(true);
    expect(channels.has("standalone-commands")).toBe(true);
    standaloneBridge.dispose();
  });
});
