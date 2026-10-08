import { jest } from "@jest/globals";

const mockGetProvider = jest.fn<any>();
const mockBuildHeaders = jest.fn<any>();
const mockFormatRequest = jest.fn<any>();
const mockParseResponse = jest.fn<any>();

const mockRewriteText = jest.fn<any>();
const mockSummarizeText = jest.fn<any>();
const mockWriteText = jest.fn<any>();
const mockProofreadText = jest.fn<any>();
const mockDetectLanguage = jest.fn<any>();
const mockTranslateText = jest.fn<any>();
const mockEmbedText = jest.fn<any>();
const mockEnsureBuiltinAiPolyfills = jest.fn<any>();

jest.unstable_mockModule("../../config/config.js", () => ({
  getProvider: mockGetProvider,
  CONFIG_KEYS: {
    BUILTIN_AI_TOOLS_BACKEND: "builtin_ai_tools_backend",
    PROVIDER: "provider",
    MODEL: "model",
  },
}));

jest.unstable_mockModule("./providers.js", () => ({
  buildHeaders: mockBuildHeaders,
  formatRequest: mockFormatRequest,
  parseResponse: mockParseResponse,
}));

jest.unstable_mockModule("./builtin-ai-tasks.js", () => ({
  rewriteText: mockRewriteText,
  summarizeText: mockSummarizeText,
  writeText: mockWriteText,
  proofreadText: mockProofreadText,
  detectLanguage: mockDetectLanguage,
  translateText: mockTranslateText,
  embedText: mockEmbedText,
  ensureBuiltinAiPolyfills: mockEnsureBuiltinAiPolyfills,
}));

let executeNativeAiTask: any;
let buildTaskPrompt: any;

describe("executeNativeAiTask", () => {
  beforeAll(async () => {
    const mod = await import("./executeNativeAiTask.js");
    executeNativeAiTask = mod.executeNativeAiTask;
    buildTaskPrompt = mod.buildTaskPrompt;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureBuiltinAiPolyfills.mockResolvedValue(undefined);
  });

  describe("buildTaskPrompt", () => {
    it("uses overridePrompt directly for summarize task when provided", () => {
      const prompt = buildTaskPrompt("summarize", {
        text: "Long article content",
        overridePrompt: "You are a custom AI summarizer.",
      });
      expect(prompt).toBe(
        "You are a custom AI summarizer.\n\nLong article content",
      );
    });

    it("includes tone, format, and length in write prompt", () => {
      const prompt = buildTaskPrompt("write", {
        prompt: "Draft an invite",
        tone: "formal",
        format: "markdown",
        length: "medium",
      });
      expect(prompt).toContain("tone: formal");
      expect(prompt).toContain("format: markdown");
      expect(prompt).toContain("length: medium");
      expect(prompt).toContain("Draft an invite");
    });

    it("includes tone, format, and length in rewrite prompt", () => {
      const prompt = buildTaskPrompt("rewrite", {
        text: "Rough draft",
        tone: "more-casual",
        format: "plain-text",
        length: "shorter",
      });
      expect(prompt).toContain("tone: more-casual");
      expect(prompt).toContain("format: plain-text");
      expect(prompt).toContain("length: shorter");
      expect(prompt).toContain("Rough draft");
    });
  });

  describe("local tools backend", () => {
    it("calls rewriteText with extended options when toolsBackendPref is local", async () => {
      mockRewriteText.mockResolvedValue("Happy day greeting!");

      const result = await executeNativeAiTask({
        taskType: "rewrite",
        input: {
          text: "how are you doing",
          tone: "more-casual",
          format: "markdown",
          length: "shorter",
          outputLanguage: "es",
        },
        toolsBackendPref: "local",
      });

      expect(result).toBe("Happy day greeting!");
      expect(mockRewriteText).toHaveBeenCalledWith(
        "how are you doing",
        expect.objectContaining({
          tone: "more-casual",
          format: "markdown",
          length: "shorter",
          outputLanguage: "es",
        }),
      );
    });

    it("calls writeText with extended options when toolsBackendPref is local", async () => {
      mockWriteText.mockResolvedValue("Generated story");

      const result = await executeNativeAiTask({
        taskType: "write",
        input: {
          prompt: "Write a poem",
          tone: "formal",
          format: "plain-text",
          length: "short",
          outputLanguage: "fr",
        },
        toolsBackendPref: "local",
      });

      expect(result).toBe("Generated story");
      expect(mockWriteText).toHaveBeenCalledWith(
        "Write a poem",
        expect.objectContaining({
          tone: "formal",
          format: "plain-text",
          length: "short",
          outputLanguage: "fr",
        }),
      );
    });

    it("calls summarizeText with overridePrompt when toolsBackendPref is local", async () => {
      mockSummarizeText.mockResolvedValue("Summary output");

      const result = await executeNativeAiTask({
        taskType: "summarize",
        input: {
          text: "A very long document",
          overridePrompt: "Custom prompt",
        },
        toolsBackendPref: "local",
      });

      expect(result).toBe("Summary output");
      expect(mockSummarizeText).toHaveBeenCalledWith(
        "A very long document",
        expect.objectContaining({
          text: "A very long document",
          overridePrompt: "Custom prompt",
        }),
      );
    });

    it("calls translateText when toolsBackendPref is local", async () => {
      mockTranslateText.mockResolvedValue("Hola");

      const result = await executeNativeAiTask({
        taskType: "translate",
        input: { text: "Hello", sourceLanguage: "en", targetLanguage: "es" },
        toolsBackendPref: "local",
      });

      expect(result).toBe("Hola");
      expect(mockTranslateText).toHaveBeenCalledWith(
        "Hello",
        expect.objectContaining({ sourceLanguage: "en", targetLanguage: "es" }),
      );
    });
  });

  describe("active provider backend", () => {
    it("calls active provider HTTP endpoint with formatted request for rewrite task", async () => {
      mockGetProvider.mockReturnValue({
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        format: "openai",
        requiresApiKey: true,
      });

      mockBuildHeaders.mockReturnValue({ Authorization: "Bearer test-key" });
      mockFormatRequest.mockReturnValue({
        model: "openrouter/free",
        messages: [],
      });

      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] }),
      });
      globalThis.fetch = mockFetch;

      mockParseResponse.mockReturnValue({
        content: [{ type: "text", text: "Hope you're having an awesome day!" }],
      });

      const result = await executeNativeAiTask({
        taskType: "rewrite",
        input: {
          text: "how are you doing this very fine day",
          tone: "more-casual",
        },
        providerId: "openrouter",
        model: "openrouter/free",
        apiKey: "test-key",
      });

      expect(result).toBe("Hope you're having an awesome day!");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        }),
      );
      expect(mockFormatRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Rewrite the following text"),
          }),
        ]),
        [],
        expect.objectContaining({ model: "openrouter/free" }),
      );
    });

    it("throws a clear error if provider requires an API key but none is provided", async () => {
      mockGetProvider.mockReturnValue({
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        format: "openai",
        requiresApiKey: true,
      });

      await expect(
        executeNativeAiTask({
          taskType: "rewrite",
          input: { text: "hello" },
          providerId: "openrouter",
          apiKey: "",
        }),
      ).rejects.toThrow(/requires an API key/i);
    });

    it("falls back to local rewriter if provider is local:// or builtin", async () => {
      mockGetProvider.mockReturnValue({
        name: "Transformers.js",
        baseUrl: "local://transformers",
        format: "transformers_js",
      });
      mockRewriteText.mockResolvedValue("Local rewrite result");

      const result = await executeNativeAiTask({
        taskType: "rewrite",
        input: { text: "original" },
        providerId: "transformers_js",
      });

      expect(result).toBe("Local rewrite result");
      expect(mockRewriteText).toHaveBeenCalledWith(
        "original",
        expect.anything(),
      );
    });
  });

  describe("detect-language task parsing", () => {
    it("parses JSON array response for detect-language", async () => {
      mockGetProvider.mockReturnValue({
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        format: "openai",
        requiresApiKey: false,
      });
      mockBuildHeaders.mockReturnValue({});
      mockFormatRequest.mockReturnValue({});
      globalThis.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      mockParseResponse.mockReturnValue({
        content: [
          {
            type: "text",
            text: '[{"detectedLanguage":"fr","confidence":0.98}]',
          },
        ],
      });

      const result = await executeNativeAiTask({
        taskType: "detect-language",
        input: { text: "Bonjour le monde" },
        providerId: "openrouter",
      });

      expect(result).toEqual([{ detectedLanguage: "fr", confidence: 0.98 }]);
    });
  });

  describe("default provider resolution", () => {
    it("defaults to Prompt API in browser mode when providerId is omitted", async () => {
      const { setHeadlessMode } = await import("../../config/headless.js");
      setHeadlessMode(false);

      mockGetProvider.mockImplementation((id: string) => {
        if (id === "prompt_api") {
          return { id: "prompt_api", format: "prompt_api" };
        }
        return null;
      });
      mockSummarizeText.mockResolvedValue("Browser summary");

      const result = await executeNativeAiTask({
        taskType: "summarize",
        input: { text: "Some long text to summarize" },
      });

      expect(mockEnsureBuiltinAiPolyfills).toHaveBeenCalled();
      expect(result).toBe("Browser summary");
    });

    it("defaults to OpenRouter in headless mode when providerId is omitted", async () => {
      const { setHeadlessMode } = await import("../../config/headless.js");
      setHeadlessMode(true);

      mockGetProvider.mockReturnValue({
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        format: "openai",
        requiresApiKey: false,
      });
      mockBuildHeaders.mockReturnValue({});
      mockFormatRequest.mockReturnValue({});
      globalThis.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      mockParseResponse.mockReturnValue({
        content: [{ type: "text", text: "Headless summary" }],
      });

      const result = await executeNativeAiTask({
        taskType: "summarize",
        input: { text: "Some long text to summarize" },
      });

      expect(result).toBe("Headless summary");
      setHeadlessMode(false);
    });
  });

  describe("headless in-process executor dispatch", () => {
    it("executes translate task in-process via node transformers task executor in headless mode", async () => {
      const { setHeadlessMode } = await import("../../config/headless.js");
      const { setNodeTransformersTaskExecutor } =
        await import("./executeNativeAiTask.js");
      setHeadlessMode(true);

      mockGetProvider.mockReturnValue({
        id: "transformers_js_local",
        name: "Transformers.js (Local Proxy)",
        baseUrl: "http://localhost:8888/v1/chat/completions",
        format: "openai",
        defaultModel: "onnx-community/gemma-3-1b-it-ONNX-GQA",
      });

      mockFormatRequest.mockReturnValue({
        messages: [
          {
            role: "user",
            content: "Translate the following text from en to fr: Good morning",
          },
        ],
      });

      mockParseResponse.mockReturnValue({
        content: [{ type: "text", text: "Bonjour" }],
      });

      const mockExecutor = jest.fn<any>().mockResolvedValue({
        choices: [{ message: { content: "Bonjour" } }],
      });
      setNodeTransformersTaskExecutor(mockExecutor);

      const mockFetch = jest.fn<any>();
      globalThis.fetch = mockFetch;

      try {
        const result = await executeNativeAiTask({
          taskType: "translate",
          input: {
            text: "Good morning",
            sourceLanguage: "en",
            targetLanguage: "fr",
          },
          providerId: "transformers_js_local",
        });

        expect(result).toBe("Bonjour");
        expect(mockExecutor).toHaveBeenCalledWith(
          expect.objectContaining({
            modelId: "onnx-community/gemma-3-1b-it-ONNX-GQA",
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "user",
              }),
            ]),
          }),
        );
        expect(mockFetch).not.toHaveBeenCalled();
      } finally {
        setNodeTransformersTaskExecutor(null);
        setHeadlessMode(false);
      }
    });

    it("executes task in-process via node llamafile task executor in headless mode", async () => {
      const { setHeadlessMode } = await import("../../config/headless.js");
      const { setNodeLlamafileTaskExecutor } =
        await import("./executeNativeAiTask.js");
      setHeadlessMode(true);

      mockGetProvider.mockReturnValue({
        id: "llamafile",
        name: "Llamafile",
        baseUrl: "http://localhost:8080/v1/chat/completions",
        format: "openai",
        defaultModel: "LLaMA_CPP",
      });

      mockFormatRequest.mockReturnValue({
        messages: [{ role: "user", content: "Translate: Good morning" }],
      });

      mockParseResponse.mockReturnValue({
        content: [{ type: "text", text: "Bonjour" }],
      });

      const mockExecutor = jest.fn<any>().mockResolvedValue({
        choices: [{ message: { content: "Bonjour" } }],
      });
      setNodeLlamafileTaskExecutor(mockExecutor);

      const mockFetch = jest.fn<any>();
      globalThis.fetch = mockFetch;

      try {
        const result = await executeNativeAiTask({
          taskType: "translate",
          input: {
            text: "Good morning",
            sourceLanguage: "en",
            targetLanguage: "fr",
          },
          providerId: "llamafile",
        });

        expect(result).toBe("Bonjour");
        expect(mockExecutor).toHaveBeenCalledWith(
          expect.objectContaining({
            model: "LLaMA_CPP",
          }),
        );
        expect(mockFetch).not.toHaveBeenCalled();
      } finally {
        setNodeLlamafileTaskExecutor(null);
        setHeadlessMode(false);
      }
    });
  });
});
