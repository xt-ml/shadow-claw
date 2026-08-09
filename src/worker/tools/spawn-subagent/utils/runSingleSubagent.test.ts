import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue("enabled"),
}));

jest.unstable_mockModule(
  "../../../../subsystems/providers/builtin-ai-tasks.js",
  () => ({
    summarizeText: jest
      .fn<any>()
      .mockResolvedValue("* Summary of long report content"),
    translateText: jest.fn<any>().mockResolvedValue("Translated text"),
    rewriteText: jest.fn<any>().mockResolvedValue("Rewritten text"),
    detectLanguage: jest.fn<any>().mockResolvedValue([{ language: "en" }]),
  }),
);

describe("runSingleSubagent", () => {
  let mockCtx: any;
  let runSingleSubagent: any;

  beforeEach(async () => {
    mockCtx = {
      db: {},
      apiKey: "test-key",
      model: "gpt-4o",
      provider: "openrouter",
      maxTokens: 4096,
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
      invokeSubagent: jest.fn<any>().mockResolvedValue(undefined),
    };

    const mod = await import("./runSingleSubagent.js");
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

  it("invokes subagent normally when prompt is a general multi-step instruction", async () => {
    const spec = {
      prompt: "Research the history of computing and write a markdown summary.",
    };

    await runSingleSubagent(spec, mockCtx, {
      parentGroupId: "parent-group",
      workspaceMode: "parent",
    });

    expect(mockCtx.invokeSubagent).toHaveBeenCalled();
  });
});
