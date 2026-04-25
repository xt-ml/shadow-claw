// @ts-nocheck
import { jest } from "@jest/globals";

describe("handleCompact.js", () => {
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

    jest.unstable_mockModule("../config.js", () => ({
      getProvider: mockGetProvider,
    }));

    jest.unstable_mockModule("../providers.js", () => ({
      buildHeaders: mockBuildHeaders,
      formatRequest: mockFormatRequest,
      parseResponse: mockParseResponse,
    }));

    jest.unstable_mockModule("../storage/storage.js", () => ({
      setStorageRoot: mockSetStorageRoot,
    }));

    jest.unstable_mockModule("./getCompactionMessages.js", () => ({
      getCompactionMessages: mockGetCompactionMessages,
    }));

    jest.unstable_mockModule("./getCompactionSystemPrompt.js", () => ({
      getCompactionSystemPrompt: mockGetCompactionSystemPrompt,
    }));

    jest.unstable_mockModule("./log.js", () => ({
      log: mockLog,
    }));

    jest.unstable_mockModule("./post.js", () => ({
      post: mockPost,
    }));

    const module = await import("./handleCompact.js");
    handleCompact = module.handleCompact;
  });

  it("should handle context compaction successfully", async () => {
    const payload: any = {
      groupId: "g1",
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "sys",
      apiKey: "key",
      model: "m1",
      maxTokens: 100,
      provider: "p1",
      storageHandle: "h1",
    };

    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });
    (mockFormatRequest as any).mockReturnValue({ body: "request" });
    (mockBuildHeaders as any).mockReturnValue({ Authorization: "Bearer key" });
    (mockParseResponse as any).mockReturnValue({
      content: [{ type: "text", text: "summary" }],
    });

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: (jest.fn() as any).mockResolvedValue({ raw: "result" }),
    });

    await handleCompact({} as any, payload);

    expect(mockSetStorageRoot).toHaveBeenCalledWith("h1");

    expect(mockLog).toHaveBeenCalledWith(
      "g1",
      "info",
      "Compacting context",
      expect.any(String),
    );

    expect((global as any).fetch).toHaveBeenCalledWith(
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
    (mockGetProvider as any).mockReturnValue(null);

    await handleCompact({} as any, { groupId: "g1", provider: "unknown" });

    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: { groupId: "g1", error: "Unknown provider: unknown" },
    });
  });

  it("should handle fetch error", async () => {
    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: false,
      status: 500,
      text: (jest.fn() as any).mockResolvedValue("Internal Server Error"),
    });

    await handleCompact({} as any, {
      groupId: "g1",
      provider: "p1",
      messages: [],
    });

    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: {
        groupId: "g1",
        error: expect.stringContaining("API error 500"),
      },
    });
  });

  it("should handle generic error", async () => {
    (mockGetProvider as any).mockReturnValue({
      name: "P1",
      baseUrl: "http://p1",
    });

    (global as any).fetch = jest
      .fn()
      .mockRejectedValue(new Error("network fail"));

    await handleCompact({} as any, {
      groupId: "g1",
      provider: "p1",
      messages: [],
    });

    expect(mockPost).toHaveBeenCalledWith({
      type: "error",
      payload: { groupId: "g1", error: "Compaction failed: network fail" },
    });
  });
});
