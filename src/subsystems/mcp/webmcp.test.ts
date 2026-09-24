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
        if (!(globalThis as any).document?.modelContext) {
          Object.defineProperty((globalThis as any).document, "modelContext", {
            configurable: true,
            value: {
              registerTool: mockRegisterTool,
              unregisterTool: mockUnregisterTool,
            },
          });
        }
      }),
    }));

    jest.unstable_mockModule("../../db/openDatabase.js", () => ({
      openDatabase: mockOpenDatabase,
    }));

    jest.unstable_mockModule("../../worker/utils/executeTool.js", () => ({
      executeTool: mockExecuteTool,
    }));

    jest.unstable_mockModule("../../worker/utils/post.js", () => ({
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

    jest.unstable_mockModule("../../worker/utils/executeTool.js", () => ({
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

  it("falls back to navigator.modelContext when document.modelContext is missing (backward-compat for Chrome < 152)", async () => {
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
  });

  describe("Firefox originAgentCluster compatibility", () => {
    const origOAC = Object.getOwnPropertyDescriptor(
      globalThis,
      "originAgentCluster",
    );

    afterEach(() => {
      // Restore originAgentCluster to its original state
      if (origOAC) {
        Object.defineProperty(globalThis, "originAgentCluster", origOAC);
      } else {
        delete (globalThis as any).originAgentCluster;
      }
    });

    it("skips polyfill registration and returns false when originAgentCluster === false (Firefox without Origin-Agent-Cluster header)", async () => {
      Object.defineProperty(globalThis, "originAgentCluster", {
        configurable: true,
        value: false,
      });

      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await registerWebMcpTools(null, jest.fn());

      expect(result).toBe(false);
      // Must not have attempted any registerTool calls
      expect(mockRegisterTool).not.toHaveBeenCalled();
      // Must emit exactly one descriptive warning
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("originAgentCluster");

      warnSpy.mockRestore();
    });

    it("proceeds normally when originAgentCluster === true (Chrome default)", async () => {
      Object.defineProperty(globalThis, "originAgentCluster", {
        configurable: true,
        value: true,
      });

      const result = await registerWebMcpTools(null, jest.fn());

      expect(result).toBe(true);
      expect(mockRegisterTool).toHaveBeenCalled();
    });

    it("proceeds normally when originAgentCluster is undefined (older browsers)", async () => {
      delete (globalThis as any).originAgentCluster;

      const result = await registerWebMcpTools(null, jest.fn());

      expect(result).toBe(true);
      expect(mockRegisterTool).toHaveBeenCalled();
    });

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
  });
});
