/// <reference lib="dom" />
import { jest } from "@jest/globals";

const listeners: Record<string, () => void | Promise<void>> = {};
const serviceWorkerListeners: Record<string, () => void | Promise<void>> = {};
const UPDATE_INTENT_KEY = "shadowclaw-sw-update-intent";
const UPDATE_FAILURE_KEY = "shadowclaw-sw-update-failure";

const mockMessageSkipWaiting = jest.fn();
const mockRegister = jest.fn();
const workboxScriptUrls: unknown[] = [];

jest.unstable_mockModule("workbox-window", () => ({
  Workbox: class {
    constructor(scriptUrl: string) {
      workboxScriptUrls.push(scriptUrl);
    }

    addEventListener(event: string, handler: () => void | Promise<void>) {
      listeners[event] = handler;
    }

    messageSkipWaiting = mockMessageSkipWaiting;
    register = mockRegister;
  },
}));

describe("service-worker init", () => {
  let setTimeoutSpy: jest.SpiedFunction<typeof globalThis.setTimeout>;
  let requestDialog: jest.Mock<any>;
  let querySpy: jest.SpiedFunction<typeof document.querySelector>;

  beforeEach(() => {
    jest.clearAllMocks();
    workboxScriptUrls.length = 0;
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

    requestDialog = jest.fn(async () => true);
    querySpy = jest
      .spyOn(document, "querySelector")
      .mockImplementation((selector) => {
        if (selector === "shadow-claw") {
          return { requestDialog } as any;
        }

        return null;
      });
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    querySpy.mockRestore();
    jest.resetModules();

    delete (globalThis as typeof globalThis & { trustedTypes?: unknown })
      .trustedTypes;
  });

  it("registers service worker with TrustedScriptURL when getPolicy is unavailable", async () => {
    const trustedScriptUrl = {
      toString: () => "trusted:service-worker.js",
    };
    const createPolicy = jest.fn(() => ({
      createHTML: (input: string) => input,
      createScriptURL: () => trustedScriptUrl,
    }));

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy,
      },
    });

    await import("./init.js");

    expect(createPolicy).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        createHTML: expect.any(Function),
        createScriptURL: expect.any(Function),
      }),
    );
    expect(workboxScriptUrls[0]).toBe(trustedScriptUrl);
  });

  it("prompts via ShadowClaw confirmation and skips waiting when accepted", async () => {
    await import("./init.js");

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(listeners.waiting).toBeDefined();

    await listeners.waiting?.();

    expect(requestDialog).toHaveBeenCalledTimes(1);
    expect(mockMessageSkipWaiting).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(globalThis.sessionStorage.getItem(UPDATE_INTENT_KEY)).toBeTruthy();
  });

  it("does not skip waiting when confirmation is declined", async () => {
    requestDialog.mockResolvedValue(false);

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

    expect(requestDialog).not.toHaveBeenCalled();
    expect(mockMessageSkipWaiting).toHaveBeenCalledTimes(1);
  });

  it("registers both controlling listeners for reliable reload", async () => {
    await import("./init.js");

    expect(listeners.controlling).toBeDefined();
    expect(serviceWorkerListeners.controllerchange).toBeDefined();
  });

  it("does not request a reload when no update intent exists", async () => {
    const mod = await import("./init.js");

    expect(mod.shouldReloadAfterControllerChange()).toBe(false);
  });

  it("requests a reload only when a fresh update intent exists", async () => {
    globalThis.sessionStorage.setItem(
      UPDATE_INTENT_KEY,
      JSON.stringify({ startedAt: Date.now(), fallbackReloadAttempts: 0 }),
    );
    const mod = await import("./init.js");

    expect(mod.shouldReloadAfterControllerChange()).toBe(true);
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
    requestDialog.mockClear();

    await listeners.waiting?.();

    expect(requestDialog).not.toHaveBeenCalled();
    expect(mockMessageSkipWaiting).not.toHaveBeenCalled();
  });

  it("notifies user when update fails after fallback attempts exhausted", async () => {
    globalThis.sessionStorage.setItem(
      UPDATE_INTENT_KEY,
      JSON.stringify({ startedAt: Date.now(), fallbackReloadAttempts: 2 }),
    );

    await import("./init.js");

    await listeners.waiting?.();

    expect(requestDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Update Failed",
      }),
    );

    const callArgs = requestDialog.mock.calls[0][0] as {
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
