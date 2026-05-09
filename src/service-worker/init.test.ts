/// <reference lib="dom" />
import { jest } from "@jest/globals";

const listeners: Record<string, () => void | Promise<void>> = {};
const serviceWorkerListeners: Record<string, () => void | Promise<void>> = {};
const UPDATE_INTENT_KEY = "shadowclaw-sw-update-intent";
const UPDATE_FAILURE_KEY = "shadowclaw-sw-update-failure";

const mockMessageSkipWaiting = jest.fn();
const mockRegister = jest.fn();

jest.unstable_mockModule("workbox-window", () => ({
  Workbox: class {
    constructor(_scriptUrl: string) {}

    addEventListener(event: string, handler: () => void | Promise<void>) {
      listeners[event] = handler;
    }

    messageSkipWaiting = mockMessageSkipWaiting;
    register = mockRegister;
  },
}));

describe("service-worker init", () => {
  let setTimeoutSpy: jest.SpiedFunction<typeof globalThis.setTimeout>;
  let requestConfirmation: jest.Mock<any>;
  let querySpy: jest.SpiedFunction<typeof document.querySelector>;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(listeners)) {
      delete listeners[key];
    }

    for (const key of Object.keys(serviceWorkerListeners)) {
      delete serviceWorkerListeners[key];
    }

    setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");
    globalThis.sessionStorage.clear();

    Object.defineProperty(globalThis.navigator, "serviceWorker", {
      value: {
        addEventListener: jest.fn(
          (event: string, handler: () => void | Promise<void>) => {
            serviceWorkerListeners[event] = handler;
          },
        ),
      },
      configurable: true,
    });

    requestConfirmation = jest.fn(async () => true);
    querySpy = jest
      .spyOn(document, "querySelector")
      .mockImplementation((selector) => {
        if (selector === "shadow-claw") {
          return { requestConfirmation } as any;
        }

        return null;
      });
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    querySpy.mockRestore();
    jest.resetModules();
  });

  it("prompts via ShadowClaw confirmation and skips waiting when accepted", async () => {
    await import("./init.js");

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(listeners.waiting).toBeDefined();

    await listeners.waiting?.();

    expect(requestConfirmation).toHaveBeenCalledTimes(1);
    expect(mockMessageSkipWaiting).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(globalThis.sessionStorage.getItem(UPDATE_INTENT_KEY)).toBeTruthy();
  });

  it("does not skip waiting when confirmation is declined", async () => {
    requestConfirmation.mockResolvedValue(false);

    await import("./init.js");
    await listeners.waiting?.();

    expect(mockMessageSkipWaiting).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(globalThis.sessionStorage.getItem(UPDATE_INTENT_KEY)).toBeNull();
  });

  it("auto-applies a waiting update when an update intent already exists", async () => {
    globalThis.sessionStorage.setItem(
      UPDATE_INTENT_KEY,
      JSON.stringify({ startedAt: Date.now(), fallbackReloadAttempts: 0 }),
    );

    await import("./init.js");
    await listeners.waiting?.();

    expect(requestConfirmation).not.toHaveBeenCalled();
    expect(mockMessageSkipWaiting).toHaveBeenCalledTimes(1);
  });

  it("registers both controlling listeners for reliable reload", async () => {
    await import("./init.js");

    expect(listeners.controlling).toBeDefined();
    expect(serviceWorkerListeners.controllerchange).toBeDefined();
  });

  it("suppresses repeated update prompts after fallback reload attempts are exhausted", async () => {
    globalThis.sessionStorage.setItem(
      UPDATE_INTENT_KEY,
      JSON.stringify({ startedAt: Date.now(), fallbackReloadAttempts: 2 }),
    );

    await import("./init.js");

    await listeners.waiting?.();

    expect(mockMessageSkipWaiting).toHaveBeenCalledTimes(1);
    expect(globalThis.sessionStorage.getItem(UPDATE_INTENT_KEY)).toBeNull();
    expect(globalThis.sessionStorage.getItem(UPDATE_FAILURE_KEY)).toBeTruthy();

    mockMessageSkipWaiting.mockClear();
    requestConfirmation.mockClear();

    await listeners.waiting?.();

    expect(requestConfirmation).not.toHaveBeenCalled();
    expect(mockMessageSkipWaiting).not.toHaveBeenCalled();
  });

  it("notifies user when update fails after fallback attempts exhausted", async () => {
    globalThis.sessionStorage.setItem(
      UPDATE_INTENT_KEY,
      JSON.stringify({ startedAt: Date.now(), fallbackReloadAttempts: 2 }),
    );

    await import("./init.js");

    await listeners.waiting?.();

    expect(requestConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Update Failed",
      }),
    );

    const callArgs = requestConfirmation.mock.calls[0][0] as {
      message?: string;
    };
    expect(callArgs.message).toContain("restarting your browser");
  });

  it("clears failed-update cooldown when new service worker takes control", async () => {
    globalThis.sessionStorage.setItem(
      UPDATE_FAILURE_KEY,
      JSON.stringify({ failedAt: Date.now() }),
    );

    await import("./init.js");

    expect(globalThis.sessionStorage.getItem(UPDATE_FAILURE_KEY)).toBeTruthy();

    listeners.controlling?.();

    expect(globalThis.sessionStorage.getItem(UPDATE_FAILURE_KEY)).toBeNull();
  });
});
