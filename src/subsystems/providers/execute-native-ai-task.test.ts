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

const mockGetConfig = jest.fn<any>();

jest.unstable_mockModule("../../db/get-config.js", () => ({
  getConfig: mockGetConfig,
}));

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
    const mod = await import("./execute-native-ai-task.js");
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

    it("generates correct prompt for proofread task", () => {
      const prompt = buildTaskPrompt("proofread", {
        text: "Teh cat sat on teh mat",
      });
      expect(prompt).toContain("Proofread and correct grammar");
      expect(prompt).toContain("Teh cat sat on teh mat");
    });

    it("generates correct prompt for detect-language task", () => {
      const prompt = buildTaskPrompt("detect-language", {
        text: "Bonjour le monde",
      });
      expect(prompt).toContain("Detect the language of the following text");
      expect(prompt).toContain("Bonjour le monde");
    });

    it("generates correct prompt for semantic-embedder task", () => {
      const prompt = buildTaskPrompt("semantic-embedder", {
        text: "Some embedding input",
      });
      expect(prompt).toContain("Provide a concise semantic description");
      expect(prompt).toContain("Some embedding input");
    });

    it("throws error for unknown task type", () => {
      expect(() => buildTaskPrompt("unknown-task", { text: "text" })).toThrow(
        "Unknown native AI task type: unknown-task",
      );
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

    it("calls proofreadText when toolsBackendPref is local", async () => {
      mockProofreadText.mockResolvedValue("Corrected text");
      const result = await executeNativeAiTask({
        taskType: "proofread",
        input: { text: "Raw text" },
        toolsBackendPref: "local",
      });
      expect(result).toBe("Corrected text");
      expect(mockProofreadText).toHaveBeenCalledWith(
        "Raw text",
        expect.anything(),
      );
    });

    it("calls detectLanguage when toolsBackendPref is local", async () => {
      mockDetectLanguage.mockResolvedValue([
        { detectedLanguage: "en", confidence: 0.9 },
      ]);
      const result = await executeNativeAiTask({
        taskType: "detect-language",
        input: { text: "Hello" },
        toolsBackendPref: "local",
      });
      expect(result).toEqual([{ detectedLanguage: "en", confidence: 0.9 }]);
      expect(mockDetectLanguage).toHaveBeenCalledWith(
        "Hello",
        expect.anything(),
      );
    });

    it("calls embedText when toolsBackendPref is local", async () => {
      mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
      const result = await executeNativeAiTask({
        taskType: "semantic-embedder",
        input: { text: "Text to embed" },
        toolsBackendPref: "local",
      });
      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockEmbedText).toHaveBeenCalledWith(
        "Text to embed",
        expect.anything(),
      );
    });

    it("throws for unknown native AI task when toolsBackendPref is local", async () => {
      await expect(
        executeNativeAiTask({
          taskType: "unknown-task" as any,
          input: { text: "Hello" },
          toolsBackendPref: "local",
        }),
      ).rejects.toThrow("Unknown native AI task: unknown-task");
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
        await import("./execute-native-ai-task.js");
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
        await import("./execute-native-ai-task.js");
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

    it("handles detect-language via fetch with JSON and fallback", async () => {
      mockGetProvider.mockReturnValue({
        id: "custom",
        name: "Custom",
        baseUrl: "http://localhost:8080/v1/chat/completions",
        format: "openai",
        defaultModel: "model-1",
        requiresApiKey: false,
      });

      mockFormatRequest.mockReturnValue({
        messages: [{ role: "user", content: "Detect" }],
      });

      mockParseResponse.mockReturnValue({
        content: [{ type: "text", text: "not-json" }],
      });

      globalThis.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const resFallback = await executeNativeAiTask({
        taskType: "detect-language",
        input: { text: "Hello" },
        providerId: "custom",
      });
      expect(resFallback).toEqual([
        { detectedLanguage: "en", confidence: 0.8 },
      ]);

      // Now with valid JSON
      mockParseResponse.mockReturnValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { detectedLanguage: "es", confidence: 0.99 },
            ]),
          },
        ],
      });
      const resJson = await executeNativeAiTask({
        taskType: "detect-language",
        input: { text: "Hola" },
        providerId: "custom",
      });
      expect(resJson).toEqual([{ detectedLanguage: "es", confidence: 0.99 }]);
    });

    it("throws error when provider fetch fails with non-ok status", async () => {
      mockGetProvider.mockReturnValue({
        id: "custom",
        name: "Custom",
        baseUrl: "http://localhost:8080/v1/chat/completions",
        format: "openai",
        defaultModel: "model-1",
        requiresApiKey: false,
      });

      mockFormatRequest.mockReturnValue({ messages: [] });

      globalThis.fetch = jest.fn<any>().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Error"),
      });

      await expect(
        executeNativeAiTask({
          taskType: "summarize",
          input: { text: "Hello" },
          providerId: "custom",
        }),
      ).rejects.toThrow("Active provider task API error 500: Internal Error");
    });

    it("resolves toolsBackendPref from db when toolsBackendPref is omitted", async () => {
      mockGetConfig.mockImplementation(async (_db: any, key: string) => {
        if (key === "builtin_ai_tools_backend") return "local";
        return null;
      });
      mockSummarizeText.mockResolvedValue("DB summary");
      const result = await executeNativeAiTask({
        taskType: "summarize",
        input: { text: "DB doc" },
        db: {} as any,
      });
      expect(result).toBe("DB summary");
    });

    it("resolves apiKey from environment variables", async () => {
      const origEnv = { ...process.env };
      try {
        process.env.OPENROUTER_API_KEY = "openrouter-env-key";
        mockGetProvider.mockReturnValue({
          name: "OpenRouter",
          baseUrl: "https://openrouter.ai/api/v1/chat/completions",
          format: "openai",
          requiresApiKey: true,
        });
        mockFormatRequest.mockReturnValue({ messages: [] });
        globalThis.fetch = jest.fn<any>().mockResolvedValue({
          ok: true,
          json: async () => ({ choices: [] }),
        });
        mockParseResponse.mockReturnValue({
          content: [{ type: "text", text: "Answer" }],
        });

        const res = await executeNativeAiTask({
          taskType: "summarize",
          input: { text: "doc" },
          providerId: "openrouter",
        });
        expect(res).toBe("Answer");
        expect(mockBuildHeaders).toHaveBeenCalledWith(
          expect.anything(),
          "openrouter-env-key",
        );

        // Test generic SHADOW_CLAW_API_KEY
        process.env.SHADOW_CLAW_API_KEY = "generic-key";
        await executeNativeAiTask({
          taskType: "summarize",
          input: { text: "doc" },
          providerId: "openrouter",
        });
        expect(mockBuildHeaders).toHaveBeenCalledWith(
          expect.anything(),
          "generic-key",
        );
      } finally {
        process.env = origEnv;
      }
    });

    it("resolves apiKey from db when env vars are absent", async () => {
      const origEnv = { ...process.env };
      delete process.env.SHADOW_CLAW_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      try {
        mockGetConfig.mockImplementation(async (_db: any, key: string) => {
          if (key === "api_key:openrouter") return "db-openrouter-key";
          return null;
        });
        mockGetProvider.mockReturnValue({
          name: "OpenRouter",
          baseUrl: "https://openrouter.ai/api/v1/chat/completions",
          format: "openai",
          requiresApiKey: true,
        });
        mockFormatRequest.mockReturnValue({ messages: [] });
        globalThis.fetch = jest.fn<any>().mockResolvedValue({
          ok: true,
          json: async () => ({ choices: [] }),
        });
        mockParseResponse.mockReturnValue({
          content: [{ type: "text", text: "DB Answer" }],
        });

        const res = await executeNativeAiTask({
          taskType: "summarize",
          input: { text: "doc" },
          providerId: "openrouter",
          db: {} as any,
        });
        expect(res).toBe("DB Answer");
        expect(mockBuildHeaders).toHaveBeenCalledWith(
          expect.anything(),
          "db-openrouter-key",
        );
      } finally {
        process.env = origEnv;
      }
    });

    it("resolves providerId from db when omitted from options", async () => {
      mockGetConfig.mockImplementation(async (_db: any, key: string) => {
        if (key === "provider") return "db-provider";
        return null;
      });
      mockGetProvider.mockReturnValue({
        name: "DB Provider",
        baseUrl: "https://db-provider.example/api",
        format: "openai",
        requiresApiKey: false,
      });
      mockFormatRequest.mockReturnValue({ messages: [] });
      globalThis.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] }),
      });
      mockParseResponse.mockReturnValue({
        content: [{ type: "text", text: "DB Provider response" }],
      });

      const res = await executeNativeAiTask({
        taskType: "summarize",
        input: { text: "test" },
        db: {} as any,
      });
      expect(res).toBe("DB Provider response");
    });

    it("uses global LanguageModel when provider is prompt_api", async () => {
      const mockDestroy = jest.fn();
      const mockPrompt = jest.fn<any>().mockResolvedValue("Prompt API answer");
      (globalThis as any).LanguageModel = {
        create: jest.fn<any>().mockResolvedValue({
          prompt: mockPrompt,
          destroy: mockDestroy,
        }),
      };

      try {
        const res = await executeNativeAiTask({
          taskType: "summarize",
          input: { text: "Some text" },
          providerId: "prompt_api",
        });
        expect(res).toBe("Prompt API answer");
        expect(mockDestroy).toHaveBeenCalled();

        // Also test detect-language through LanguageModel with JSON array
        mockPrompt.mockResolvedValueOnce(
          JSON.stringify([{ detectedLanguage: "fr", confidence: 0.95 }]),
        );
        const resLang = await executeNativeAiTask({
          taskType: "detect-language",
          input: { text: "Bonjour" },
          providerId: "prompt_api",
        });
        expect(resLang).toEqual([{ detectedLanguage: "fr", confidence: 0.95 }]);

        // And detect-language with invalid JSON fallback
        mockPrompt.mockResolvedValueOnce("not valid json");
        const resLangFallback = await executeNativeAiTask({
          taskType: "detect-language",
          input: { text: "Bonjour" },
          providerId: "prompt_api",
        });
        expect(resLangFallback).toEqual([
          { detectedLanguage: "en", confidence: 0.8 },
        ]);
      } finally {
        delete (globalThis as any).LanguageModel;
      }
    });

    it("falls back to local task functions when provider has builtin:// baseUrl", async () => {
      mockGetProvider.mockReturnValue({
        name: "Builtin",
        baseUrl: "builtin://local",
        format: "openai",
      });

      mockWriteText.mockResolvedValue("Written by fallback");
      const resWrite = await executeNativeAiTask({
        taskType: "write",
        input: { prompt: "Write something" },
        providerId: "builtin",
      });
      expect(resWrite).toBe("Written by fallback");

      mockProofreadText.mockResolvedValue("Proofread by fallback");
      const resProofread = await executeNativeAiTask({
        taskType: "proofread",
        input: { text: "Proofread something" },
        providerId: "builtin",
      });
      expect(resProofread).toBe("Proofread by fallback");

      mockDetectLanguage.mockResolvedValue([
        { detectedLanguage: "es", confidence: 0.9 },
      ]);
      const resDetect = await executeNativeAiTask({
        taskType: "detect-language",
        input: { text: "Hola" },
        providerId: "builtin",
      });
      expect(resDetect).toEqual([{ detectedLanguage: "es", confidence: 0.9 }]);

      mockEmbedText.mockResolvedValue([1, 2, 3]);
      const resEmbed = await executeNativeAiTask({
        taskType: "semantic-embedder",
        input: { text: "Embed something" },
        providerId: "builtin",
      });
      expect(resEmbed).toEqual([1, 2, 3]);

      await expect(
        executeNativeAiTask({
          taskType: "unknown-fallback" as any,
          input: { text: "invalid" },
          providerId: "builtin",
        }),
      ).rejects.toThrow("Unknown native AI task type: unknown-fallback");
    });

    it("handles detect-language via nodeLlamafileTaskExecutor in headless mode with JSON and fallback", async () => {
      const { setHeadlessMode } = await import("../../config/headless.js");
      const { setNodeLlamafileTaskExecutor } =
        await import("./execute-native-ai-task.js");
      setHeadlessMode(true);

      mockGetProvider.mockReturnValue({
        id: "llamafile",
        name: "Llamafile",
        baseUrl: "http://localhost:8080/v1/chat/completions",
        format: "openai",
        defaultModel: "LLaMA_CPP",
      });

      mockFormatRequest.mockReturnValue({ messages: [] });
      const mockExecutor = jest.fn<any>().mockResolvedValue({});
      setNodeLlamafileTaskExecutor(mockExecutor);

      try {
        mockParseResponse.mockReturnValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify([
                { detectedLanguage: "de", confidence: 0.99 },
              ]),
            },
          ],
        });
        const resJson = await executeNativeAiTask({
          taskType: "detect-language",
          input: { text: "Guten Tag" },
          providerId: "llamafile",
        });
        expect(resJson).toEqual([{ detectedLanguage: "de", confidence: 0.99 }]);

        mockParseResponse.mockReturnValueOnce({
          content: [{ type: "text", text: "invalid-json" }],
        });
        const resFallback = await executeNativeAiTask({
          taskType: "detect-language",
          input: { text: "Guten Tag" },
          providerId: "llamafile",
        });
        expect(resFallback).toEqual([
          { detectedLanguage: "en", confidence: 0.8 },
        ]);
      } finally {
        setNodeLlamafileTaskExecutor(null);
        setHeadlessMode(false);
      }
    });

    it("handles detect-language via nodeTransformersTaskExecutor in headless mode with JSON and fallback", async () => {
      const { setHeadlessMode } = await import("../../config/headless.js");
      const { setNodeTransformersTaskExecutor } =
        await import("./execute-native-ai-task.js");
      setHeadlessMode(true);

      mockGetProvider.mockReturnValue({
        id: "transformers_js_local",
        name: "Transformers.js",
        baseUrl: "http://localhost:8888/v1/chat/completions",
        format: "openai",
        defaultModel: "onnx-community/gemma-3-1b-it-ONNX-GQA",
      });

      mockFormatRequest.mockReturnValue({ messages: [] });
      const mockExecutor = jest.fn<any>().mockResolvedValue({});
      setNodeTransformersTaskExecutor(mockExecutor);

      try {
        mockParseResponse.mockReturnValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({ detectedLanguage: "ja", confidence: 0.9 }),
            },
          ],
        });
        const resJson = await executeNativeAiTask({
          taskType: "detect-language",
          input: { text: "Konnichiwa" },
          providerId: "transformers_js_local",
        });
        expect(resJson).toEqual([{ detectedLanguage: "ja", confidence: 0.9 }]);

        mockParseResponse.mockReturnValueOnce({
          content: [{ type: "text", text: "not-json" }],
        });
        const resFallback = await executeNativeAiTask({
          taskType: "detect-language",
          input: { text: "Konnichiwa" },
          providerId: "transformers_js_local",
        });
        expect(resFallback).toEqual([
          { detectedLanguage: "en", confidence: 0.8 },
        ]);
      } finally {
        setNodeTransformersTaskExecutor(null);
        setHeadlessMode(false);
      }
    });
  });
});
