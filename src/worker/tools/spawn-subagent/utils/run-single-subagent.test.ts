import { jest } from "@jest/globals";

const mockGetConfig = jest.fn<any>().mockResolvedValue("enabled");
jest.unstable_mockModule("../../../../db/get-config.js", () => ({
  getConfig: mockGetConfig,
}));

const mockDecryptValue = jest.fn<any>(async (val: string) => {
  if (val === "throw") throw new Error("Decrypt error");
  return val ? `decrypted-${val}` : "";
});
jest.unstable_mockModule("../../../../security/crypto.js", () => ({
  decryptValue: mockDecryptValue,
}));

const mockSummarizeText = jest
  .fn<any>()
  .mockResolvedValue("* Summary of long report content");
jest.unstable_mockModule(
  "../../../../subsystems/providers/builtin-ai-tasks.js",
  () => ({
    summarizeText: mockSummarizeText,
    translateText: jest.fn<any>().mockResolvedValue("Translated text"),
    rewriteText: jest.fn<any>().mockResolvedValue("Rewritten text"),
    detectLanguage: jest.fn<any>().mockResolvedValue([{ language: "en" }]),
  }),
);

const { post } = await import("../../../utils/post.js");

describe("runSingleSubagent", () => {
  let mockCtx: any;
  let runSingleSubagent: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetConfig.mockResolvedValue("enabled");

    mockCtx = {
      db: {},
      apiKey: "test-key",
      model: "gpt-4o",
      provider: "openrouter",
      maxTokens: 4096,
      subagentMaxTokens: 2048,
      providerHeaders: {},
      streaming: false,
      enabledTools: [
        { name: "summarize_text", description: "Summarize text" },
        { name: "translate_text", description: "Translate text" },
        { name: "spawn_subagent", description: "Spawn subagent" },
      ],
      assistantName: "ShadowClaw",
      memory: "",
      systemPrompt: "System prompt",
      invokeSubagent: jest
        .fn<any>()
        .mockImplementation(async (payload: any) => {
          post({
            type: "response",
            payload: { groupId: payload.groupId, text: "Subagent answer" },
          });
        }),
    };

    const mod = await import("./run-single-subagent.js");
    runSingleSubagent = mod.runSingleSubagent;
  });

  it("short-circuits to summarizeText when prompt requests summarization and task routing is enabled", async () => {
    const spec = {
      prompt: "summarize: Long report content goes here...",
      tools: ["summarize_text"],
    };

    const result = await runSingleSubagent(spec, mockCtx, {
      parentGroupId: "parent-group",
      workspaceMode: "parent",
    });

    expect(result).toBe("* Summary of long report content");
  });

  it("falls back to standard subagent execution if summarizeText throws", async () => {
    mockSummarizeText.mockRejectedValueOnce(
      new Error("Summarizer unavailable"),
    );

    const spec = {
      prompt: "tldr: Some content",
    };

    const result = await runSingleSubagent(spec, mockCtx, {
      parentGroupId: "parent-group",
      workspaceMode: "parent",
    });

    expect(result).toBe("Subagent answer");
  });

  it("invokes subagent normally and returns response text", async () => {
    const spec = {
      prompt: "Research the history of computing and write a markdown summary.",
    };

    const result = await runSingleSubagent(spec, mockCtx, {
      parentGroupId: "parent-group",
      workspaceMode: "parent",
    });

    expect(mockCtx.invokeSubagent).toHaveBeenCalled();
    expect(result).toBe("Subagent answer");
  });

  it("returns error message when subagent posts an error", async () => {
    mockCtx.invokeSubagent = jest
      .fn<any>()
      .mockImplementation(async (payload: any) => {
        post({
          type: "error",
          payload: { groupId: payload.groupId, error: "Model quota exceeded" },
        });
      });

    const result = await runSingleSubagent({ prompt: "Do task" }, mockCtx, {
      parentGroupId: "parent-group",
      workspaceMode: "parent",
    });

    expect(result).toBe("Subagent error: Model quota exceeded");
  });

  it("returns (no response) when subagent posts no messages", async () => {
    mockCtx.invokeSubagent = jest.fn<any>().mockResolvedValue(undefined);

    const result = await runSingleSubagent({ prompt: "Do task" }, mockCtx, {
      parentGroupId: "parent-group",
      workspaceMode: "parent",
    });

    expect(result).toBe("(no response)");
  });

  it("catches errors thrown during invokeSubagent", async () => {
    mockCtx.invokeSubagent = jest
      .fn<any>()
      .mockRejectedValue(new Error("Worker failure"));

    const result1 = await runSingleSubagent({ prompt: "Do task" }, mockCtx, {
      parentGroupId: "parent-group",
      workspaceMode: "parent",
    });
    expect(result1).toBe("Subagent error: Worker failure");

    // Non-Error exception
    mockCtx.invokeSubagent = jest
      .fn<any>()
      .mockRejectedValue("Fatal crash string");
    const result2 = await runSingleSubagent({ prompt: "Do task" }, mockCtx, {
      parentGroupId: "parent-group",
      workspaceMode: "parent",
    });
    expect(result2).toBe("Subagent error: Fatal crash string");
  });

  it("resolves various workspace modes and custom workspace group IDs", async () => {
    // 1. workspaceMode: "isolated"
    await runSingleSubagent({ prompt: "task" }, mockCtx, {
      parentGroupId: "parent-1",
      workspaceMode: "isolated",
    });
    let payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.workspaceGroupId).toContain("subagent:");

    // 2. workspaceMode: "automatic" with requestedWorkspaceGroupId "parent"
    mockCtx.invokeSubagent.mockClear();
    await runSingleSubagent(
      { prompt: "task", workspace_group_id: "parent" },
      mockCtx,
      {
        parentGroupId: "parent-1",
        workspaceMode: "automatic",
      },
    );
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.workspaceGroupId).toBe("parent-1");

    // 3. workspaceMode: "automatic" with custom workspace_group_id
    mockCtx.invokeSubagent.mockClear();
    await runSingleSubagent(
      { prompt: "task", workspace_group_id: "custom-ws" },
      mockCtx,
      {
        parentGroupId: "parent-1",
        workspaceMode: "automatic",
      },
    );
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.workspaceGroupId).toBe("custom-ws");

    // 4. workspaceMode: "automatic" with empty workspace_group_id
    mockCtx.invokeSubagent.mockClear();
    await runSingleSubagent(
      { prompt: "task", workspace_group_id: "" },
      mockCtx,
      {
        parentGroupId: "parent-1",
        workspaceMode: "automatic",
      },
    );
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.workspaceGroupId).toContain("subagent:");
  });

  it("resolves API keys and provider headers with fallbacks", async () => {
    // When spec.provider differs from ctx.provider, it resolves via resolveProviderApiKey
    mockCtx.provider = "anthropic";
    mockGetConfig.mockImplementation(async (_db: any, key: string) => {
      if (key === "api_key") return "legacy-encrypted-key";
      if (key === "mesh_llm_host") return "https://mesh.local";
      if (key === "llamafile_mode") return "server";
      if (key === "bedrock_region_fallback") return "us-east-1";
      return undefined;
    });

    await runSingleSubagent(
      { prompt: "task", provider: "openrouter" },
      mockCtx,
      {
        parentGroupId: "parent-1",
        workspaceMode: "parent",
      },
    );

    let payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.apiKey).toBe("decrypted-legacy-encrypted-key");

    // mesh-llm headers
    mockCtx.invokeSubagent.mockClear();
    await runSingleSubagent({ prompt: "task", provider: "mesh-llm" }, mockCtx, {
      parentGroupId: "parent-1",
      workspaceMode: "parent",
    });
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.providerHeaders["x-mesh-llm-host"]).toBe(
      "https://mesh.local",
    );

    // llamafile headers
    mockCtx.invokeSubagent.mockClear();
    await runSingleSubagent(
      { prompt: "task", provider: "llamafile" },
      mockCtx,
      {
        parentGroupId: "parent-1",
        workspaceMode: "parent",
      },
    );
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.providerHeaders["x-llamafile-mode"]).toBe("server");
    expect(payload.providerHeaders["x-llamafile-port"]).toBe("8080");

    // bedrock_proxy headers
    mockCtx.invokeSubagent.mockClear();
    await runSingleSubagent(
      { prompt: "task", provider: "bedrock_proxy" },
      mockCtx,
      {
        parentGroupId: "parent-1",
        workspaceMode: "parent",
      },
    );
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.providerHeaders["x-bedrock-region"]).toBe("us-east-1");

    // Provider that does not require API key (like transformers_js_browser)
    mockCtx.invokeSubagent.mockClear();
    await runSingleSubagent(
      { prompt: "task", provider: "transformers_js_browser" },
      mockCtx,
      {
        parentGroupId: "parent-1",
        workspaceMode: "parent",
      },
    );
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.apiKey).toBe("");

    // Decryption failure
    mockCtx.invokeSubagent.mockClear();
    mockGetConfig.mockImplementation(async (_db: any, key: string) => {
      if (key === "api_key") return "throw";
      return undefined;
    });
    await runSingleSubagent(
      { prompt: "task", provider: "openrouter" },
      mockCtx,
      {
        parentGroupId: "parent-1",
        workspaceMode: "parent",
      },
    );
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.apiKey).toBe("");
  });

  it("filters tools and clamps maxTokens based on model/subagent configs", async () => {
    // Only allow translate_text
    await runSingleSubagent(
      { prompt: "task", tools: ["translate_text", "spawn_subagent"] },
      mockCtx,
      { parentGroupId: "parent-1", workspaceMode: "parent" },
    );

    let payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.enabledTools.map((t: any) => t.name)).toEqual([
      "translate_text",
    ]);

    // Default tools inherit excluding spawn_subagent
    mockCtx.invokeSubagent.mockClear();
    await runSingleSubagent({ prompt: "task" }, mockCtx, {
      parentGroupId: "parent-1",
      workspaceMode: "parent",
    });
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.enabledTools.map((t: any) => t.name)).toEqual([
      "summarize_text",
      "translate_text",
    ]);

    // subagentMaxTokens clamps when provided
    mockCtx.subagentMaxTokens = 1500;
    mockCtx.invokeSubagent.mockClear();
    await runSingleSubagent({ prompt: "task" }, mockCtx, {
      parentGroupId: "parent-1",
      workspaceMode: "parent",
    });
    payload = mockCtx.invokeSubagent.mock.calls[0][0];
    expect(payload.maxTokens).toBe(1500);
  });
});
