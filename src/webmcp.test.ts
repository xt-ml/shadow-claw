import { jest } from "@jest/globals";

describe("webmcp integration", () => {
  let isWebMcpSupported;
  let registerWebMcpTools;
  let unregisterWebMcpTools;
  let mockExecuteTool;
  let mockOpenDatabase;
  let mockSetPostHandler;
  let mockRegisterTool;
  let mockUnregisterTool;

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
    mockRegisterTool = jest.fn(async () => undefined);
    mockUnregisterTool = jest.fn();

    Object.defineProperty((globalThis as any).navigator, "modelContext", {
      configurable: true,
      value: {
        registerTool: mockRegisterTool,
        unregisterTool: mockUnregisterTool,
      },
    });

    jest.unstable_mockModule("./db/openDatabase.js", () => ({
      openDatabase: mockOpenDatabase,
    }));

    jest.unstable_mockModule("./worker/executeTool.js", () => ({
      executeTool: mockExecuteTool,
    }));

    jest.unstable_mockModule("./worker/post.js", () => ({
      setPostHandler: mockSetPostHandler,
    }));

    const module = await import("./webmcp.js");
    isWebMcpSupported = module.isWebMcpSupported;
    registerWebMcpTools = module.registerWebMcpTools;
    unregisterWebMcpTools = module.unregisterWebMcpTools;
  });

  afterEach(() => {
    delete ((globalThis as any).navigator as any).modelContext;
  });

  it("feature-detects WebMCP support", () => {
    expect(isWebMcpSupported()).toBe(true);
  });

  it("returns false when WebMCP API is unavailable", async () => {
    delete ((globalThis as any).navigator as any).modelContext;
    expect(isWebMcpSupported()).toBe(false);

    const result = await registerWebMcpTools(null, jest.fn());
    expect(result).toBe(false);
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
      .map((args) => args[0])
      .find((registration) => registration.name === "list_tasks");

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

  it("does not duplicate registration on subsequent calls", async () => {
    await registerWebMcpTools(null, jest.fn(), "group-webmcp");
    const firstCount = mockRegisterTool.mock.calls.length;

    await registerWebMcpTools(null, jest.fn(), "group-webmcp");

    expect(mockRegisterTool.mock.calls.length).toBe(firstCount);
  });

  it("unregisters all previously registered tools", async () => {
    await registerWebMcpTools(null, jest.fn(), "group-webmcp");
    const registeredNames = new Set(
      mockRegisterTool.mock.calls.map((args) => args[0].name),
    );
    const abortSignals = mockRegisterTool.mock.calls.map(
      (args) => args[1].signal,
    );

    unregisterWebMcpTools();

    const unregisteredNames = new Set(
      mockUnregisterTool.mock.calls.map((args) => args[0]),
    );

    expect(unregisteredNames).toEqual(registeredNames);
    abortSignals.forEach((signal) => expect(signal.aborted).toBe(true));
  });

  it("unregisters successfully when unregisterTool API is absent", async () => {
    delete ((globalThis as any).navigator.modelContext as any).unregisterTool;

    await registerWebMcpTools(null, jest.fn(), "group-webmcp");
    const abortSignals = mockRegisterTool.mock.calls.map(
      (args) => args[1].signal,
    );

    unregisterWebMcpTools();

    abortSignals.forEach((signal) => expect(signal.aborted).toBe(true));
  });
});
