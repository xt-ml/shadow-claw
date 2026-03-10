import { jest } from "@jest/globals";

describe("handleInvoke.mjs", () => {
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
  let mockPost;
  let mockSetStorageRoot;

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

    jest.unstable_mockModule("../config.mjs", () => ({
      getProvider: mockGetProvider,
    }));

    jest.unstable_mockModule("../providers.mjs", () => ({
      buildHeaders: mockBuildHeaders,
      formatRequest: mockFormatRequest,
      getContextLimit: mockGetContextLimit,
      parseResponse: mockParseResponse,
    }));

    jest.unstable_mockModule("../storage/storage.mjs", () => ({
      setStorageRoot: mockSetStorageRoot,
    }));

    jest.unstable_mockModule("../tools.mjs", () => ({
      TOOL_DEFINITIONS: [],
    }));

    jest.unstable_mockModule("./createTokenUsageMessage.mjs", () => ({
      createTokenUsageMessage: mockCreateTokenUsageMessage,
    }));

    jest.unstable_mockModule("./createToolActivityMessage.mjs", () => ({
      createToolActivityMessage: mockCreateToolActivityMessage,
    }));

    jest.unstable_mockModule("./executeTool.mjs", () => ({
      executeTool: mockExecuteTool,
    }));

    jest.unstable_mockModule("./log.mjs", () => ({
      log: mockLog,
    }));

    jest.unstable_mockModule("./post.mjs", () => ({
      post: mockPost,
    }));

    const module = await import("./handleInvoke.mjs");
    handleInvoke = module.handleInvoke;
  });

  it("should handle simple response successfully", async () => {
    const payload = {
      groupId: "g1",
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "sys",
      apiKey: "key",
      model: "m1",
      maxTokens: 100,
      provider: "p1",
    };

    mockGetProvider.mockReturnValue({ name: "P1", baseUrl: "http://p1" });
    mockFormatRequest.mockReturnValue({ body: "req" });
    mockBuildHeaders.mockReturnValue({ Auth: "key" });
    mockParseResponse.mockReturnValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "hello" }],
      usage: { input: 10, output: 5 },
    });

    mockGetContextLimit.mockReturnValue(1000);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    await handleInvoke({}, payload);

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({ type: "usage" }),
    );

    expect(mockPost).toHaveBeenCalledWith({
      type: "response",
      payload: { groupId: "g1", text: "hello" },
    });
  });

  it("should handle tool-use loop", async () => {
    const payload = {
      groupId: "g1",
      messages: [{ role: "user", content: "do it" }],
      provider: "p1",
    };

    mockGetProvider.mockReturnValue({ name: "P1", baseUrl: "http://p1" });
    mockFormatRequest.mockReturnValue({ body: "req" });

    // First call returns tool_use
    mockParseResponse.mockReturnValueOnce({
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t1", name: "tool1", input: { arg: 1 } },
      ],
    });

    // Second call returns final text
    mockParseResponse.mockReturnValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "done" }],
    });

    mockExecuteTool.mockResolvedValue("tool output");

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    await handleInvoke({}, payload);

    expect(mockExecuteTool).toHaveBeenCalledWith({}, "tool1", { arg: 1 }, "g1");
    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response",
        payload: { groupId: "g1", text: "done" },
      }),
    );
  });

  it("should prevent infinite loops with identical tool calls", async () => {
    const payload = {
      groupId: "g1",
      provider: "p1",
      messages: [{ role: "user", content: "loop" }],
    };

    mockGetProvider.mockReturnValue({ name: "P1", baseUrl: "http://p1" });

    // Always return tool_use with same input
    mockParseResponse.mockReturnValue({
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t1", name: "tool1", input: { arg: 1 } },
      ],
    });

    mockExecuteTool.mockResolvedValue("output");

    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({}) });

    // Mock console.warn to suppress it
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await handleInvoke({}, payload);

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
    mockGetProvider.mockReturnValue({ name: "P1", baseUrl: "http://p1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue("Unauthorized"),
    });

    await handleInvoke({}, { groupId: "g1", provider: "p1", messages: [] });
    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: {
        groupId: "g1",
        error: expect.stringContaining("API error 401"),
      },
    });
  });

  it("should reach max iterations", async () => {
    const payload = {
      groupId: "g1",
      provider: "p1",
      messages: [{ role: "user", content: "many" }],
    };

    mockGetProvider.mockReturnValue({ name: "P1", baseUrl: "http://p1" });

    // Always return tool_use, but with DIFFERENT inputs to avoid loop prevention
    let count = 0;
    mockParseResponse.mockImplementation(() => ({
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

    mockExecuteTool.mockResolvedValue("output");

    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({}) });

    await handleInvoke({}, payload);

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
    const payload = {
      groupId: "g1",
      provider: "unknown-provider",
      messages: [],
    };

    mockGetProvider.mockReturnValue(null);

    await handleInvoke({}, payload);

    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: { groupId: "g1", error: "Unknown provider: unknown-provider" },
    });

    expect(mockLog).not.toHaveBeenCalled();
  });

  it("should set storage root when storageHandle is provided", async () => {
    const storageHandle = {};
    const payload = {
      groupId: "g1",
      messages: [],
      provider: "p1",
      storageHandle,
    };

    mockGetProvider.mockReturnValue({ name: "P1", baseUrl: "http://p1" });
    mockFormatRequest.mockReturnValue({ body: "req" });
    mockParseResponse.mockReturnValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "done" }],
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    await handleInvoke({}, payload);

    expect(mockSetStorageRoot).toHaveBeenCalledWith(storageHandle);
  });
});
