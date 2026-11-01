/// <reference lib="dom" />
import { jest } from "@jest/globals";

const listeners: Record<string, () => void | Promise<void>> = {};
const serviceWorkerListeners: Record<string, () => void | Promise<void>> = {};
const UPDATE_INTENT_KEY = "shadowclaw-sw-update-intent";
const UPDATE_FAILURE_KEY = "shadowclaw-sw-update-failure";

const mockMessageSkipWaiting = jest.fn();
const mockRegister = jest.fn();
const mockUpdate = jest.fn();
const workboxScriptUrls: unknown[] = [];
const workboxOptions: unknown[] = [];

jest.unstable_mockModule("workbox-window", () => ({
  Workbox: class {
    constructor(scriptUrl: string, options?: unknown) {
      workboxScriptUrls.push(scriptUrl);
      workboxOptions.push(options);
    }

    update = mockUpdate;

    addEventListener(event: string, handler: () => void | Promise<void>) {
      listeners[event] = handler;
    }

    messageSkipWaiting = mockMessageSkipWaiting;
    register = mockRegister;
  },
}));

describe("service-worker init", () => {
  let setTimeoutSpy: jest.SpiedFunction<typeof globalThis.setTimeout>;
  let requestDialog: jest.Mock<(...args: any[]) => Promise<any>>;
  let querySpy: jest.SpiedFunction<typeof document.querySelector>;

  beforeEach(() => {
    jest.clearAllMocks();
    workboxScriptUrls.length = 0;
    workboxOptions.length = 0;
    for (const key of Object.keys(listeners)) {
      delete listeners[key];
    }

    for (const key of Object.keys(serviceWorkerListeners)) {
      delete serviceWorkerListeners[key];
    }

    const originalSetTimeout = globalThis.setTimeout;
    setTimeoutSpy = jest
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((cb: any, ms: any) => {
        if (ms === 10_000 || ms === 1000) {
          cb();
          return 1 as any;
        }
        return originalSetTimeout(cb, ms);
      });

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

  it("registers with updateViaCache none so imported scripts are revalidated", async () => {
    await import("./init.js");

    expect(workboxOptions[0]).toEqual(
      expect.objectContaining({ updateViaCache: "none" }),
    );
  });

  describe("update checks and re-prompting", () => {
    const INTERVAL_MS = 5000;
    const MIN_GAP_MS = 30_000;
    const REPROMPT_MS = 60_000;
    let setIntervalSpy: jest.SpiedFunction<typeof globalThis.setInterval>;
    let intervalCallbacks: Array<() => void | Promise<void>>;
    let eventHandlers: Record<string, () => void | Promise<void>>;
    let addEventListenerSpy: jest.SpiedFunction<
      typeof globalThis.addEventListener
    >;
    let docAddEventListenerSpy: jest.SpiedFunction<
      typeof document.addEventListener
    >;

    async function importInit(
      overrides: Record<string, unknown> = {},
    ): Promise<typeof import("./init.js")> {
      jest.resetModules();
      jest.unstable_mockModule("./update-config.js", () => ({
        SW_UPDATE_CHECK_INTERVAL_MS: INTERVAL_MS,
        SW_UPDATE_CHECK_ON_FOCUS: true,
        SW_UPDATE_CHECK_MIN_GAP_MS: MIN_GAP_MS,
        SW_UPDATE_REPROMPT_INTERVAL_MS: REPROMPT_MS,
        ...overrides,
      }));

      return import("./init.js");
    }

    beforeEach(() => {
      intervalCallbacks = [];
      eventHandlers = {};
      setIntervalSpy = jest
        .spyOn(globalThis, "setInterval")
        .mockImplementation((cb: any) => {
          intervalCallbacks.push(cb);

          return 1 as any;
        });
      addEventListenerSpy = jest
        .spyOn(globalThis, "addEventListener")
        .mockImplementation((event: string, handler: any) => {
          eventHandlers[`window:${event}`] = handler;
        });
      docAddEventListenerSpy = jest
        .spyOn(document, "addEventListener")
        .mockImplementation((event: string, handler: any) => {
          eventHandlers[`document:${event}`] = handler;
        });
    });

    afterEach(() => {
      setIntervalSpy.mockRestore();
      addEventListenerSpy.mockRestore();
      docAddEventListenerSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it("checks for updates on the configured interval", async () => {
      await importInit();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        INTERVAL_MS,
      );

      await intervalCallbacks[0]?.();

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("does not schedule periodic checks when the interval is 0", async () => {
      await importInit({ SW_UPDATE_CHECK_INTERVAL_MS: 0 });

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it("checks for updates when the window regains focus", async () => {
      await importInit();

      await eventHandlers["window:focus"]?.();

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("checks for updates when the document becomes visible", async () => {
      await importInit();
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });

      await eventHandlers["document:visibilitychange"]?.();

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("throttles focus-triggered checks to the minimum gap", async () => {
      await importInit();

      await eventHandlers["window:focus"]?.();
      await eventHandlers["window:focus"]?.();

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("does not listen for focus when on-focus checks are disabled", async () => {
      await importInit({ SW_UPDATE_CHECK_ON_FOCUS: false });

      expect(eventHandlers["window:focus"]).toBeUndefined();
      expect(eventHandlers["document:visibilitychange"]).toBeUndefined();
    });

    it("re-prompts after Later once the re-prompt interval has elapsed", async () => {
      requestDialog.mockResolvedValue(false);
      const now = jest.spyOn(Date, "now");
      now.mockReturnValue(1_000_000);
      await importInit();

      await listeners.waiting?.();
      expect(requestDialog).toHaveBeenCalledTimes(1);

      now.mockReturnValue(1_000_000 + REPROMPT_MS - 1);
      await intervalCallbacks[0]?.();
      expect(requestDialog).toHaveBeenCalledTimes(1);

      now.mockReturnValue(1_000_000 + REPROMPT_MS + 1);
      await intervalCallbacks[0]?.();
      expect(requestDialog).toHaveBeenCalledTimes(2);
    });

    it("retries on the next check when the UI bridge was not ready", async () => {
      let tick = 0;
      const now = jest
        .spyOn(Date, "now")
        .mockImplementation(() => (tick += 2000));
      querySpy.mockImplementation(() => null);
      await importInit();

      await listeners.waiting?.();
      expect(requestDialog).not.toHaveBeenCalled();
      expect(mockMessageSkipWaiting).not.toHaveBeenCalled();

      now.mockRestore();
      querySpy.mockImplementation((selector) =>
        selector === "shadow-claw" ? ({ requestDialog } as any) : null,
      );
      await intervalCallbacks[0]?.();

      expect(requestDialog).toHaveBeenCalledTimes(1);
    });

    it("does not re-prompt when no update is waiting", async () => {
      await importInit();

      await intervalCallbacks[0]?.();

      expect(requestDialog).not.toHaveBeenCalled();
    });

    it("asks to reload when another tab activated a new service worker", async () => {
      Object.defineProperty(globalThis.navigator, "serviceWorker", {
        value: {
          controller: {},
          addEventListener: jest.fn((event: string, handler: any) => {
            serviceWorkerListeners[event] = handler;
          }),
        },
        configurable: true,
      });
      await importInit();

      await serviceWorkerListeners.controllerchange?.();

      expect(requestDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Update Installed" }),
      );
    });

    it("does not ask to reload on first install takeover", async () => {
      await importInit();

      await serviceWorkerListeners.controllerchange?.();

      expect(requestDialog).not.toHaveBeenCalled();
    });
  });

  describe("Origin-Agent-Cluster reload compatibility", () => {
    afterEach(() => {
      delete (globalThis as any).originAgentCluster;
    });

    it("does not reload when originAgentCluster is already true", async () => {
      Object.defineProperty(globalThis, "originAgentCluster", {
        configurable: true,
        value: true,
      });

      await import("./init.js");
      serviceWorkerListeners.controllerchange?.();

      expect(
        globalThis.sessionStorage.getItem("shadowclaw-oac-reload-attempted"),
      ).toBeNull();
    });

    it("reloads once when originAgentCluster is false on http(s)", async () => {
      Object.defineProperty(globalThis, "originAgentCluster", {
        configurable: true,
        value: false,
      });

      const mod = await import("./init.js");
      expect(mod.shouldReloadForOriginAgentCluster()).toBe(true);

      serviceWorkerListeners.controllerchange?.();

      expect(
        globalThis.sessionStorage.getItem("shadowclaw-oac-reload-attempted"),
      ).toBe("1");
      expect(mod.shouldReloadForOriginAgentCluster()).toBe(false);
    });

    it("does not attempt a second reload once the guard is persisted", async () => {
      globalThis.sessionStorage.setItem("shadowclaw-oac-reload-attempted", "1");
      Object.defineProperty(globalThis, "originAgentCluster", {
        configurable: true,
        value: false,
      });

      const mod = await import("./init.js");

      expect(mod.shouldReloadForOriginAgentCluster()).toBe(false);
    });
  });
});
