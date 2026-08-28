import { jest } from "@jest/globals";
import { IframeBroadcastProxy } from "./iframe-broadcast-proxy.js";

describe("IframeBroadcastProxy (Agnostic Dynamic Proxy)", () => {
  let mockWindow: { postMessage: jest.Mock };
  let originalBroadcastChannel: typeof BroadcastChannel;
  let createdChannels: Map<
    string,
    { onmessage?: (evt: any) => void; postMessage: jest.Mock; close: jest.Mock }
  >;

  beforeEach(() => {
    mockWindow = { postMessage: jest.fn() };
    createdChannels = new Map();
    (globalThis as any)._shadowClawParentBcPatched = false;

    originalBroadcastChannel = globalThis.BroadcastChannel;

    (globalThis as any).BroadcastChannel = jest
      .fn()
      .mockImplementation((...args: any[]) => {
        const channelName = String(args[0] || "");
        const channel = {
          name: channelName,
          onmessage: undefined as ((evt: any) => void) | undefined,
          postMessage: jest.fn(),
          close: jest.fn(),
        };
        createdChannels.set(channelName, channel);
        return channel;
      });
  });

  afterEach(() => {
    if (originalBroadcastChannel) {
      globalThis.BroadcastChannel = originalBroadcastChannel;
    } else {
      delete (globalThis as any).BroadcastChannel;
    }
    delete (globalThis as any)._shadowClawParentBcPatched;
  });

  test("dynamically registers any custom channel name and forwards messages to target iframe", () => {
    const proxy = new IframeBroadcastProxy(() => mockWindow as any);

    // Register an arbitrary custom channel name dynamically
    proxy.registerChannel("custom-app-channel-xyz");

    expect(createdChannels.has("custom-app-channel-xyz")).toBe(true);

    const channel = createdChannels.get("custom-app-channel-xyz")!;
    channel.onmessage?.({ data: { action: "doSomething", id: 42 } });

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      {
        type: "shadow-claw-broadcast-command",
        channel: "custom-app-channel-xyz",
        payload: { action: "doSomething", id: 42 },
      },
      "*",
    );

    proxy.dispose();
    expect(channel.close).toHaveBeenCalled();
  });

  test("declaratively extracts BroadcastChannel names from tool definitions", () => {
    const proxy = new IframeBroadcastProxy(() => mockWindow as any);

    proxy.registerChannelsFromTools([
      {
        execution: {
          code: "const cmd = new BroadcastChannel('dynamic-tool-channel-1'); cmd.postMessage({});",
        },
      },
      {
        code: 'const res = new BroadcastChannel("dynamic-tool-channel-2");',
      },
    ]);

    expect(createdChannels.has("dynamic-tool-channel-1")).toBe(true);
    expect(createdChannels.has("dynamic-tool-channel-2")).toBe(true);

    proxy.dispose();
  });

  test("automatically intercepts BroadcastChannel creation on parent and registers channel", () => {
    const proxy = new IframeBroadcastProxy(() => mockWindow as any);

    // Any code on parent instantiates a new BroadcastChannel with an unknown name
    new BroadcastChannel("spontaneous-dynamic-channel");

    expect(createdChannels.has("spontaneous-dynamic-channel")).toBe(true);

    proxy.dispose();
  });

  test("relays results from target iframe back to parent BroadcastChannel for any channel name", () => {
    const proxy = new IframeBroadcastProxy(() => mockWindow as any);

    const handled = proxy.handleResultFromIframe(
      mockWindow as any,
      "arbitrary-result-channel",
      { id: 99, status: "completed" },
    );

    expect(handled).toBe(true);
    const resChannel = createdChannels.get("arbitrary-result-channel")!;
    expect(resChannel.postMessage).toHaveBeenCalledWith({
      id: 99,
      status: "completed",
    });
    expect(resChannel.close).toHaveBeenCalled();

    proxy.dispose();
  });
});
