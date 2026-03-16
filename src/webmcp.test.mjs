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

    mockExecuteTool = jest.fn(async (_db, name, input, groupId) => {
      if (name === "list_tasks") {
        return `mock tasks for ${groupId}: ${JSON.stringify(input || {})}`;
      }

      return `ok:${name}`;
    });

    mockOpenDatabase = jest.fn(async () => ({ mock: "db" }));
    mockSetPostHandler = jest.fn();
    mockRegisterTool = jest.fn(async () => undefined);
    mockUnregisterTool = jest.fn();

    Object.defineProperty(globalThis.navigator, "modelContext", {
      configurable: true,
      value: {
        registerTool: mockRegisterTool,
        unregisterTool: mockUnregisterTool,
      },
    });

    jest.unstable_mockModule("./db/openDatabase.mjs", () => ({
      openDatabase: mockOpenDatabase,
    }));

    jest.unstable_mockModule("./worker/executeTool.mjs", () => ({
      executeTool: mockExecuteTool,
    }));

    jest.unstable_mockModule("./worker/post.mjs", () => ({
      setPostHandler: mockSetPostHandler,
    }));

    const module = await import("./webmcp.mjs");
    isWebMcpSupported = module.isWebMcpSupported;
    registerWebMcpTools = module.registerWebMcpTools;
    unregisterWebMcpTools = module.unregisterWebMcpTools;
  });

  afterEach(() => {
    delete globalThis.navigator.modelContext;
  });

  it("feature-detects WebMCP support", () => {
    expect(isWebMcpSupported()).toBe(true);
  });

  it("returns false when WebMCP API is unavailable", async () => {
    delete globalThis.navigator.modelContext;
    expect(isWebMcpSupported()).toBe(false);

    const result = await registerWebMcpTools(jest.fn());
    expect(result).toBe(false);
  });

  it("registers tools and delegates execute through executeTool", async () => {
    const emit = jest.fn();

    const registered = await registerWebMcpTools(emit, "group-webmcp");
    expect(registered).toBe(true);
    expect(mockOpenDatabase).toHaveBeenCalledTimes(1);
    expect(mockRegisterTool).toHaveBeenCalled();

    const listTasksRegistration = mockRegisterTool.mock.calls
      .map((args) => args[0])
      .find((registration) => registration.name === "list_tasks");

    expect(listTasksRegistration).toBeDefined();
    const response = await listTasksRegistration.execute({});

    expect(response).toContain("mock tasks for group-webmcp");
    expect(mockExecuteTool).toHaveBeenCalledWith(
      { mock: "db" },
      "list_tasks",
      {},
      "group-webmcp",
    );

    expect(mockSetPostHandler).toHaveBeenNthCalledWith(1, expect.any(Function));
    expect(mockSetPostHandler).toHaveBeenLastCalledWith(null);
  });

  it("does not duplicate registration on subsequent calls", async () => {
    await registerWebMcpTools(jest.fn(), "group-webmcp");
    const firstCount = mockRegisterTool.mock.calls.length;

    await registerWebMcpTools(jest.fn(), "group-webmcp");

    expect(mockRegisterTool.mock.calls.length).toBe(firstCount);
  });

  it("unregisters all previously registered tools", async () => {
    await registerWebMcpTools(jest.fn(), "group-webmcp");
    const registeredNames = new Set(
      mockRegisterTool.mock.calls.map((args) => args[0].name),
    );

    unregisterWebMcpTools();

    const unregisteredNames = new Set(
      mockUnregisterTool.mock.calls.map((args) => args[0]),
    );

    expect(unregisteredNames).toEqual(registeredNames);
  });
});
