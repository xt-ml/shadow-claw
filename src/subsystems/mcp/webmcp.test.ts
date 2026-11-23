import { jest } from "@jest/globals";

describe("webmcp integration", () => {
  let isWebMcpSupported: any;
  let registerWebMcpTools: any;
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

    // Mock the polyfill module so installWebMCP installs our
    // test mock onto document.modelContext instead of the real polyfill.
    const installMock = jest.fn(() => {
      if (!(globalThis as any).document?.modelContext) {
        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: {
            registerTool: mockRegisterTool,
            unregisterTool: mockUnregisterTool,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
          },
        });
      }
    });

    jest.unstable_mockModule("@w3c/webmcp-polyfill", () => ({
      installWebMCP: installMock,
    }));

    jest.unstable_mockModule("../../db/open-database.js", () => ({
      openDatabase: mockOpenDatabase,
    }));

    jest.unstable_mockModule("../../worker/utils/execute-tool.js", () => ({
      executeTool: mockExecuteTool,
    }));

    jest.unstable_mockModule("../../worker/utils/post.js", () => ({
      setPostHandler: mockSetPostHandler,
    }));

    const module = await import("./webmcp.js");
    isWebMcpSupported = module.isWebMcpSupported;
    registerWebMcpTools = module.registerWebMcpTools;
    unregisterWebMcpTools = module.unregisterWebMcpTools;
  });

  afterEach(() => {
    if (unregisterWebMcpTools) {
      unregisterWebMcpTools();
    }
    delete ((globalThis as any).document as any).modelContext;
    delete ((globalThis as any).navigator as any).modelContext;
  });

  describe("parseWebMcpInputSchema", () => {
    it("handles JavaScript object input schema (Chrome 154+ / PR #241)", async () => {
      const { parseWebMcpInputSchema } = await import("./webmcp.js");
      const objSchema = {
        type: "object",
        properties: { path: { type: "string" } },
      };

      expect(parseWebMcpInputSchema(objSchema)).toEqual(objSchema);
    });

    it("handles stringified JSON DOMString schema (Chrome < 154 backward-compat)", async () => {
      const { parseWebMcpInputSchema } = await import("./webmcp.js");
      const stringSchema = JSON.stringify({
        type: "object",
        properties: { url: { type: "string" } },
      });

      expect(parseWebMcpInputSchema(stringSchema)).toEqual({
        type: "object",
        properties: { url: { type: "string" } },
      });
    });

    it("gracefully falls back on invalid JSON strings, primitives, null, or undefined", async () => {
      const { parseWebMcpInputSchema } = await import("./webmcp.js");

      expect(parseWebMcpInputSchema("invalid-json{")).toEqual({
        type: "object",
        properties: {},
      });
      expect(parseWebMcpInputSchema(null)).toEqual({
        type: "object",
        properties: {},
      });
      expect(parseWebMcpInputSchema(undefined)).toEqual({
        type: "object",
        properties: {},
      });
      expect(parseWebMcpInputSchema(123)).toEqual({
        type: "object",
        properties: {},
      });
      expect(parseWebMcpInputSchema(["not", "an", "object"])).toEqual({
        type: "object",
        properties: {},
      });
    });
  });

  describe("getWebMcpTools", () => {
    it("preserves optional output schemas in object and JSON string form", async () => {
      const { getWebMcpTools } = await import("./webmcp.js");
      const schema = {
        type: "object",
        properties: { temperature: { type: "number" } },
      };

      Object.defineProperty((globalThis as any).document, "modelContext", {
        configurable: true,
        value: {
          registerTool: mockRegisterTool,
          getTools: jest.fn(async () => [
            { name: "modern", outputSchema: schema },
            { name: "legacy", outputSchema: JSON.stringify(schema) },
            { name: "unspecified" },
          ]),
        },
      });

      const tools = await getWebMcpTools();
      expect(tools[0].outputSchema).toEqual(schema);
      expect(tools[1].outputSchema).toEqual(schema);
      expect(tools[2]).not.toHaveProperty("outputSchema");
    });

    it("returns normalized tools with object inputSchema on Chrome 154+ (native object)", async () => {
      const { getWebMcpTools } = await import("./webmcp.js");

      Object.defineProperty((globalThis as any).document, "modelContext", {
        configurable: true,
        value: {
          registerTool: mockRegisterTool,
          getTools: jest.fn(async () => [
            {
              name: "read_file",
              description: "Read a file from disk",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
              },
            },
          ]),
        },
      });

      const tools = await getWebMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: "read_file",
        description: "Read a file from disk",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
        },
      });
    });

    it("returns normalized tools with parsed object inputSchema on Chrome < 154 (DOMString JSON)", async () => {
      const { getWebMcpTools } = await import("./webmcp.js");

      Object.defineProperty((globalThis as any).document, "modelContext", {
        configurable: true,
        value: {
          registerTool: mockRegisterTool,
          getTools: jest.fn(async () => [
            {
              name: "write_file",
              description: "Write content to a file",
              inputSchema: JSON.stringify({
                type: "object",
                properties: { content: { type: "string" } },
              }),
            },
          ]),
        },
      });

      const tools = await getWebMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].inputSchema).toEqual({
        type: "object",
        properties: { content: { type: "string" } },
      });
    });

    it("returns empty array gracefully when getTools is unavailable", async () => {
      const { getWebMcpTools } = await import("./webmcp.js");

      Object.defineProperty((globalThis as any).document, "modelContext", {
        configurable: true,
        value: {
          registerTool: mockRegisterTool,
          // No getTools defined
        },
      });

      const tools = await getWebMcpTools();

      expect(tools).toEqual([]);
    });

    it("returns empty array gracefully when getTools throws an error", async () => {
      const { getWebMcpTools } = await import("./webmcp.js");

      Object.defineProperty((globalThis as any).document, "modelContext", {
        configurable: true,
        value: {
          registerTool: mockRegisterTool,
          getTools: jest.fn(async () => {
            throw new Error("Internal WebMCP error");
          }),
        },
      });

      const tools = await getWebMcpTools();

      expect(tools).toEqual([]);
    });

    it("reads Chrome 160+ Tool interface instances explicitly and omits null optional fields", async () => {
      const { getWebMcpTools } = await import("./webmcp.js");

      class MockToolInterface {
        #data: {
          name: string;
          title: string;
          description: string;
          origin: string;
          inputSchema: object | null;
          outputSchema: object | null;
          annotations: Record<string, unknown> | null;
          source: WindowProxy | null;
        };
        constructor(data: {
          name: string;
          title?: string;
          description?: string;
          origin?: string;
          inputSchema?: object | null;
          outputSchema?: object | null;
          annotations?: Record<string, unknown> | null;
          source?: WindowProxy | null;
        }) {
          this.#data = {
            name: data.name,
            title: data.title ?? data.name,
            description: data.description ?? "",
            origin: data.origin ?? "https://app.example.com",
            inputSchema: data.inputSchema ?? null,
            outputSchema: data.outputSchema ?? null,
            annotations: data.annotations ?? null,
            source: data.source ?? (globalThis.window as WindowProxy),
          };
        }
        get name() {
          return this.#data.name;
        }
        get title() {
          return this.#data.title;
        }
        get description() {
          return this.#data.description;
        }
        get origin() {
          return this.#data.origin;
        }
        get inputSchema() {
          return this.#data.inputSchema;
        }
        get outputSchema() {
          return this.#data.outputSchema;
        }
        get annotations() {
          return this.#data.annotations;
        }
        get source() {
          return this.#data.source;
        }
      }

      const rawTool = new MockToolInterface({
        name: "ping",
        title: "Ping",
        description: "Health check tool",
        origin: "https://app.example.com",
        inputSchema: null,
        outputSchema: null,
        annotations: null,
      });

      // Verify the mock matches Chrome 160+ Tool interface behavior
      expect(JSON.stringify(rawTool)).toBe("{}");
      expect({ ...rawTool }).toEqual({});

      Object.defineProperty((globalThis as any).document, "modelContext", {
        configurable: true,
        value: {
          registerTool: mockRegisterTool,
          getTools: jest.fn(async () => [rawTool]),
        },
      });

      const tools = await getWebMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: "ping",
        title: "Ping",
        description: "Health check tool",
        origin: "https://app.example.com",
        inputSchema: { type: "object", properties: {} },
      });
      expect(tools[0]).not.toHaveProperty("outputSchema");
      expect(tools[0]).not.toHaveProperty("annotations");
      expect(tools[0]).not.toHaveProperty("source");
      expect(tools[0]).not.toHaveProperty("window");
      expect(JSON.parse(JSON.stringify(tools[0]))).toEqual(tools[0]);
      expect(structuredClone(tools[0])).toEqual(tools[0]);
    });
  });

  it("feature-detects WebMCP support", () => {
    expect(isWebMcpSupported()).toBe(true);
  });

  it("returns false when WebMCP API is unavailable", async () => {
    // Remove polyfilled modelContext and prevent re-install
    delete ((globalThis as any).document as any).modelContext;

    // Re-mock the polyfill to be a no-op (simulates polyfill failure)
    jest.resetModules();
    jest.unstable_mockModule("@w3c/webmcp-polyfill", () => ({
      installWebMCP: jest.fn(),
    }));

    jest.unstable_mockModule("../../db/open-database.js", () => ({
      openDatabase: mockOpenDatabase,
    }));

    jest.unstable_mockModule("../../worker/utils/execute-tool.js", () => ({
      executeTool: mockExecuteTool,
    }));

    jest.unstable_mockModule("../../worker/utils/post.js", () => ({
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

  it("uses document.modelContext when already present", async () => {
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
    unregisterWebMcpTools();
  });

  it("falls back to navigator.modelContext when document.modelContext is missing (backward-compat for Chrome < 152)", async () => {
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

    delete ((globalThis as any).navigator as any).modelContext;
    unregisterWebMcpTools();
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

  it("registers declared output schemas without changing schema-free tools", async () => {
    const schema = { type: "object", required: ["temperature"] };
    await registerWebMcpTools(null, jest.fn(), "group-webmcp", [
      {
        name: "weather",
        description: "Weather",
        input_schema: { type: "object" },
        output_schema: schema,
      },
      {
        name: "legacy",
        description: "Legacy",
        input_schema: { type: "object" },
      },
    ]);
    expect(mockRegisterTool.mock.calls[0][0].outputSchema).toEqual(schema);
    expect(mockRegisterTool.mock.calls[1][0]).not.toHaveProperty(
      "outputSchema",
    );
  });

  it("rejects registered tool results that violate their declared output schema", async () => {
    const worker: any = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn(),
    };
    await registerWebMcpTools(worker, jest.fn(), "group-webmcp", [
      {
        name: "weather",
        description: "Weather",
        input_schema: { type: "object" },
        output_schema: { type: "object", required: ["temperature"] },
      },
    ]);
    const promise = mockRegisterTool.mock.calls[0][0].execute({});
    const handler = worker.addEventListener.mock.calls[0][1];
    const callId = worker.postMessage.mock.calls[0][0].callId;
    handler({ data: { type: "execute-tool-result", callId, result: "{}" } });
    await expect(promise).rejects.toThrow(/output schema.*temperature/i);
  });

  it("returns parsed JSON from registered tools that declare structured output", async () => {
    const worker: any = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn(),
    };
    await registerWebMcpTools(worker, jest.fn(), "group-webmcp", [
      {
        name: "weather",
        description: "Weather",
        input_schema: { type: "object" },
        output_schema: { type: "object", required: ["temperature"] },
      },
    ]);
    const promise = mockRegisterTool.mock.calls[0][0].execute({});
    const handler = worker.addEventListener.mock.calls[0][1];
    const callId = worker.postMessage.mock.calls[0][0].callId;
    handler({
      data: {
        type: "execute-tool-result",
        callId,
        result: '{"temperature":21}',
      },
    });
    await expect(promise).resolves.toEqual({ temperature: 21 });
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
      readOnlyHint: true,
      consequentialHint: false,
      untrustedContentHint: true,
    });

    // Verify consequential tools receive consequentialHint: true
    const consequentialToolNames = [
      "bash",
      "delete_file",
      "delete_task",
      "git_delete_repo",
      "git_delete_branch",
      "git_reset",
      "git_push",
      "email_send_message",
      "clear_chat",
    ];

    for (const toolName of consequentialToolNames) {
      const reg = mockRegisterTool.mock.calls
        .map((args: any[]) => args[0])
        .find((r: any) => r.name === toolName);
      expect(reg).toBeDefined();
      expect(reg.annotations.consequentialHint).toBe(true);
      expect(reg.annotations.readOnlyHint).toBe(false);
    }

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

  it("handles Chrome 153+ execution cancellation via { signal } option (PR #247)", async () => {
    const emit = jest.fn();
    const mockWorker: any = {
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    await registerWebMcpTools(mockWorker, emit, "group-webmcp");

    const listTasksRegistration = mockRegisterTool.mock.calls
      .map((args: any[]) => args[0])
      .find((registration: any) => registration.name === "list_tasks");

    const controller = new AbortController();

    const executePromise = listTasksRegistration.execute(
      { foo: "bar" },
      { signal: controller.signal },
    );

    expect(mockWorker.postMessage).toHaveBeenCalled();

    // Abort execution mid-flight
    controller.abort();

    await expect(executePromise).rejects.toThrow("Tool execution aborted");
    expect(mockWorker.removeEventListener).toHaveBeenCalled();
  });

  it("aborts immediately when execute is called with an already-aborted signal", async () => {
    const emit = jest.fn();
    const mockWorker: any = {
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    await registerWebMcpTools(mockWorker, emit, "group-webmcp");

    const listTasksRegistration = mockRegisterTool.mock.calls
      .map((args: any[]) => args[0])
      .find((registration: any) => registration.name === "list_tasks");

    const controller = new AbortController();
    controller.abort();

    const executePromise = listTasksRegistration.execute(
      { foo: "bar" },
      { signal: controller.signal },
    );

    await expect(executePromise).rejects.toThrow("Tool execution aborted");
    expect(mockWorker.postMessage).not.toHaveBeenCalled();
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

  describe("executeWebMcpTool", () => {
    it("enforces nested constraints and reports unusable schemas", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");
      const executeTool = jest.fn(async () => ({ status: "unknown" }));
      await expect(
        executeWebMcpTool(
          { executeTool },
          {
            name: "weather",
            outputSchema: {
              type: "object",
              properties: { status: { enum: ["sunny", "rainy"] } },
            },
          },
        ),
      ).rejects.toThrow(/output schema.*status/i);
      await expect(
        executeWebMcpTool(
          { executeTool },
          {
            name: "weather",
            outputSchema: "{broken",
          },
        ),
      ).rejects.toThrow(/invalid output schema/i);
      expect(executeTool).toHaveBeenCalledTimes(2);
    });

    it("validates modern and legacy results without retrying a schema violation", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");
      const tool = {
        name: "weather",
        outputSchema: {
          type: "object",
          properties: { temperature: { type: "number" } },
          required: ["temperature"],
        },
      };
      const executeTool = jest.fn(async (_tool: any, input: any) => {
        if (typeof input !== "string") throw new Error("Failed to parse input");
        return JSON.stringify({ temperature: "warm" });
      });

      await expect(
        executeWebMcpTool({ executeTool }, tool, {}),
      ).rejects.toThrow(/output schema.*temperature/i);
      expect(executeTool).toHaveBeenCalledTimes(2);
    });

    it("passes valid structured and schema-free results through unchanged", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");
      const result = JSON.stringify({ temperature: 21 });
      const executeTool = jest.fn(async () => result);
      const outputSchema = JSON.stringify({
        type: "object",
        required: ["temperature"],
        properties: { temperature: { type: "number" } },
      });

      await expect(
        executeWebMcpTool({ executeTool }, { name: "weather", outputSchema }),
      ).resolves.toBe(result);
      await expect(
        executeWebMcpTool({ executeTool }, { name: "legacy" }),
      ).resolves.toBe(result);
    });

    it("executes tool passing JavaScript object directly on Chrome 155+ (PR #246/#251)", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");

      const mockTool = { name: "my_tool" };
      const mockModelContext = {
        executeTool: jest.fn(async (tool: any, input: any) => {
          expect(tool).toBe(mockTool);
          expect(typeof input).toBe("object");
          expect(input).toEqual({ answer: 42 });
          return "result-ok";
        }),
      };

      const res = await executeWebMcpTool(mockModelContext, mockTool, {
        answer: 42,
      });
      expect(res).toBe("result-ok");
      expect(mockModelContext.executeTool).toHaveBeenCalledTimes(1);
      expect(mockModelContext.executeTool).toHaveBeenCalledWith(
        mockTool,
        { answer: 42 },
        undefined,
      );
    });

    it("falls back to stringified JSON when executeTool throws 'Failed to parse input' (Chrome < 155 / polyfill)", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");

      const mockTool = { name: "my_tool" };
      const calls: any[] = [];
      const mockModelContext = {
        executeTool: jest.fn(async (tool: any, input: any) => {
          calls.push({ tool, input });
          if (typeof input !== "string") {
            throw new Error(
              "Failed to parse input arguments: expected DOMString",
            );
          }
          return "legacy-result";
        }),
      };

      const res = await executeWebMcpTool(mockModelContext, mockTool, {
        answer: 42,
      });

      expect(res).toBe("legacy-result");
      expect(calls).toHaveLength(2);
      expect(calls[0].input).toEqual({ answer: 42 });
      expect(calls[1].input).toBe(JSON.stringify({ answer: 42 }));
    });

    it("falls back to stringified JSON when executeTool throws TypeError (WebIDL parameter rejection)", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");

      const mockTool = { name: "my_tool" };
      const calls: any[] = [];
      const mockModelContext = {
        executeTool: jest.fn(async (_tool: any, input: any) => {
          calls.push(input);
          if (typeof input !== "string") {
            throw new TypeError(
              "Failed to execute 'executeTool' on 'ModelContext': parameter 2 is not of type 'DOMString'",
            );
          }
          return "typeerror-fallback-result";
        }),
      };

      const res = await executeWebMcpTool(mockModelContext, mockTool, {
        param: "value",
      });

      expect(res).toBe("typeerror-fallback-result");
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ param: "value" });
      expect(calls[1]).toBe(JSON.stringify({ param: "value" }));
    });

    it("normalizes string input and executes with parsed object first then string fallback", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");

      const mockTool = { name: "my_tool" };
      const calls: any[] = [];
      const mockModelContext = {
        executeTool: jest.fn(async (_tool: any, input: any) => {
          calls.push(input);
          if (typeof input !== "string") {
            throw new Error("Failed to parse input");
          }
          return "string-input-result";
        }),
      };

      const res = await executeWebMcpTool(
        mockModelContext,
        mockTool,
        '{"foo":"bar"}',
      );

      expect(res).toBe("string-input-result");
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ foo: "bar" });
      expect(calls[1]).toBe('{"foo":"bar"}');
    });

    it("handles undefined/null input by passing empty object then empty JSON string on fallback", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");

      const mockTool = { name: "my_tool" };
      const calls: any[] = [];
      const mockModelContext = {
        executeTool: jest.fn(async (_tool: any, input: any) => {
          calls.push(input);
          if (typeof input !== "string") {
            throw new Error("Failed to parse input");
          }
          return "empty-result";
        }),
      };

      const res = await executeWebMcpTool(mockModelContext, mockTool);

      expect(res).toBe("empty-result");
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({});
      expect(calls[1]).toBe("{}");
    });

    it("propagates other errors without attempting string fallback", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");

      const mockTool = { name: "my_tool" };
      const mockModelContext = {
        executeTool: jest.fn(async () => {
          throw new Error("Tool internal execution failed");
        }),
      };

      await expect(
        executeWebMcpTool(mockModelContext, mockTool, { foo: "bar" }),
      ).rejects.toThrow("Tool internal execution failed");

      expect(mockModelContext.executeTool).toHaveBeenCalledTimes(1);
    });

    it("passes execution options or signal context to executeTool", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");

      const mockTool = { name: "my_tool" };
      const controller = new AbortController();
      const mockModelContext = {
        executeTool: jest.fn(async (_tool: any, _input: any, options: any) => {
          expect(options).toEqual({ signal: controller.signal });
          return "with-signal";
        }),
      };

      const res = await executeWebMcpTool(
        mockModelContext,
        mockTool,
        { foo: "bar" },
        { signal: controller.signal },
      );

      expect(res).toBe("with-signal");
    });

    it("unwraps normalized tools from getWebMcpTools() back to genuine Tool interface instances", async () => {
      const { getWebMcpTools, executeWebMcpTool } = await import("./webmcp.js");

      class MockToolInterface {
        #name: string;
        constructor(name: string) {
          this.#name = name;
        }
        get name() {
          return this.#name;
        }
        get title() {
          return this.#name;
        }
        get description() {
          return "Genuine Tool instance";
        }
        get inputSchema() {
          return null;
        }
        get outputSchema() {
          return null;
        }
        get annotations() {
          return null;
        }
        get origin() {
          return "https://app.example.com";
        }
        get source() {
          return globalThis.window as WindowProxy;
        }
      }

      const genuineTool = new MockToolInterface("native_ping");
      const mockModelContext = {
        registerTool: mockRegisterTool,
        getTools: jest.fn(async () => [genuineTool]),
        executeTool: jest.fn(async (tool: any, input: any) => {
          if (tool !== genuineTool) {
            throw new TypeError("parameter 1 is not of type 'Tool'.");
          }
          return { ok: true, input };
        }),
      };

      Object.defineProperty((globalThis as any).document, "modelContext", {
        configurable: true,
        value: mockModelContext,
      });

      const [normalized] = await getWebMcpTools();
      const res = await executeWebMcpTool(mockModelContext, normalized, {
        n: 1,
      });

      expect(res).toEqual({ ok: true, input: { n: 1 } });
      expect(mockModelContext.executeTool).toHaveBeenCalledTimes(1);
      expect(mockModelContext.executeTool).toHaveBeenCalledWith(
        genuineTool,
        { n: 1 },
        undefined,
      );
    });

    it("does not retry with stringified JSON when parameter 1 Tool TypeError is thrown", async () => {
      const { executeWebMcpTool } = await import("./webmcp.js");

      const mockModelContext = {
        executeTool: jest.fn(async () => {
          throw new TypeError("parameter 1 is not of type 'Tool'.");
        }),
      };

      await expect(
        executeWebMcpTool(mockModelContext, { name: "forged" }, { a: 1 }),
      ).rejects.toThrow("parameter 1 is not of type 'Tool'.");
      expect(mockModelContext.executeTool).toHaveBeenCalledTimes(1);
    });
  });

  describe("getWebMcpToolSource and serializeWebMcpTool (PR #348 / Chrome 160+)", () => {
    it("resolves source on Chrome 160+ Tool instances and falls back to window on Chrome < 160", async () => {
      const { getWebMcpTools, getWebMcpToolSource } =
        await import("./webmcp.js");

      const sourceWin = { name: "source-win" } as unknown as WindowProxy;
      const legacyWin = { name: "legacy-win" } as unknown as Window;

      class MockToolInterface {
        #name: string;
        #source: WindowProxy | null;
        constructor(name: string, source: WindowProxy | null) {
          this.#name = name;
          this.#source = source;
        }
        get name() {
          return this.#name;
        }
        get inputSchema() {
          return null;
        }
        get outputSchema() {
          return null;
        }
        get annotations() {
          return null;
        }
        get source() {
          return this.#source;
        }
      }

      const chrome160Tool = new MockToolInterface("modern", sourceWin);
      const navigatedAwayTool = new MockToolInterface("detached", null);
      const legacyTool = {
        name: "legacy",
        window: legacyWin,
      };

      expect(getWebMcpToolSource(chrome160Tool)).toBe(sourceWin);
      expect(getWebMcpToolSource(navigatedAwayTool)).toBeNull();
      expect(getWebMcpToolSource(legacyTool)).toBe(legacyWin);
      expect(getWebMcpToolSource(null)).toBeNull();
      expect(getWebMcpToolSource(undefined)).toBeNull();

      Object.defineProperty((globalThis as any).document, "modelContext", {
        configurable: true,
        value: {
          registerTool: mockRegisterTool,
          getTools: jest.fn(async () => [chrome160Tool, navigatedAwayTool]),
        },
      });

      const normalized = await getWebMcpTools();
      expect(getWebMcpToolSource(normalized[0])).toBe(sourceWin);
      expect(getWebMcpToolSource(normalized[1])).toBeNull();
    });

    it("explicitly serializes prototype-getter Tool instances with null defaults", async () => {
      const { serializeWebMcpTool, getWebMcpTools } =
        await import("./webmcp.js");

      class MockToolInterface {
        get name() {
          return "proto_tool";
        }
        get title() {
          return "Proto Tool";
        }
        get description() {
          return "Prototype getter tool";
        }
        get origin() {
          return "https://example.org";
        }
        get inputSchema() {
          return null;
        }
        get outputSchema() {
          return null;
        }
        get annotations() {
          return null;
        }
        get source() {
          return globalThis.window as WindowProxy;
        }
      }

      const protoTool = new MockToolInterface();
      expect(JSON.stringify(protoTool)).toBe("{}");
      expect({ ...protoTool }).toEqual({});

      const serialized = serializeWebMcpTool(protoTool);
      expect(serialized).toEqual({
        name: "proto_tool",
        title: "Proto Tool",
        description: "Prototype getter tool",
        origin: "https://example.org",
        inputSchema: null,
        outputSchema: null,
        annotations: null,
      });
      expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
      expect(structuredClone(serialized)).toEqual(serialized);

      // Legacy stringified schemas and annotations are also normalized
      const legacySerialized = serializeWebMcpTool({
        name: "legacy_tool",
        description: "Legacy",
        inputSchema: JSON.stringify({
          type: "object",
          properties: { q: { type: "string" } },
        }),
        outputSchema: JSON.stringify({ type: "string" }),
        annotations: { readOnlyHint: true },
        window: globalThis.window,
        execute: async () => "ok",
      });
      expect(legacySerialized).toEqual({
        name: "legacy_tool",
        title: "",
        description: "Legacy",
        origin: "",
        inputSchema: { type: "object", properties: { q: { type: "string" } } },
        outputSchema: { type: "string" },
        annotations: { readOnlyHint: true },
      });
      expect(structuredClone(legacySerialized)).toEqual(legacySerialized);

      // Also works on normalized tools from getWebMcpTools()
      Object.defineProperty((globalThis as any).document, "modelContext", {
        configurable: true,
        value: {
          registerTool: mockRegisterTool,
          getTools: jest.fn(async () => [protoTool]),
        },
      });
      const [normalized] = await getWebMcpTools();
      expect(serializeWebMcpTool(normalized)).toEqual({
        name: "proto_tool",
        title: "Proto Tool",
        description: "Prototype getter tool",
        origin: "https://example.org",
        inputSchema: null,
        outputSchema: null,
        annotations: null,
      });
    });
  });

  describe("resolveWebMcpToolAnnotations", () => {
    it("marks destructive and high-stakes tools with consequentialHint: true", async () => {
      const { resolveWebMcpToolAnnotations, CONSEQUENTIAL_TOOL_NAMES } =
        await import("./webmcp.js");

      for (const toolName of CONSEQUENTIAL_TOOL_NAMES) {
        const annotations = resolveWebMcpToolAnnotations(toolName);
        expect(annotations.consequentialHint).toBe(true);
        expect(annotations.readOnlyHint).toBe(false);
        expect(annotations.untrustedContentHint).toBe(true);
      }
    });

    it("marks read-only query tools with readOnlyHint: true and consequentialHint: false", async () => {
      const { resolveWebMcpToolAnnotations, READ_ONLY_TOOL_NAMES } =
        await import("./webmcp.js");

      for (const toolName of READ_ONLY_TOOL_NAMES) {
        const annotations = resolveWebMcpToolAnnotations(toolName);
        expect(annotations.readOnlyHint).toBe(true);
        expect(annotations.consequentialHint).toBe(false);
        expect(annotations.untrustedContentHint).toBe(true);
      }
    });

    it("marks regular state-mutating tools with readOnlyHint: false and consequentialHint: false", async () => {
      const { resolveWebMcpToolAnnotations } = await import("./webmcp.js");

      const mutatingTools = [
        "write_file",
        "patch_file",
        "create_task",
        "update_task",
        "show_toast",
        "send_notification",
      ];

      for (const toolName of mutatingTools) {
        const annotations = resolveWebMcpToolAnnotations(toolName);
        expect(annotations.readOnlyHint).toBe(false);
        expect(annotations.consequentialHint).toBe(false);
        expect(annotations.untrustedContentHint).toBe(true);
      }
    });

    it("allows custom annotations to override defaults", async () => {
      const { resolveWebMcpToolAnnotations } = await import("./webmcp.js");

      const custom = resolveWebMcpToolAnnotations("read_file", {
        consequentialHint: true,
        customMeta: "important",
      });

      expect(custom.consequentialHint).toBe(true);
      expect(custom.readOnlyHint).toBe(true);
      expect(custom.customMeta).toBe("important");
    });

    it("registers declarative tools with their declared annotations", async () => {
      await registerWebMcpTools(null, jest.fn(), "group-webmcp", [
        {
          name: "lightmeter_read",
          description: "Read the light sensor.",
          input_schema: { type: "object" },
          annotations: { readOnlyHint: true },
        } as any,
        {
          name: "lightmeter_send_raw",
          description: "Send raw bytes.",
          input_schema: { type: "object" },
          annotations: { consequentialHint: true },
        } as any,
        {
          name: "lightmeter_plain",
          description: "No annotations declared.",
          input_schema: { type: "object" },
        } as any,
      ]);

      const byName = (name: string) =>
        mockRegisterTool.mock.calls
          .map((args: any[]) => args[0])
          .find((r: any) => r.name === name);

      expect(byName("lightmeter_read").annotations).toEqual({
        readOnlyHint: true,
        consequentialHint: false,
        untrustedContentHint: true,
      });
      expect(byName("lightmeter_send_raw").annotations).toEqual({
        readOnlyHint: false,
        consequentialHint: true,
        untrustedContentHint: true,
      });
      expect(byName("lightmeter_plain").annotations).toEqual({
        readOnlyHint: false,
        consequentialHint: false,
        untrustedContentHint: true,
      });
    });
  });

  describe("security error handling", () => {
    it("bails out cleanly on SecurityError DOMException from registerTool without cascading per-tool errors", async () => {
      // Simulate a polyfill that passes the pre-check but throws SecurityError on the first registerTool call
      const securityError = new DOMException("", "SecurityError");
      mockRegisterTool.mockRejectedValueOnce(securityError);

      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await registerWebMcpTools(null, jest.fn());

      expect(result).toBe(false);
      // One warn, zero errors — no per-tool error spam
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("SecurityError");
      expect(errorSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("bails out cleanly on NotAllowedError DOMException from registerTool (WebMCP Permissions Policy)", async () => {
      const notAllowedError = new DOMException(
        'Access to the feature "tools" is disallowed by permissions policy.',
        "NotAllowedError",
      );
      mockRegisterTool.mockRejectedValueOnce(notAllowedError);

      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await registerWebMcpTools(null, jest.fn());

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("NotAllowedError");
      expect(errorSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe("WebMCP lifecycle events (PR #245 / Chrome 156+)", () => {
    let originalWindowOntoolactivated: any;
    let originalWindowOntoolcancel: any;

    beforeEach(() => {
      originalWindowOntoolactivated = (globalThis as any).window
        ?.ontoolactivated;
      originalWindowOntoolcancel = (globalThis as any).window?.ontoolcancel;
      if (typeof window !== "undefined") {
        delete (window as any).ontoolactivated;
        delete (window as any).ontoolcancel;
      }
    });

    afterEach(() => {
      if (typeof window !== "undefined") {
        if (originalWindowOntoolactivated !== undefined) {
          (window as any).ontoolactivated = originalWindowOntoolactivated;
        } else {
          delete (window as any).ontoolactivated;
        }
        if (originalWindowOntoolcancel !== undefined) {
          (window as any).ontoolcancel = originalWindowOntoolcancel;
        } else {
          delete (window as any).ontoolcancel;
        }
      }
    });

    describe("getWebMcpEventTarget", () => {
      it("resolves to document.modelContext when ontoolactivated is in document.modelContext (Chrome 156+ / PR #245)", async () => {
        const { getWebMcpEventTarget } = await import("./webmcp.js");

        const mockTarget = new EventTarget();
        (mockTarget as any).ontoolactivated = null;
        (mockTarget as any).ontoolcancel = null;

        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: mockTarget,
        });

        // Also define ontoolactivated on window to ensure modelContext takes precedence
        if (typeof window !== "undefined") {
          (window as any).ontoolactivated = null;
        }

        expect(getWebMcpEventTarget("toolactivated")).toBe(mockTarget);
        expect(getWebMcpEventTarget("toolcancel")).toBe(mockTarget);
      });

      it("falls back to window when ontoolactivated is only present on window (legacy Chrome < 156)", async () => {
        const { getWebMcpEventTarget } = await import("./webmcp.js");

        const mockModelContext = {
          registerTool: jest.fn(),
          // No ontoolactivated or ontoolcancel
        };

        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: mockModelContext,
        });

        if (typeof window !== "undefined") {
          (window as any).ontoolactivated = null;
          (window as any).ontoolcancel = null;
        }

        expect(getWebMcpEventTarget("toolactivated")).toBe(window);
        expect(getWebMcpEventTarget("toolcancel")).toBe(window);
      });

      it("resolves to navigator.modelContext if document.modelContext is absent (Chrome < 152)", async () => {
        const { getWebMcpEventTarget } = await import("./webmcp.js");

        delete ((globalThis as any).document as any).modelContext;

        const navTarget = new EventTarget();
        (navTarget as any).ontoolactivated = null;

        Object.defineProperty((globalThis as any).navigator, "modelContext", {
          configurable: true,
          value: navTarget,
        });

        expect(getWebMcpEventTarget("toolactivated")).toBe(navTarget);

        delete ((globalThis as any).navigator as any).modelContext;
      });

      it("prefers modelContext when neither target has on{type} property but modelContext is an EventTarget", async () => {
        const { getWebMcpEventTarget } = await import("./webmcp.js");

        const mockTarget = new EventTarget();
        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: mockTarget,
        });

        expect(getWebMcpEventTarget("toolactivated")).toBe(mockTarget);
        expect(getWebMcpEventTarget()).toBe(mockTarget);
      });

      it("falls back to window if modelContext lacks addEventListener", async () => {
        const { getWebMcpEventTarget } = await import("./webmcp.js");

        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: {
            // Not an EventTarget
            registerTool: jest.fn(),
          },
        });

        expect(getWebMcpEventTarget("toolactivated")).toBe(window);
      });

      it("degrades gracefully when document.modelContext getter throws", async () => {
        const {
          getWebMcpEventTarget,
          addWebMcpEventListener,
          onWebMcpToolChange,
        } = await import("./webmcp.js");

        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          get() {
            throw new TypeError("crypto.randomUUID is not a function");
          },
        });

        expect(getWebMcpEventTarget("toolactivated")).toBe(window);

        const listener = jest.fn();
        const unsubscribe = addWebMcpEventListener("toolactivated", listener);
        const unsubscribeChange = onWebMcpToolChange(listener);

        expect(typeof unsubscribe).toBe("function");
        expect(typeof unsubscribeChange).toBe("function");

        unsubscribe();
        unsubscribeChange();
      });
    });

    describe("addWebMcpEventListener and convenience helpers", () => {
      it("listens to toolactivated on document.modelContext in Chrome 156+", async () => {
        const { addWebMcpEventListener } = await import("./webmcp.js");

        const mockTarget = new EventTarget();
        (mockTarget as any).ontoolactivated = null;

        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: mockTarget,
        });

        const listener = jest.fn();
        const unsubscribe = addWebMcpEventListener("toolactivated", listener);

        const event = new CustomEvent("toolactivated");
        (event as any).toolName = "read_file";
        mockTarget.dispatchEvent(event);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({ toolName: "read_file" }),
        );

        // Unsubscribe should remove the listener
        unsubscribe();
        mockTarget.dispatchEvent(event);
        expect(listener).toHaveBeenCalledTimes(1);
      });

      it("normalizes toolName from detail.toolName if event.toolName is not directly set", async () => {
        const { onWebMcpToolActivated } = await import("./webmcp.js");

        const mockTarget = new EventTarget();
        (mockTarget as any).ontoolactivated = null;

        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: mockTarget,
        });

        const listener = jest.fn();
        const unsubscribe = onWebMcpToolActivated(listener);

        const legacyEvent = new CustomEvent("toolactivated", {
          detail: { toolName: "bash" },
        });
        mockTarget.dispatchEvent(legacyEvent);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({ toolName: "bash" }),
        );

        unsubscribe();
      });

      it("listens to toolcancel on window in legacy Chrome < 156", async () => {
        const { onWebMcpToolCancel } = await import("./webmcp.js");

        delete ((globalThis as any).document as any).modelContext;
        (window as any).ontoolcancel = null;

        const listener = jest.fn();
        const unsubscribe = onWebMcpToolCancel(listener);

        const event = new CustomEvent("toolcancel");
        (event as any).toolName = "fetch_url";
        window.dispatchEvent(event);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({ toolName: "fetch_url" }),
        );

        unsubscribe();
        window.dispatchEvent(event);
        expect(listener).toHaveBeenCalledTimes(1);
      });

      it("automatically cleans up when AbortSignal is aborted", async () => {
        const { onWebMcpToolActivated } = await import("./webmcp.js");

        const mockTarget = new EventTarget();
        (mockTarget as any).ontoolactivated = null;

        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: mockTarget,
        });

        const controller = new AbortController();
        const listener = jest.fn();
        onWebMcpToolActivated(listener, { signal: controller.signal });

        controller.abort();

        const event = new CustomEvent("toolactivated");
        (event as any).toolName = "write_file";
        mockTarget.dispatchEvent(event);

        expect(listener).not.toHaveBeenCalled();
      });

      it("supports listenBoth: true and deduplicates events within same tick", async () => {
        const { addWebMcpEventListener } = await import("./webmcp.js");

        const mockTarget = new EventTarget();
        (mockTarget as any).ontoolactivated = null;

        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: mockTarget,
        });

        const listener = jest.fn();
        const unsubscribe = addWebMcpEventListener("toolactivated", listener, {
          listenBoth: true,
        });

        const evt1 = new CustomEvent("toolactivated");
        (evt1 as any).toolName = "list_files";
        const evt2 = new CustomEvent("toolactivated");
        (evt2 as any).toolName = "list_files";

        // Dispatch on both targets
        mockTarget.dispatchEvent(evt1);
        window.dispatchEvent(evt2);

        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
      });

      it("subscribes to toolchange event via onWebMcpToolChange", async () => {
        const { onWebMcpToolChange } = await import("./webmcp.js");

        const mockTarget = new EventTarget();
        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: mockTarget,
        });

        const listener = jest.fn();
        const unsubscribe = onWebMcpToolChange(listener);

        const changeEvt = new Event("toolchange");
        mockTarget.dispatchEvent(changeEvt);

        expect(listener).toHaveBeenCalledWith(changeEvt);

        unsubscribe();
        mockTarget.dispatchEvent(new Event("toolchange"));
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe("annotations and discovery spec features", () => {
      it("supports debugging annotation in resolveWebMcpToolAnnotations", async () => {
        const { resolveWebMcpToolAnnotations } = await import("./webmcp.js");

        const normal = resolveWebMcpToolAnnotations("read_file");
        expect(normal.debugging).toBeUndefined();

        const debugTool = resolveWebMcpToolAnnotations("dump_state", {
          debugging: true,
        });
        expect(debugTool.debugging).toBe(true);
      });

      it("passes fromOrigins to modelContext.getTools and preserves title", async () => {
        const { getWebMcpTools } = await import("./webmcp.js");

        const mockGetTools = jest.fn(async (_opts?: any) => [
          {
            name: "cross_frame_tool",
            title: "Cross Frame Tool",
            description: "A tool from another origin",
            inputSchema: { type: "object", properties: {} },
          },
        ]);

        Object.defineProperty((globalThis as any).document, "modelContext", {
          configurable: true,
          value: {
            registerTool: jest.fn(),
            getTools: mockGetTools,
          },
        });

        const tools = await getWebMcpTools({
          fromOrigins: ["https://cart.example.com"],
        });

        expect(mockGetTools).toHaveBeenCalledWith({
          fromOrigins: ["https://cart.example.com"],
        });
        expect(tools[0].name).toBe("cross_frame_tool");
        expect(tools[0].title).toBe("Cross Frame Tool");
      });
    });
  });
});
