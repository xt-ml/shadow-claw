import { jest } from "@jest/globals";

describe("handleInvoke.js", () => {
  let handleInvoke;
  let mockBuildHeaders;
  let mockCreateTokenUsageMessage;
  let mockCreateToolActivityMessage;
  let mockExecuteTool;
  let mockFormatRequest;
  let mockGetContextLimit;
  let mockGetProvider;
  let mockLog;
  let mockParseResponse;
  let mockParseSSEStream;
  let mockPost;
  let mockSetStorageRoot;
  let mockWithRetry;
  let mockGetToolState;
  let mockClearToolState;
  let mockBuildSystemPrompt;

  beforeEach(async () => {
    jest.resetModules();

    mockBuildHeaders = jest.fn();
    mockExecuteTool = jest.fn();
    mockFormatRequest = jest.fn();
    mockGetContextLimit = jest.fn();
    mockGetProvider = jest.fn();
    mockParseResponse = jest.fn();
    mockSetStorageRoot = jest.fn();
    mockCreateTokenUsageMessage = jest.fn((id, usage, limit) => ({
      type: "usage",
      payload: { id, usage, limit },
    }));

    mockCreateToolActivityMessage = jest.fn((id, tool, status) => ({
      type: "activity",
      payload: { id, tool, status },
    }));

    mockLog = jest.fn();
    mockPost = jest.fn();

    // Mock parseSSEStream as an async generator
    mockParseSSEStream = jest.fn();

    // Mock withRetry to pass through the function call without actual delays.
    // This keeps handleInvoke tests focused; retry logic is tested in withRetry.test.mjs.
    mockWithRetry = jest.fn(async (fn: any) => fn());

    mockGetToolState = jest.fn();
    mockClearToolState = jest.fn();
    mockBuildSystemPrompt = jest.fn();

    jest.unstable_mockModule("../../config/config.js", () => ({
      CONFIG_KEYS: null,
      DEFAULT_MAX_ITERATIONS: 50,
      DEFAULT_PROMPT_API_FALLBACK_MODEL: "onnx-community/Qwen3-0.6B-ONNX",
      getProvider: mockGetProvider,
    }));

    jest.unstable_mockModule("../../subsystems/providers/providers.js", () => ({
      buildHeaders: mockBuildHeaders,
      formatRequest: mockFormatRequest,
      getContextLimit: mockGetContextLimit,
      parseResponse: mockParseResponse,
      normalizeMeshLlmResult: jest.fn((r) => r),
    }));

    jest.unstable_mockModule("../../storage/storage.js", () => ({
      getOpfsRootDirName: jest.fn(() => "shadowclaw"),
      setStorageRoot: mockSetStorageRoot,
    }));

    jest.unstable_mockModule("../../subsystems/tools/tools.js", () => ({
      TOOL_DEFINITIONS: [],
    }));

    jest.unstable_mockModule("./createTokenUsageMessage.js", () => ({
      createTokenUsageMessage: mockCreateTokenUsageMessage,
    }));

    jest.unstable_mockModule("./createToolActivityMessage.js", () => ({
      createToolActivityMessage: mockCreateToolActivityMessage,
    }));

    jest.unstable_mockModule("./executeTool.js", () => ({
      executeTool: mockExecuteTool,
    }));

    jest.unstable_mockModule("./log.js", () => ({
      log: mockLog,
    }));

    jest.unstable_mockModule("./post.js", () => ({
      post: mockPost,
      registerSubagentCollector: jest.fn(),
      unregisterSubagentCollector: jest.fn(),
      setPostHandler: jest.fn(),
    }));

    jest.unstable_mockModule("./parseSSEStream.js", () => ({
      parseSSEStream: mockParseSSEStream,
    }));

    jest.unstable_mockModule("./withRetry.js", () => ({
      withRetry: mockWithRetry,
      isRetryableHttpError: jest.fn(() => false),
    }));

    jest.unstable_mockModule("./tool-state.js", () => ({
      getToolState: mockGetToolState,
      clearToolState: mockClearToolState,
    }));

    jest.unstable_mockModule("./system-prompt.js", () => ({
      buildSystemPrompt: mockBuildSystemPrompt,
    }));

    const module = await import("./handleInvoke.js");
    handleInvoke = module.handleInvoke;
  });

  it("should handle simple response successfully", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "sys",
      apiKey: "key",
      model: "m1",
      maxTokens: 100,
      provider: "p1",
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });
    (mockBuildHeaders as any).mockReturnValue({ Auth: "key" });
    (mockParseResponse as any).mockReturnValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "hello" }],
      usage: { input: 10, output: 5 },
    });

    (mockGetContextLimit as any).mockReturnValue(1000);

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({ type: "usage" }),
    );

    expect(mockPost).toHaveBeenCalledWith({
      type: "response",
      payload: { groupId: "g1", text: "hello" },
    });
  });

  it("should post intermediate-response when tool_use response includes text", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "what's the weather?" }],
      provider: "p1",
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });

    // First call returns text + tool_use
    (mockParseResponse as any).mockReturnValueOnce({
      stop_reason: "tool_use",
      content: [
        { type: "text", text: "Let me check the weather for you." },
        {
          type: "tool_use",
          id: "t1",
          name: "fetch_url",
          input: { url: "https://example.com" },
        },
      ],
    });

    // Second call returns final text
    (mockParseResponse as any).mockReturnValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "The weather is sunny." }],
    });

    (mockExecuteTool as any).mockResolvedValue("weather data");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    // Should post intermediate-response with the text before tool execution
    expect(mockPost).toHaveBeenCalledWith({
      type: "intermediate-response",
      payload: { groupId: "g1", text: "Let me check the weather for you." },
    });

    // Should also post the final response
    expect(mockPost).toHaveBeenCalledWith({
      type: "response",
      payload: { groupId: "g1", text: "The weather is sunny." },
    });
  });

  it("should NOT post intermediate-response when tool_use has no text content", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "do it" }],
      provider: "p1",
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });

    // First call returns tool_use with no text
    (mockParseResponse as any).mockReturnValueOnce({
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t1", name: "tool1", input: { arg: 1 } },
      ],
    });

    // Second call returns final text
    (mockParseResponse as any).mockReturnValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "done" }],
    });

    (mockExecuteTool as any).mockResolvedValue("tool output");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    // Should NOT have posted intermediate-response
    const intermediateCalls = mockPost.mock.calls.filter(
      ([msg]) => msg.type === "intermediate-response",
    );
    expect(intermediateCalls).toHaveLength(0);

    // Should still post the final response
    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response",
        payload: { groupId: "g1", text: "done" },
      }),
    );
  });

  it("should handle tool-use loop", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "do it" }],
      provider: "p1",
      enabledTools: [{ name: "tool1", description: "Tool 1" }],
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });

    // First call returns tool_use
    (mockParseResponse as any).mockReturnValueOnce({
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t1", name: "tool1", input: { arg: 1 } },
      ],
    });

    // Second call returns final text
    (mockParseResponse as any).mockReturnValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "done" }],
    });

    (mockExecuteTool as any).mockResolvedValue("tool output");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    expect(mockExecuteTool).toHaveBeenCalledWith(
      {},
      "tool1",
      { arg: 1 },
      "g1",
      expect.objectContaining({
        isScheduledTask: false,
      }),
    );

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response",
        payload: { groupId: "g1", text: "done" },
      }),
    );
  });

  it("should convert [tool_code] print(tool()) text to tool_use", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "please list_tool_profiles" }],
      provider: "p1",
      enabledTools: [
        {
          name: "list_tool_profiles",
          description: "List tool profiles",
          input_schema: {
            type: "object",
            properties: {},
          },
        },
      ],
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });

    (mockParseResponse as any)
      .mockReturnValueOnce({
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: "[tool_code]\nprint(list_tool_profiles())\n[/tool_code]",
          },
        ],
      })
      .mockReturnValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Tool profiles listed." }],
      });

    (mockExecuteTool as any).mockResolvedValue("default");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    expect(mockExecuteTool).toHaveBeenCalledWith(
      {},
      "list_tool_profiles",
      {},
      "g1",
      expect.objectContaining({ isScheduledTask: false }),
    );

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response",
        payload: { groupId: "g1", text: "Tool profiles listed." },
      }),
    );
  });

  it("should fall back to tool result text when final turn is empty", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "please list tool profiles" }],
      provider: "p1",
      enabledTools: [
        { name: "list_tool_profiles", description: "List profiles" },
      ],
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });

    (mockParseResponse as any)
      .mockReturnValueOnce({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "list_tool_profiles",
            input: {},
          },
        ],
      })
      .mockReturnValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "   " }],
      });

    (mockExecuteTool as any).mockResolvedValue("Profile A\nProfile B");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response",
        payload: { groupId: "g1", text: "Tool result:\nProfile A\nProfile B" },
      }),
    );
  });

  it("should ignore literal '(no response)' when tool fallback exists", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "please list tool profiles" }],
      provider: "p1",
      enabledTools: [
        { name: "list_tool_profiles", description: "List profiles" },
      ],
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });

    (mockParseResponse as any)
      .mockReturnValueOnce({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "list_tool_profiles",
            input: {},
          },
        ],
      })
      .mockReturnValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "(no response)" }],
      });

    (mockExecuteTool as any).mockResolvedValue("Profile X");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response",
        payload: { groupId: "g1", text: "Tool result:\nProfile X" },
      }),
    );
  });

  it("should prevent infinite loops with identical tool calls", async () => {
    const payload: any = {
      groupId: "g1",
      provider: "p1",
      messages: [{ role: "user", content: "loop" }],
      enabledTools: [{ name: "tool1", description: "Tool 1" }],
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });

    // Always return tool_use with same input
    (mockParseResponse as any).mockReturnValue({
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t1", name: "tool1", input: { arg: 1 } },
      ],
    });

    (mockExecuteTool as any).mockResolvedValue("output");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    // Mock console.warn to suppress it
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await handleInvoke({} as any, payload);

    // Should call executeTool 3 times, then block on the 4th
    expect(mockExecuteTool).toHaveBeenCalledTimes(3);

    expect(mockLog).toHaveBeenCalledWith(
      "g1",
      "tool-result",
      expect.any(String),
      expect.stringContaining("rigid loop"),
    );

    consoleSpy.mockRestore();
  });

  it("should handle API error", async () => {
    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: false,
      status: 401,
      text: (jest.fn() as any).mockResolvedValue("Unauthorized"),
    });

    await handleInvoke({} as any, {
      groupId: "g1",
      provider: "p1",
      messages: [],
    });

    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: {
        groupId: "g1",
        error: expect.stringContaining("API error 401"),
      },
    });
  });

  it("should respect maxIterations from payload", async () => {
    const payload: any = {
      groupId: "g1",
      provider: "p1",
      messages: [{ role: "user", content: "many" }],
      maxIterations: 3,
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });

    let count = 0;
    (mockParseResponse as any).mockImplementation(() => ({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: `t${count++}`,
          name: "tool1",
          input: { arg: count },
        },
      ],
    }));

    (mockExecuteTool as any).mockResolvedValue("output");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    // Should have made exactly 3 API calls (the custom limit)
    expect(mockFormatRequest).toHaveBeenCalledTimes(3);

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response",
        payload: expect.objectContaining({
          text: expect.stringContaining("Reached maximum tool-use iterations"),
        }),
      }),
    );
  });

  it("should reach max iterations", async () => {
    const payload: any = {
      groupId: "g1",
      provider: "p1",
      messages: [{ role: "user", content: "many" }],
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });

    // Always return tool_use, but with DIFFERENT inputs to avoid loop prevention
    let count = 0;
    (mockParseResponse as any).mockImplementation(() => ({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: `t${count++}`,
          name: "tool1",
          input: { arg: count },
        },
      ],
    }));

    (mockExecuteTool as any).mockResolvedValue("output");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response",
        payload: expect.objectContaining({
          text: expect.stringContaining("Reached maximum tool-use iterations"),
        }),
      }),
    );
  });

  it("should handle unknown provider", async () => {
    const payload: any = {
      groupId: "g1",
      provider: "unknown-provider",
      messages: [],
    };

    (mockGetProvider as any).mockReturnValue(null);

    await handleInvoke({} as any, payload);

    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: { groupId: "g1", error: "Unknown provider: unknown-provider" },
    });

    expect(mockLog).not.toHaveBeenCalled();
  });

  it("should set storage root when storageHandle is provided", async () => {
    const storageHandle: any = {};
    const payload: any = {
      groupId: "g1",
      messages: [],
      provider: "p1",
      storageHandle,
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });
    (mockParseResponse as any).mockReturnValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "done" }],
    });

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    expect(mockSetStorageRoot).toHaveBeenCalledWith(storageHandle);
  });

  it("should call withRetry for LLM API calls", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "hi" }],
      provider: "p1",
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });
    (mockBuildHeaders as any).mockReturnValue({ Auth: "key" });
    (mockParseResponse as any).mockReturnValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "ok" }],
    });

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({} as any),
    });

    await handleInvoke({} as any, payload);

    // withRetry should have been called with the fetch function and retry options
    expect(mockWithRetry).toHaveBeenCalledTimes(1);
    expect(mockWithRetry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxRetries: 3,
        baseDelayMs: 2000,
        shouldRetry: expect.any(Function),
        onRetry: expect.any(Function),
      }),
    );
  });

  describe("streaming support gating", () => {
    it("should fall back to non-streaming when provider has supportsStreaming: false", async () => {
      const payload: any = {
        groupId: "g1",
        messages: [{ role: "user", content: "hi" }],
        provider: "bedrock_proxy",
        streaming: true,
      };

      (mockGetProvider as any).mockReturnValue({
        name: "AWS Bedrock (Local Proxy)",
        baseUrl: "http://localhost:8888/bedrock-proxy/invoke",
        format: "anthropic",
        supportsStreaming: false,
      });

      (mockFormatRequest as any).mockReturnValue({ body: "req" });
      (mockBuildHeaders as any).mockReturnValue({} as any);
      (mockParseResponse as any).mockReturnValue({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "hello from bedrock" }],
      });

      (global as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: (jest.fn() as any).mockResolvedValue({} as any),
      });

      await handleInvoke({} as any, payload);

      // Should use withRetry (non-streaming path) not streaming
      expect(mockWithRetry).toHaveBeenCalledTimes(1);

      // Should NOT send any streaming messages
      const streamingMessages = mockPost.mock.calls.filter(([msg]) =>
        ["streaming-start", "streaming-chunk", "streaming-done"].includes(
          msg.type,
        ),
      );
      expect(streamingMessages).toHaveLength(0);

      // Should send normal response
      expect(mockPost).toHaveBeenCalledWith({
        type: "response",
        payload: { groupId: "g1", text: "hello from bedrock" },
      });
    });

    it("should fall back to non-streaming when supportsStreaming is undefined", async () => {
      const payload: any = {
        groupId: "g1",
        messages: [{ role: "user", content: "hi" }],
        provider: "p1",
        streaming: true,
      };

      // No supportsStreaming property at all
      (mockGetProvider as any).mockReturnValue({
        name: "P1",
        baseUrl: "http://p1",
        format: "openai",
      });

      (mockFormatRequest as any).mockReturnValue({ body: "req" });
      (mockBuildHeaders as any).mockReturnValue({} as any);
      (mockParseResponse as any).mockReturnValue({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "ok" }],
      });

      (global as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: (jest.fn() as any).mockResolvedValue({} as any),
      });

      await handleInvoke({} as any, payload);

      // Should use withRetry (non-streaming path)
      expect(mockWithRetry).toHaveBeenCalledTimes(1);
    });

    it("should use streaming when provider has supportsStreaming: true", async () => {
      const payload: any = {
        groupId: "g1",
        messages: [{ role: "user", content: "hi" }],
        provider: "openrouter",
        streaming: true,
        model: "test-model",
      };

      (mockGetProvider as any).mockReturnValue({
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        format: "openai",
        supportsStreaming: true,
      });

      (mockFormatRequest as any).mockReturnValue({ model: "test" });
      (mockBuildHeaders as any).mockReturnValue({
        Authorization: "Bearer key",
      });
      (mockGetContextLimit as any).mockReturnValue(128000);

      // Mock SSE stream with a text chunk and a done signal
      (mockParseSSEStream as any).mockImplementation(async function* () {
        yield {
          choices: [
            {
              delta: { content: "streamed text" },
              finish_reason: null,
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {},
              finish_reason: "stop",
            },
          ],
        };
      });

      // Mock fetch to return a stream-like body. ReadableStream is not
      // available in the Node.js/Jest test environment, but parseSSEStream
      // is already mocked so the body just needs to be truthy.
      (global as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        body: {
          getReader() {
            return {};
          },
        },
      });

      await handleInvoke({} as any, payload);

      // Should NOT use withRetry (streaming path doesn't retry)
      expect(mockWithRetry).not.toHaveBeenCalled();

      // Should send streaming-start
      expect(mockPost).toHaveBeenCalledWith({
        type: "streaming-start",
        payload: { groupId: "g1" },
      });

      // Should send streaming-done with the accumulated text
      expect(mockPost).toHaveBeenCalledWith({
        type: "streaming-done",
        payload: { groupId: "g1", text: "streamed text" },
      });
    });

    it("should log when streaming is requested but provider does not support it", async () => {
      const payload: any = {
        groupId: "g1",
        messages: [{ role: "user", content: "hi" }],
        provider: "bedrock_proxy",
        streaming: true,
        model: "claude-model",
        maxTokens: 4096,
      };

      (mockGetProvider as any).mockReturnValue({
        name: "AWS Bedrock",
        baseUrl: "http://localhost:8888/bedrock-proxy/invoke",
        format: "anthropic",
        supportsStreaming: false,
      });

      (mockFormatRequest as any).mockReturnValue({ body: "req" });
      (mockBuildHeaders as any).mockReturnValue({} as any);
      (mockParseResponse as any).mockReturnValue({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "ok" }],
      });

      (global as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: (jest.fn() as any).mockResolvedValue({} as any),
      });

      await handleInvoke({} as any, payload);

      // The starting log should indicate streaming is off and why
      expect(mockLog).toHaveBeenCalledWith(
        "g1",
        "info",
        "Starting",
        expect.stringContaining("Streaming: off"),
      );

      expect(mockLog).toHaveBeenCalledWith(
        "g1",
        "info",
        "Starting",
        expect.stringContaining("provider does not support streaming"),
      );
    });
  });

  it("should pick up mid-invocation tool updates", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "activate tools and use them" }],
      systemPrompt: "original prompt",
      assistantName: "ShadowClaw",
      memory: "memory content",
      provider: "p1",
      enabledTools: [],
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
      format: "openai",
    });

    // 1st iteration: returns tool_use (manage_tools)
    mockFormatRequest.mockReturnValueOnce({ body: "req1" });
    mockParseResponse.mockReturnValueOnce({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "manage_tools",
          input: { action: "activate_profile", profile_id: "full" },
        },
      ],
    });

    // 2nd iteration: returns final response
    mockFormatRequest.mockReturnValueOnce({ body: "req2" });
    mockParseResponse.mockReturnValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Tools activated and used." }],
    });

    mockExecuteTool.mockResolvedValue("Tool management request sent");

    // Simulate tool state update appearing BEFORE the 2nd iteration
    mockGetToolState
      .mockReturnValueOnce(undefined) // 1st iteration loop start
      .mockReturnValueOnce({
        // 2nd iteration loop start
        enabledTools: [{ name: "new_tool", description: "A new tool" }],
        systemPromptOverride: "overridden prompt",
      });

    mockBuildSystemPrompt.mockReturnValue("new built prompt");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({}),
    });

    await handleInvoke({} as any, payload);

    // Verify system prompt was rebuilt for the 2nd iteration
    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(
      "ShadowClaw",
      "memory content",
      [{ name: "new_tool", description: "A new tool" }],
      "overridden prompt",
      undefined,
      undefined,
      { groupId: "g1" },
    );

    // Verify 2nd iteration used the NEW prompt and tools
    expect(mockFormatRequest).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.anything(),
      [{ name: "new_tool", description: "A new tool" }],
      expect.objectContaining({ system: "new built prompt" }),
    );

    expect(mockClearToolState).toHaveBeenCalledWith("g1");
  });

  it("should respect empty enabledTools array", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "hi" }],
      provider: "p1",
      enabledTools: [], // Explicitly empty
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
      format: "openai",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });
    (mockParseResponse as any).mockReturnValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "hello" }],
    });

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({}),
    });

    await handleInvoke({} as any, payload);

    // Verify formatRequest was called with an empty tools array, NOT the default TOOL_DEFINITIONS
    expect(mockFormatRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      [], // Empty tools
      expect.anything(),
    );
  });

  it("should block tool_use calls for disabled tools", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "use fetch_url" }],
      provider: "p1",
      enabledTools: [],
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
      format: "openai",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "req" });

    (mockParseResponse as any).mockReturnValueOnce({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "fetch_url",
          input: { url: "https://www.google.com" },
        },
      ],
    });

    (mockParseResponse as any).mockReturnValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Cannot run tools right now." }],
    });

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({}),
    });

    await handleInvoke({} as any, payload);

    expect(mockExecuteTool).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith({
      type: "response",
      payload: { groupId: "g1", text: "Cannot run tools right now." },
    });
  });

  it("filters out BROWSER_ONLY_TOOLS in headless mode", async () => {
    const { setHeadlessMode } = await import("../../config/headless.js");
    setHeadlessMode(true);

    try {
      const payload: any = {
        groupId: "server:main",
        messages: [{ role: "user", content: "what tools" }],
        provider: "p1",
        enabledTools: [
          { name: "read_file", description: "Read files" },
          { name: "render_component", description: "Render component" },
          { name: "clear_chat", description: "Clear chat" },
          { name: "bash", description: "Bash" },
        ],
      };

      (mockGetProvider as any).mockReturnValue({
        name: "P1",
        baseUrl: "http://p1",
        format: "openai",
      });
      (mockFormatRequest as any).mockReturnValue({ body: "req" });
      (mockParseResponse as any).mockReturnValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Here are the tools" }],
      });

      (global as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: (jest.fn() as any).mockResolvedValue({}),
      });

      await handleInvoke({} as any, payload);

      // Verify formatRequest was called with browser-only tools filtered out
      expect(mockFormatRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        [
          { name: "read_file", description: "Read files" },
          { name: "bash", description: "Bash" },
        ],
        expect.anything(),
      );
    } finally {
      const { setHeadlessMode } = await import("../../config/headless.js");
      setHeadlessMode(false);
    }
  });

  it("executes in-process node transformers completion in headless mode for transformers_js_local", async () => {
    const { setHeadlessMode } = await import("../../config/headless.js");
    const { setTransformersServiceForTests } =
      await import("../tools/node-transformers-executor.js");

    setHeadlessMode(true);
    const mockService = {
      runChatCompletion: jest.fn(async () => ({
        text: "Direct node result",
        promptTokens: 10,
        completionTokens: 5,
      })),
    };
    setTransformersServiceForTests(mockService as any);

    try {
      const payload: any = {
        groupId: "server:main",
        messages: [{ role: "user", content: "test in process" }],
        provider: "transformers_js_local",
        model: "onnx-community/Qwen3-0.6B-ONNX",
      };

      (mockGetProvider as any).mockReturnValue({
        id: "transformers_js_local",
        name: "Transformers.js (Local Proxy)",
        baseUrl: "http://localhost:8888/v1/chat/completions",
        format: "openai",
      });

      (mockParseResponse as any).mockImplementation((_p: any, raw: any) => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: raw.choices[0].message.content }],
      }));

      // Ensure fetch is NOT called
      const fetchSpy = jest.fn();
      (global as any).fetch = fetchSpy;

      await handleInvoke({} as any, payload);

      expect(mockService.runChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "onnx-community/Qwen3-0.6B-ONNX",
        }),
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith({
        type: "response",
        payload: { groupId: "server:main", text: "Direct node result" },
      });
    } finally {
      setHeadlessMode(false);
      setTransformersServiceForTests(null);
      const { setNodeTransformersCompletionExecutor } =
        await import("./handleInvoke.js");
      setNodeTransformersCompletionExecutor(null);
    }
  });

  it("forwards currentTools to in-process node transformers executor in headless mode", async () => {
    const { setHeadlessMode } = await import("../../config/headless.js");
    const { setTransformersServiceForTests } =
      await import("../tools/node-transformers-executor.js");

    setHeadlessMode(true);
    const mockService = {
      runChatCompletion: jest.fn(async () => ({
        text: "Direct node result",
        promptTokens: 10,
        completionTokens: 5,
      })),
    };
    setTransformersServiceForTests(mockService as any);

    try {
      const payload: any = {
        groupId: "server:main",
        messages: [{ role: "user", content: "What is the weather?" }],
        provider: "transformers_js_local",
        model: "onnx-community/Qwen3-0.6B-ONNX",
        enabledTools: [
          { name: "fetch_url", description: "Fetch a URL", input_schema: {} },
        ],
      };

      (mockGetProvider as any).mockReturnValue({
        id: "transformers_js_local",
        name: "Transformers.js (Local Proxy)",
        baseUrl: "http://localhost:8888/v1/chat/completions",
        format: "openai",
      });

      (mockParseResponse as any).mockImplementation((_p: any, raw: any) => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: raw.choices[0].message.content }],
      }));

      await handleInvoke({} as any, payload);

      // The tools from the payload must be forwarded to the runtime service
      expect(mockService.runChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "onnx-community/Qwen3-0.6B-ONNX",
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: "function",
              function: expect.objectContaining({ name: "fetch_url" }),
            }),
          ]),
        }),
      );
    } finally {
      setHeadlessMode(false);
      setTransformersServiceForTests(null);
      const { setNodeTransformersCompletionExecutor } =
        await import("./handleInvoke.js");
      setNodeTransformersCompletionExecutor(null);
    }
  });

  it("converts Gemma call: tool response into OpenAI tool_calls for headless transformers executor", async () => {
    const { setHeadlessMode } = await import("../../config/headless.js");
    const { setTransformersServiceForTests } =
      await import("../tools/node-transformers-executor.js");

    setHeadlessMode(true);
    const mockService = {
      runChatCompletion: jest.fn(async () => ({
        // Gemma 4 emits this after special-token stripping
        text: 'call:fetch_url{"url":"https://wttr.in/Chicago?format=j1"}',
        promptTokens: 20,
        completionTokens: 15,
      })),
    };
    setTransformersServiceForTests(mockService as any);

    try {
      const payload: any = {
        groupId: "server:main",
        messages: [
          { role: "user", content: "What is the weather in Chicago?" },
        ],
        provider: "transformers_js_local",
        model: "onnx-community/gemma-4-E2B-it-ONNX",
        enabledTools: [
          {
            name: "fetch_url",
            description: "Fetch a URL and return response body.",
            input_schema: {
              type: "object",
              properties: { url: { type: "string" } },
              required: ["url"],
            },
          },
        ],
      };

      (mockGetProvider as any).mockReturnValue({
        id: "transformers_js_local",
        name: "Transformers.js (Local Proxy)",
        baseUrl: "http://localhost:8888/v1/chat/completions",
        format: "openai",
      });

      (mockParseResponse as any).mockImplementation((_p: any, raw: any) => {
        const choice = raw.choices?.[0];
        if (choice?.finish_reason === "tool_calls") {
          return {
            stop_reason: "tool_use",
            content: [
              {
                type: "tool_use",
                id: choice.message.tool_calls[0].id,
                name: choice.message.tool_calls[0].function.name,
                input: JSON.parse(
                  choice.message.tool_calls[0].function.arguments,
                ),
              },
            ],
          };
        }
        return {
          stop_reason: "end_turn",
          content: [{ type: "text", text: choice?.message?.content }],
        };
      });

      await handleInvoke({} as any, payload);

      // parseResponse must have received the structured tool_calls response
      expect(mockParseResponse).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              finish_reason: "tool_calls",
              message: expect.objectContaining({
                tool_calls: expect.arrayContaining([
                  expect.objectContaining({
                    type: "function",
                    function: expect.objectContaining({
                      name: "fetch_url",
                      arguments: JSON.stringify({
                        url: "https://wttr.in/Chicago?format=j1",
                      }),
                    }),
                  }),
                ]),
              }),
            }),
          ]),
        }),
      );
    } finally {
      setHeadlessMode(false);
      setTransformersServiceForTests(null);
      const { setNodeTransformersCompletionExecutor } =
        await import("./handleInvoke.js");
      setNodeTransformersCompletionExecutor(null);
    }
  });

  it("streams in-process node transformers completion in headless mode when streaming is enabled", async () => {
    const { setHeadlessMode } = await import("../../config/headless.js");
    const { setTransformersServiceForTests } =
      await import("../tools/node-transformers-executor.js");

    setHeadlessMode(true);
    const mockService = {
      runChatCompletion: jest.fn(async (opts: any) => {
        if (opts.onProgress) {
          opts.onProgress({
            status: "progress",
            progress: 0.5,
            file: "model.onnx",
          });
        }
        if (opts.onToken) {
          opts.onToken("Hello");
          opts.onToken(" world");
        }
        return {
          text: "Hello world",
          promptTokens: 5,
          completionTokens: 2,
        };
      }),
    };
    setTransformersServiceForTests(mockService as any);

    try {
      const payload: any = {
        groupId: "server:main",
        messages: [{ role: "user", content: "stream test" }],
        provider: "transformers_js_local",
        model: "onnx-community/Qwen3-0.6B-ONNX",
        streaming: true,
      };

      (mockGetProvider as any).mockReturnValue({
        id: "transformers_js_local",
        name: "Transformers.js (Local Proxy)",
        baseUrl: "http://localhost:8888/v1/chat/completions",
        format: "openai",
        supportsStreaming: true,
      });

      (mockParseResponse as any).mockImplementation((_p: any, raw: any) => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: raw.choices[0].message.content }],
      }));

      await handleInvoke({} as any, payload);

      expect(mockPost).toHaveBeenCalledWith({
        type: "streaming-start",
        payload: { groupId: "server:main" },
      });
      expect(mockPost).toHaveBeenCalledWith({
        type: "streaming-chunk",
        payload: { groupId: "server:main", text: "Hello" },
      });
      expect(mockPost).toHaveBeenCalledWith({
        type: "streaming-chunk",
        payload: { groupId: "server:main", text: " world" },
      });
      expect(mockPost).toHaveBeenCalledWith({
        type: "status",
        payload: {
          groupId: "server:main",
          label: "Model Progress",
          message: "model.onnx: 50%",
        },
      });
      expect(mockPost).toHaveBeenCalledWith({
        type: "streaming-done",
        payload: { groupId: "server:main", text: "Hello world" },
      });
      expect(mockPost).toHaveBeenCalledWith({
        type: "response",
        payload: { groupId: "server:main", text: "Hello world" },
      });
    } finally {
      setHeadlessMode(false);
      setTransformersServiceForTests(null);
      const { setNodeTransformersCompletionExecutor } =
        await import("./handleInvoke.js");
      setNodeTransformersCompletionExecutor(null);
    }
  });

  it("accurately formats Transformers.js 0..100 percentages without exceeding 100%", async () => {
    const { setHeadlessMode } = await import("../../config/headless.js");
    const { setTransformersServiceForTests } =
      await import("../tools/node-transformers-executor.js");

    setHeadlessMode(true);
    const mockService = {
      runChatCompletion: jest.fn(async (opts: any) => {
        if (opts.onProgress) {
          opts.onProgress({
            status: "progress",
            progress: 93.39,
            file: "tokenizer.json",
          });
          opts.onProgress({
            status: "progress",
            progress: 100,
            file: "tokenizer.json",
          });
          opts.onProgress({ status: "progress_total", progress: 100 });
        }
        return {
          text: "Done",
          promptTokens: 2,
          completionTokens: 1,
        };
      }),
    };
    setTransformersServiceForTests(mockService as any);

    try {
      const payload: any = {
        groupId: "server:main",
        messages: [{ role: "user", content: "test pct" }],
        provider: "transformers_js_local",
        model: "onnx-community/Qwen3-0.6B-ONNX",
        streaming: false,
      };

      (mockGetProvider as any).mockReturnValue({
        id: "transformers_js_local",
        name: "Transformers.js (Local Proxy)",
        baseUrl: "http://localhost:8888/v1/chat/completions",
        format: "openai",
      });

      (mockParseResponse as any).mockImplementation((_p: any, raw: any) => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: raw.choices[0].message.content }],
      }));

      await handleInvoke({} as any, payload);

      expect(mockPost).toHaveBeenCalledWith({
        type: "status",
        payload: {
          groupId: "server:main",
          label: "Model Progress",
          message: "tokenizer.json: 93%",
        },
      });
      expect(mockPost).toHaveBeenCalledWith({
        type: "status",
        payload: {
          groupId: "server:main",
          label: "Model Progress",
          message: "tokenizer.json: 100%",
        },
      });
      expect(mockPost).toHaveBeenCalledWith({
        type: "status",
        payload: {
          groupId: "server:main",
          label: "Model Progress",
          message: "onnx-community/Qwen3-0.6B-ONNX: 100%",
        },
      });
    } finally {
      setHeadlessMode(false);
      setTransformersServiceForTests(null);
      const { setNodeTransformersCompletionExecutor } =
        await import("./handleInvoke.js");
      setNodeTransformersCompletionExecutor(null);
    }
  });
});
