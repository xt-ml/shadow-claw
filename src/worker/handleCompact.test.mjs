import { jest } from "@jest/globals";

describe("handleCompact.mjs", () => {
  let handleCompact;
  let mockBuildHeaders;
  let mockFormatRequest;
  let mockGetCompactionMessages;
  let mockGetCompactionSystemPrompt;
  let mockGetProvider;
  let mockLog;
  let mockParseResponse;
  let mockPost;
  let mockSetStorageRoot;

  beforeEach(async () => {
    jest.resetModules();

    mockBuildHeaders = jest.fn();
    mockFormatRequest = jest.fn();
    mockGetCompactionMessages = jest.fn((m) => m);
    mockGetCompactionSystemPrompt = jest.fn((p) => p);
    mockGetProvider = jest.fn();
    mockLog = jest.fn();
    mockParseResponse = jest.fn();
    mockPost = jest.fn();
    mockSetStorageRoot = jest.fn();

    jest.unstable_mockModule("../config.mjs", () => ({
      getProvider: mockGetProvider,
    }));

    jest.unstable_mockModule("../providers.mjs", () => ({
      buildHeaders: mockBuildHeaders,
      formatRequest: mockFormatRequest,
      parseResponse: mockParseResponse,
    }));

    jest.unstable_mockModule("../storage/storage.mjs", () => ({
      setStorageRoot: mockSetStorageRoot,
    }));

    jest.unstable_mockModule("./getCompactionMessages.mjs", () => ({
      getCompactionMessages: mockGetCompactionMessages,
    }));

    jest.unstable_mockModule("./getCompactionSystemPrompt.mjs", () => ({
      getCompactionSystemPrompt: mockGetCompactionSystemPrompt,
    }));

    jest.unstable_mockModule("./log.mjs", () => ({
      log: mockLog,
    }));

    jest.unstable_mockModule("./post.mjs", () => ({
      post: mockPost,
    }));

    const module = await import("./handleCompact.mjs");
    handleCompact = module.handleCompact;
  });

  it("should handle context compaction successfully", async () => {
    const payload = {
      groupId: "g1",
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "sys",
      apiKey: "key",
      model: "m1",
      maxTokens: 100,
      provider: "p1",
      storageHandle: "h1",
    };

    mockGetProvider.mockReturnValue({ name: "P1", baseUrl: "http://p1" });
    mockFormatRequest.mockReturnValue({ body: "request" });
    mockBuildHeaders.mockReturnValue({ Authorization: "Bearer key" });
    mockParseResponse.mockReturnValue({
      content: [{ type: "text", text: "summary" }],
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ raw: "result" }),
    });

    await handleCompact({}, payload);

    expect(mockSetStorageRoot).toHaveBeenCalledWith("h1");

    expect(mockLog).toHaveBeenCalledWith(
      "g1",
      "info",
      "Compacting context",
      expect.any(String),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://p1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ body: "request" }),
      }),
    );

    expect(mockPost).toHaveBeenCalledWith({
      type: "compact-done",
      payload: { groupId: "g1", summary: "summary" },
    });
  });

  it("should handle unknown provider", async () => {
    mockGetProvider.mockReturnValue(null);

    await handleCompact({}, { groupId: "g1", provider: "unknown" });

    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: { groupId: "g1", error: "Unknown provider: unknown" },
    });
  });

  it("should handle fetch error", async () => {
    mockGetProvider.mockReturnValue({ name: "P1", baseUrl: "http://p1" });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue("Internal Server Error"),
    });

    await handleCompact({}, { groupId: "g1", provider: "p1", messages: [] });

    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: {
        groupId: "g1",
        error: expect.stringContaining("API error 500"),
      },
    });
  });

  it("should handle generic error", async () => {
    mockGetProvider.mockReturnValue({ name: "P1", baseUrl: "http://p1" });

    global.fetch = jest.fn().mockRejectedValue(new Error("network fail"));

    await handleCompact({}, { groupId: "g1", provider: "p1", messages: [] });

    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: { groupId: "g1", error: "Compaction failed: network fail" },
    });
  });
});
