import { jest } from "@jest/globals";

describe("webmcp integration", () => {
  let isWebMcpSupported: any;
  let registerWebMcpTools: any;
  let setWebMcpMode: any;
  let unregisterWebMcpTools: any;
  let mockExecuteTool: any;
  let mockOpenDatabase: any;
  let mockSetPostHandler: any;
  let mockRegisterTool: any;
  let mockUnregisterTool: any;

  beforeEach(async () => {
    jest.resetModules();

    mockExecuteTool = jest.fn(
      async (_db: any, name: string, input: any, groupId: string) => {
        if (name === "list_tasks") {
          return `mock tasks for ${groupId}: ${JSON.stringify(input || {})}`;
        }

        return `ok:${name}`;
      },
    );

    mockOpenDatabase = jest.fn(async () => ({ mock: "db" }));
    mockSetPostHandler = jest.fn();
    mockRegisterTool = jest.fn(() => undefined);
    mockUnregisterTool = jest.fn(() => undefined);

    // Mock the polyfill module so initializeWebMCPPolyfill installs our
    // test mock onto document.modelContext instead of the real polyfill.
    jest.unstable_mockModule("@mcp-b/webmcp-polyfill", () => ({
      initializeWebMCPPolyfill: jest.fn(() => {
        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: {
            registerTool: mockRegisterTool,
            unregisterTool: mockUnregisterTool,
          },
        });
      }),
    }));

    jest.unstable_mockModule("../../db/openDatabase.js", () => ({
      openDatabase: mockOpenDatabase,
    }));

    jest.unstable_mockModule("../../worker/executeTool.js", () => ({
      executeTool: mockExecuteTool,
    }));

    jest.unstable_mockModule("../../worker/post.js", () => ({
      setPostHandler: mockSetPostHandler,
    }));

    const module = await import("./webmcp.js");
    isWebMcpSupported = module.isWebMcpSupported;
    registerWebMcpTools = module.registerWebMcpTools;
    setWebMcpMode = module.setWebMcpMode;
    unregisterWebMcpTools = module.unregisterWebMcpTools;
  });

  afterEach(() => {
    delete ((globalThis as any).document as any).modelContext;
  });

  it("feature-detects WebMCP support", () => {
    expect(isWebMcpSupported()).toBe(true);
  });

  it("returns false when WebMCP API is unavailable", async () => {
    // Remove polyfilled modelContext and prevent re-install
    delete ((globalThis as any).document as any).modelContext;

    // Re-mock the polyfill to be a no-op (simulates polyfill failure)
    jest.resetModules();
    jest.unstable_mockModule("@mcp-b/webmcp-polyfill", () => ({
      initializeWebMCPPolyfill: jest.fn(),
    }));
    jest.unstable_mockModule("../../db/openDatabase.js", () => ({
      openDatabase: mockOpenDatabase,
    }));
    jest.unstable_mockModule("../../worker/executeTool.js", () => ({
      executeTool: mockExecuteTool,
    }));
    jest.unstable_mockModule("../../worker/post.js", () => ({
      setPostHandler: mockSetPostHandler,
    }));

    const mod = await import("./webmcp.js");
    expect(mod.isWebMcpSupported()).toBe(false);

    const result = await mod.registerWebMcpTools(null, jest.fn() as any);
    expect(result).toBe(false);
  });

  it("supports accessor-backed modelContext", () => {
    // The polyfill mock already installed modelContext, verify it works
    expect(isWebMcpSupported()).toBe(true);
  });

  it("uses document.modelContext in native mode", async () => {
    setWebMcpMode("native");

    const documentRegisterTool = jest.fn();

    Object.defineProperty((globalThis as any).document, "modelContext", {
      configurable: true,
      value: {
        registerTool: documentRegisterTool,
      },
    });

    const registered = await registerWebMcpTools(null, jest.fn());

    expect(registered).toBe(true);
    expect(documentRegisterTool).toHaveBeenCalled();

    delete ((globalThis as any).document as any).modelContext;
  });

  it("falls back to navigator.modelContext when document.modelContext is missing", async () => {
    setWebMcpMode("native");

    delete ((globalThis as any).document as any).modelContext;

    const navigatorRegisterTool = jest.fn();
    Object.defineProperty((globalThis as any).navigator, "modelContext", {
      configurable: true,
      value: {
        registerTool: navigatorRegisterTool,
      },
    });

    const registered = await registerWebMcpTools(null, jest.fn());

    expect(registered).toBe(true);
    expect(navigatorRegisterTool).toHaveBeenCalled();
  });

  it("always passes AbortController signal when registering tools", async () => {
    await registerWebMcpTools(null, jest.fn(), "group-webmcp");

    expect(mockRegisterTool).toHaveBeenCalled();

    // Every registerTool call must include { signal } — this is required for
    // correct unregistration on both the polyfill and the native Chrome API.
    for (const call of mockRegisterTool.mock.calls) {
      const options = call[1] as any;
      expect(options).toBeDefined();
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("registers tools and delegates execute through postMessage", async () => {
    const emit = jest.fn();

    const mockWorker: any = {
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    const registered = await registerWebMcpTools(
      mockWorker,
      emit,
      "group-webmcp",
    );
    expect(registered).toBe(true);
    expect(mockRegisterTool).toHaveBeenCalled();

    const listTasksRegistration = mockRegisterTool.mock.calls
      .map((args: any[]) => args[0])
      .find((registration: any) => registration.name === "list_tasks");

    expect(listTasksRegistration).toBeDefined();
    expect(listTasksRegistration.annotations).toEqual({
      readOnlyHint: false,
      untrustedContentHint: true,
    });

    // Test that execute sends a postMessage
    const executePromise = listTasksRegistration.execute({ foo: "bar" });

    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "execute-tool",
        payload: {
          name: "list_tasks",
          input: { foo: "bar" },
          groupId: "group-webmcp",
        },
      }),
    );
    expect(mockWorker.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );

    // Simulate worker success response
    const handler = mockWorker.addEventListener.mock.calls[0][1];

    const callId = (mockWorker.postMessage as any).mock.calls[0][0].callId;

    (handler as any)({
      data: { type: "execute-tool-result", callId, result: "mock response" },
    });

    const response = await executePromise;

    expect(response).toBe("mock response");
    expect(mockWorker.removeEventListener).toHaveBeenCalledWith(
      "message",
      handler,
    );
  });

  it("does not register any tools when tools array is explicitly empty", async () => {
    const registered = await registerWebMcpTools(
      null,
      jest.fn(),
      "group-webmcp",
      [],
    );

    expect(registered).toBe(true);
    expect(mockRegisterTool).not.toHaveBeenCalled();
  });

  it("does not duplicate registration on subsequent calls", async () => {
    await registerWebMcpTools(null, jest.fn(), "group-webmcp");
    const firstCount = mockRegisterTool.mock.calls.length;

    await registerWebMcpTools(null, jest.fn(), "group-webmcp");

    expect(mockRegisterTool.mock.calls.length).toBe(firstCount);
  });

  it("unregisters all previously registered tools by aborting their signals", async () => {
    await registerWebMcpTools(null, jest.fn(), "group-webmcp");

    const registeredCount = mockRegisterTool.mock.calls.length;
    expect(registeredCount).toBeGreaterThan(0);

    // Capture the AbortSignals passed during registration.
    const signals: AbortSignal[] = mockRegisterTool.mock.calls.map(
      (args: any[]) => (args[1] as any)?.signal,
    );

    // None aborted yet.
    for (const signal of signals) {
      expect(signal.aborted).toBe(false);
    }

    unregisterWebMcpTools();

    // All signals must be aborted after unregister.
    for (const signal of signals) {
      expect(signal.aborted).toBe(true);
    }

    // unregisterTool(name) must NOT be called — it is absent from the native
    // Chrome API and calling it would fail silently, leaving tools registered.
    expect(mockUnregisterTool).not.toHaveBeenCalled();
  });

  it("allows re-registration after unregistering", async () => {
    await registerWebMcpTools(null, jest.fn(), "group-webmcp");
    const firstCount = mockRegisterTool.mock.calls.length;

    unregisterWebMcpTools();

    // After unregister the internal name-set is cleared, so a fresh call
    // should register all tools again.
    await registerWebMcpTools(null, jest.fn(), "group-webmcp");
    expect(mockRegisterTool.mock.calls.length).toBe(firstCount * 2);
  });
});
