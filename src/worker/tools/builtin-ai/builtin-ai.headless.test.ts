import { jest } from "@jest/globals";

const mockExecuteNativeAiTask = jest.fn<any>();
jest.unstable_mockModule(
  "../../../subsystems/providers/executeNativeAiTask.js",
  () => ({
    executeNativeAiTask: mockExecuteNativeAiTask,
  }),
);

let executeRewriteText: any;
let executeSummarizeText: any;
let executeWriteText: any;
let setHeadlessMode: any;
let setNativeAiTaskHandler: any;

describe("builtin-ai in headless mode", () => {
  beforeAll(async () => {
    const headlessMod = await import("../../../config/headless.js");
    setHeadlessMode = headlessMod.setHeadlessMode;

    const mod = await import("./builtin-ai.js");
    executeRewriteText = mod.executeRewriteText;
    executeSummarizeText = mod.executeSummarizeText;
    executeWriteText = mod.executeWriteText;
    setNativeAiTaskHandler = mod.setNativeAiTaskHandler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setHeadlessMode(true);
    setNativeAiTaskHandler(null);
  });

  afterAll(() => {
    setHeadlessMode(false);
  });

  it("executes rewrite_text directly via executeNativeAiTask in headless mode", async () => {
    mockExecuteNativeAiTask.mockResolvedValue("Rewritten text from provider");

    const result = await executeRewriteText(
      { text: "how are you doing", tone: "more-casual" },
      "server:main",
      {
        invokeContext: {
          provider: "openrouter",
          model: "openrouter/free",
          apiKey: "test-key",
        },
      },
    );

    expect(result).toBe("Rewritten text from provider");
    expect(mockExecuteNativeAiTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: "rewrite",
        input: expect.objectContaining({
          text: "how are you doing",
          tone: "more-casual",
        }),
        providerId: "openrouter",
        model: "openrouter/free",
        apiKey: "test-key",
      }),
    );
  });

  it("executes write_text directly via executeNativeAiTask in headless mode", async () => {
    mockExecuteNativeAiTask.mockResolvedValue("Generated story text");

    const result = await executeWriteText(
      { prompt: "Tell a short story" },
      "server:main",
    );

    expect(result).toBe("Generated story text");
    expect(mockExecuteNativeAiTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: "write",
        input: expect.objectContaining({ prompt: "Tell a short story" }),
      }),
    );
  });

  it("handles errors gracefully in headless mode and returns an error string", async () => {
    mockExecuteNativeAiTask.mockRejectedValue(
      new Error("Provider openrouter requires an API key"),
    );

    const result = await executeRewriteText(
      { text: "how are you doing" },
      "server:main",
    );

    expect(result).toBe(
      "Error rewriting text: Provider openrouter requires an API key",
    );
  });

  it("allows customNativeAiTaskHandler to override execution", async () => {
    const customHandler = jest
      .fn<any>()
      .mockResolvedValue("Custom handler output");
    setNativeAiTaskHandler(customHandler);

    const result = await executeSummarizeText(
      { text: "Long text" },
      "server:main",
    );

    expect(result).toBe("Custom handler output");
    expect(customHandler).toHaveBeenCalledWith(
      "summarize",
      expect.objectContaining({ text: "Long text" }),
      "server:main",
      undefined,
    );
    expect(mockExecuteNativeAiTask).not.toHaveBeenCalled();
  });
});
