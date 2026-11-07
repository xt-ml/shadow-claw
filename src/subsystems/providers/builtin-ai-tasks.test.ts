import { jest } from "@jest/globals";

const mockGetDb = jest.fn<any>().mockResolvedValue(null);
const mockGetConfig = jest.fn<any>().mockResolvedValue(null);

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: mockGetDb,
}));

jest.unstable_mockModule("../../db/get-config.js", () => ({
  getConfig: mockGetConfig,
}));

const {
  createTaskInstanceWithFallback,
  ensureBuiltinAiPolyfills,
  isBuiltinTaskSupported,
  isWebGpuAdapterAvailable,
  summarizeText,
  writeText,
  rewriteText,
  detectLanguage,
  translateText,
  proofreadText,
  embedText,
  setCustomLegacyTaskFactories,
  getPromptApiFallbackModel,
} = await import("./builtin-ai-tasks.js");

describe("builtin-ai-tasks subsystem", () => {
  const originalGlobals: Record<string, any> = {};

  beforeEach(() => {
    originalGlobals.LanguageModel = (globalThis as any).LanguageModel;
    originalGlobals.Summarizer = (globalThis as any).Summarizer;
    originalGlobals.Writer = (globalThis as any).Writer;
    originalGlobals.Rewriter = (globalThis as any).Rewriter;
    originalGlobals.LanguageDetector = (globalThis as any).LanguageDetector;
    originalGlobals.Translator = (globalThis as any).Translator;
    delete (globalThis as any).TRANSFORMERS_CONFIG;
    if (typeof setCustomLegacyTaskFactories === "function") {
      setCustomLegacyTaskFactories(null);
    }
  });

  afterEach(() => {
    (globalThis as any).LanguageModel = originalGlobals.LanguageModel;
    (globalThis as any).Summarizer = originalGlobals.Summarizer;
    (globalThis as any).Writer = originalGlobals.Writer;
    (globalThis as any).Rewriter = originalGlobals.Rewriter;
    (globalThis as any).LanguageDetector = originalGlobals.LanguageDetector;
    (globalThis as any).Translator = originalGlobals.Translator;
    delete (globalThis as any).TRANSFORMERS_CONFIG;
    if (typeof setCustomLegacyTaskFactories === "function") {
      setCustomLegacyTaskFactories(null);
    }
  });

  describe("Google writing adapter compatibility", () => {
    it.each([
      ["writer-rewriter-polyfills/writer", "Writer"],
      ["writer-rewriter-polyfills/rewriter", "Rewriter"],
    ])(
      "uses current Prompt API context measurement in %s",
      async (moduleName, exportName) => {
        const measureContextUsage = jest.fn<any>().mockResolvedValue(17);
        (globalThis as any).LanguageModel = {
          availability: jest.fn<any>().mockResolvedValue("available"),
          create: jest.fn<any>().mockResolvedValue({
            measureContextUsage,
            contextWindow: 2048,
            destroy: jest.fn<any>(),
          }),
        };

        const module = await import(moduleName);
        const instance = await module[exportName].create();
        try {
          await expect(instance.measureInputUsage("text")).resolves.toBe(17);
          expect(instance.inputQuota).toBe(2048);
        } finally {
          instance.destroy();
        }
      },
    );
  });

  describe("native writing fallback", () => {
    it.each([
      ["Writer", "writer", writeText],
      ["Rewriter", "rewriter", rewriteText],
    ])(
      "tries the Google adapter after unsupported native %s",
      async (name, key, execute) => {
        const create = jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException("Unavailable", "NotSupportedError"),
          );
        const legacyCreate = jest.fn<any>();
        (globalThis as any)[name] = { create };
        setCustomLegacyTaskFactories({ [key]: { create: legacyCreate } });
        (globalThis as any).LanguageModel = {
          availability: jest.fn<any>().mockResolvedValue("available"),
          create: jest.fn<any>().mockResolvedValue({
            clone: jest.fn<any>().mockResolvedValue({
              prompt: jest.fn<any>().mockResolvedValue("Adapter result"),
              destroy: jest.fn<any>(),
            }),
            destroy: jest.fn<any>(),
          }),
        };

        await expect(execute("Private content")).resolves.toBe(
          "Adapter result",
        );
        expect(legacyCreate).not.toHaveBeenCalled();
      },
    );
  });

  describe("isWebGpuAdapterAvailable", () => {
    it("returns false when navigator.gpu is absent or requestAdapter fails", async () => {
      const originalNavigator = globalThis.navigator;
      try {
        Object.defineProperty(globalThis, "navigator", {
          value: {},
          configurable: true,
        });

        expect(await isWebGpuAdapterAvailable()).toBe(false);
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("returns true when adapter and device creation succeed", async () => {
      const originalNavigator = globalThis.navigator;
      try {
        Object.defineProperty(globalThis, "navigator", {
          value: {
            gpu: {
              requestAdapter: async () => ({
                isFallbackAdapter: false,
                features: new Set(["shader-f16"]),
                requestDevice: async () => ({
                  destroy: () => {},
                }),
              }),
            },
          },
          configurable: true,
        });

        expect(await isWebGpuAdapterAvailable()).toBe(true);
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("returns false when adapter lacks shader-f16 support", async () => {
      const originalNavigator = globalThis.navigator;
      try {
        Object.defineProperty(globalThis, "navigator", {
          value: {
            gpu: {
              requestAdapter: async () => ({
                isFallbackAdapter: false,
                features: new Set([]),
                requestDevice: async () => ({
                  destroy: () => {},
                }),
              }),
            },
          },
          configurable: true,
        });

        expect(await isWebGpuAdapterAvailable()).toBe(false);
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("returns false when adapter is a CPU software fallback adapter", async () => {
      const originalNavigator = globalThis.navigator;
      try {
        Object.defineProperty(globalThis, "navigator", {
          value: {
            gpu: {
              requestAdapter: async () => ({
                isFallbackAdapter: true,
                requestDevice: async () => ({
                  destroy: () => {},
                }),
              }),
            },
          },
          configurable: true,
        });

        expect(await isWebGpuAdapterAvailable()).toBe(false);
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("returns false when adapter info indicates SwiftShader / llvmpipe", async () => {
      const originalNavigator = globalThis.navigator;
      try {
        Object.defineProperty(globalThis, "navigator", {
          value: {
            gpu: {
              requestAdapter: async () => ({
                isFallbackAdapter: false,
                info: {
                  vendor: "Google",
                  architecture: "swiftshader",
                  description: "Google SwiftShader",
                },
                requestDevice: async () => ({
                  destroy: () => {},
                }),
              }),
            },
          },
          configurable: true,
        });

        expect(await isWebGpuAdapterAvailable()).toBe(false);
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });
  });

  describe("createTaskInstanceWithFallback", () => {
    it.each(["AbortError", "QuotaExceededError", "NotAllowedError"])(
      "does not retry %s even when its message mentions WebGPU",
      async (name) => {
        (globalThis as any).TRANSFORMERS_CONFIG = { device: "webgpu" };
        const error = new DOMException("WebGPU operation failed", name);
        const create = jest.fn<any>().mockRejectedValue(error);

        await expect(
          createTaskInstanceWithFallback({ create }, {}),
        ).rejects.toBe(error);
        expect(create).toHaveBeenCalledTimes(1);
        expect((globalThis as any).TRANSFORMERS_CONFIG.device).toBe("webgpu");
      },
    );

    it("retries with wasm CPU fallback when WebGPU backend fails during creation", async () => {
      (globalThis as any).TRANSFORMERS_CONFIG = {
        device: "webgpu",
        dtype: "q4f16",
      };

      let calls = 0;
      const mockFactory = {
        create: async () => {
          calls++;
          if (calls === 1) {
            throw new TypeError(
              "[webgpu] TypeError: O().webgpuInit is not a function.",
            );
          }
          return { ready: true };
        },
      };

      const instance = await createTaskInstanceWithFallback(mockFactory, {});
      expect(instance).toEqual({ ready: true });
      expect((globalThis as any).TRANSFORMERS_CONFIG.device).toBe("wasm");
      expect(calls).toBe(2);
    });

    it("retries with wasm fallback on ONNX ORT_NOT_IMPLEMENTED (ERROR_CODE: 9) — the GatherBlockQuantized Firefox bug and sets CPU fallback model", async () => {
      // This is the exact error that fires in Firefox when the GPU driver supports
      // WebGPU but lacks the GatherBlockQuantized kernel for q4f16 block-quantized models.
      (globalThis as any).TRANSFORMERS_CONFIG = {
        device: "webgpu",
        dtype: "q4f16",
      };

      let calls = 0;
      const mockFactory = {
        create: async () => {
          calls++;
          if (calls === 1) {
            throw new Error(
              "Can't create a session. ERROR_CODE: 9, ERROR_MESSAGE: Could not find an implementation for GatherBlockQuantized(1) node with name '/model/embed_tokens/Gather_Quant'",
            );
          }
          return { ready: true };
        },
      };

      const instance = await createTaskInstanceWithFallback(mockFactory, {});
      expect(instance).toEqual({ ready: true });
      expect((globalThis as any).TRANSFORMERS_CONFIG.device).toBe("wasm");
      expect((globalThis as any).TRANSFORMERS_CONFIG.dtype).toBe("q4");
      expect((globalThis as any).TRANSFORMERS_CONFIG.modelName).toBe(
        "onnx-community/Qwen3-0.6B-ONNX",
      );
      expect(calls).toBe(2);
    });

    it("retries with wasm fallback when WebNN backend fails and sets CPU fallback model", async () => {
      (globalThis as any).TRANSFORMERS_CONFIG = {
        device: "webnn",
        dtype: "q4f16",
      };

      let calls = 0;
      const mockFactory = {
        create: async () => {
          calls++;
          if (calls === 1) {
            throw new Error("WebNN: backend initialization failed");
          }
          return { ready: true };
        },
      };

      const instance = await createTaskInstanceWithFallback(mockFactory, {});
      expect(instance).toEqual({ ready: true });
      expect((globalThis as any).TRANSFORMERS_CONFIG.device).toBe("wasm");
      expect((globalThis as any).TRANSFORMERS_CONFIG.dtype).toBe("q4");
      expect((globalThis as any).TRANSFORMERS_CONFIG.modelName).toBe(
        "onnx-community/Qwen3-0.6B-ONNX",
      );
      expect(calls).toBe(2);
    });

    it("retries with wasm fallback on ONNX bad_alloc (ERROR_CODE: 6) and sets CPU fallback model", async () => {
      (globalThis as any).TRANSFORMERS_CONFIG = {
        device: "webgpu",
        dtype: "q4f16",
      };

      let calls = 0;
      const mockFactory = {
        create: async () => {
          calls++;
          if (calls === 1) {
            throw new Error(
              "Can't create a session. ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc",
            );
          }
          return { ready: true };
        },
      };

      const instance = await createTaskInstanceWithFallback(mockFactory, {});
      expect(instance).toEqual({ ready: true });
      expect((globalThis as any).TRANSFORMERS_CONFIG.device).toBe("wasm");
      expect((globalThis as any).TRANSFORMERS_CONFIG.dtype).toBe("q4");
      expect((globalThis as any).TRANSFORMERS_CONFIG.modelName).toBe(
        "onnx-community/Qwen3-0.6B-ONNX",
      );
      expect(calls).toBe(2);
    });

    it("does not swallow non-backend errors (e.g. abort, network failures)", async () => {
      (globalThis as any).TRANSFORMERS_CONFIG = {
        device: "webgpu",
        dtype: "q4f16",
      };

      const mockFactory = {
        create: async () => {
          throw new Error("AbortError: Prompt API session creation aborted");
        },
      };

      await expect(
        createTaskInstanceWithFallback(mockFactory, {}),
      ).rejects.toThrow("Prompt API session creation aborted");
    });
  });

  describe("isBuiltinTaskSupported", () => {
    it("returns false when global task class is missing", () => {
      delete (globalThis as any).Summarizer;
      delete (globalThis as any).Writer;
      delete (globalThis as any).Rewriter;
      delete (globalThis as any).LanguageDetector;
      delete (globalThis as any).Translator;
      delete (globalThis as any).Proofreader;
      delete (globalThis as any).SemanticEmbedder;

      expect(isBuiltinTaskSupported("summarizer")).toBe(false);
      expect(isBuiltinTaskSupported("writer")).toBe(false);
      expect(isBuiltinTaskSupported("rewriter")).toBe(false);
      expect(isBuiltinTaskSupported("language-detector")).toBe(false);
      expect(isBuiltinTaskSupported("translator")).toBe(false);
      expect(isBuiltinTaskSupported("proofreader")).toBe(false);
      expect(isBuiltinTaskSupported("semantic-embedder")).toBe(false);
      expect(isBuiltinTaskSupported("unknown" as any)).toBe(false);
    });

    it("returns true when global task class is present", () => {
      (globalThis as any).Summarizer = class {};
      (globalThis as any).Writer = class {};
      (globalThis as any).Rewriter = class {};
      (globalThis as any).LanguageDetector = class {};
      (globalThis as any).Translator = class {};
      (globalThis as any).Proofreader = class {};
      (globalThis as any).SemanticEmbedder = class {};

      expect(isBuiltinTaskSupported("summarizer")).toBe(true);
      expect(isBuiltinTaskSupported("writer")).toBe(true);
      expect(isBuiltinTaskSupported("rewriter")).toBe(true);
      expect(isBuiltinTaskSupported("language-detector")).toBe(true);
      expect(isBuiltinTaskSupported("translator")).toBe(true);
      expect(isBuiltinTaskSupported("proofreader")).toBe(true);
      expect(isBuiltinTaskSupported("semantic-embedder")).toBe(true);
    });
  });

  describe("getPromptApiFallbackModel", () => {
    it("returns configured model from db when present", async () => {
      mockGetDb.mockResolvedValueOnce({} as any);
      mockGetConfig.mockResolvedValueOnce("custom-user-model/onnx");
      const model = await getPromptApiFallbackModel();
      expect(model).toBe("custom-user-model/onnx");
    });

    it("returns default polyfill model when db is absent or unconfigured", async () => {
      mockGetDb.mockResolvedValueOnce(null);
      const model = await getPromptApiFallbackModel();
      expect(typeof model).toBe("string");
      expect(model.length).toBeGreaterThan(0);
    });
  });

  describe("ensureBuiltinAiPolyfills", () => {
    it("does not fabricate user activation when the browser is inactive", async () => {
      const originalNavigator = globalThis.navigator;
      const userActivation = { isActive: false, hasBeenActive: false };
      try {
        Object.defineProperty(globalThis, "navigator", {
          value: { userActivation },
          configurable: true,
        });
        (globalThis as any).LanguageModel = class {};

        await ensureBuiltinAiPolyfills();

        expect(globalThis.navigator.userActivation).toBe(userActivation);
        expect(globalThis.navigator.userActivation.isActive).toBe(false);
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("runs without error and attempts polyfill load when globals are absent", async () => {
      await expect(ensureBuiltinAiPolyfills()).resolves.not.toThrow();
    });

    it("configures wasm device and CPU fallback model when WebGPU and WebNN are absent", async () => {
      const originalNavigator = globalThis.navigator;
      try {
        Object.defineProperty(globalThis, "navigator", {
          value: {
            gpu: {
              requestAdapter: async () => null,
            },
          },
          configurable: true,
        });

        delete (globalThis as any).LanguageModel;
        delete (globalThis as any).TRANSFORMERS_CONFIG;

        await ensureBuiltinAiPolyfills();
        expect((globalThis as any).TRANSFORMERS_CONFIG?.device).toBe("wasm");
        expect((globalThis as any).TRANSFORMERS_CONFIG?.dtype).toBe("q4f16");
        expect((globalThis as any).TRANSFORMERS_CONFIG?.modelName).toBe(
          "onnx-community/Qwen3-0.6B-ONNX",
        );
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("configures webgpu device and sets the polyfill model when WebGPU is available", async () => {
      const originalNavigator = globalThis.navigator;
      try {
        Object.defineProperty(globalThis, "navigator", {
          value: {
            gpu: {
              requestAdapter: async () => ({
                isFallbackAdapter: false,
                features: new Set(["shader-f16"]),
                requestDevice: async () => ({
                  destroy: () => {},
                }),
              }),
            },
          },
          configurable: true,
        });

        delete (globalThis as any).LanguageModel;
        delete (globalThis as any).TRANSFORMERS_CONFIG;

        await ensureBuiltinAiPolyfills();
        expect((globalThis as any).TRANSFORMERS_CONFIG?.device).toBe("webgpu");
        expect((globalThis as any).TRANSFORMERS_CONFIG?.dtype).toBe("q4f16");
        expect((globalThis as any).TRANSFORMERS_CONFIG?.modelName).toBe(
          "onnx-community/Qwen3-0.6B-ONNX",
        );
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("does not configure TRANSFORMERS_CONFIG when native LanguageModel is present", async () => {
      (globalThis as any).LanguageModel = class {};
      delete (globalThis as any).TRANSFORMERS_CONFIG;

      await ensureBuiltinAiPolyfills();
      expect((globalThis as any).TRANSFORMERS_CONFIG).toBeUndefined();
    });
  });

  describe("summarizeText", () => {
    it("uses the custom prompt instead of a native summarizer when overridePrompt is supplied", async () => {
      const createSummarizer = jest.fn<any>();
      const prompt = jest.fn<any>().mockResolvedValue("Custom summary");
      const destroy = jest.fn<any>();
      (globalThis as any).Summarizer = { create: createSummarizer };
      const create = jest.fn<any>().mockResolvedValue({ prompt, destroy });
      (globalThis as any).LanguageModel = { create };

      await expect(
        summarizeText("Contract", { overridePrompt: "Custom instructions" }),
      ).resolves.toBe("Custom summary");
      expect(createSummarizer).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          initialPrompts: [{ role: "system", content: "Custom instructions" }],
        }),
      );
      expect(prompt).toHaveBeenCalledWith("TEXT: Contract");
      expect(destroy).toHaveBeenCalled();
    });

    it("calls Summarizer.create and summarizer.summarize (Tier 1)", async () => {
      const mockSummarize = jest.fn<any>().mockResolvedValue("Short summary.");
      const mockDestroy = jest.fn<any>();

      (globalThis as any).Summarizer = {
        create: jest.fn<any>().mockResolvedValue({
          summarize: mockSummarize,
          destroy: mockDestroy,
        }),
      };

      const result = await summarizeText("Long input text...", {
        type: "tldr",
        format: "plain-text",
      });
      expect(result).toBe("Short summary.");
      expect((globalThis as any).Summarizer.create).toHaveBeenCalledWith({
        type: "tldr",
        format: "plain-text",
      });
      expect(mockSummarize).toHaveBeenCalledWith(
        "Long input text...",
        undefined,
      );
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("falls back to Tier 2 (legacy polyfill) when Tier 1 fails", async () => {
      (globalThis as any).Summarizer = {
        create: jest
          .fn<any>()
          .mockRejectedValue(new Error("Native Summarizer not supported")),
      };

      const mockLegacySummarize = jest
        .fn<any>()
        .mockResolvedValue("Legacy polyfill summary.");
      setCustomLegacyTaskFactories({
        summarizer: {
          create: jest.fn<any>().mockResolvedValue({
            summarize: mockLegacySummarize,
            destroy: jest.fn<any>(),
          }),
        },
      });

      const result = await summarizeText("Article content", {
        type: "key-points",
      });
      expect(result).toBe("Legacy polyfill summary.");
      expect(mockLegacySummarize).toHaveBeenCalled();
    });

    it("falls back to Tier 3 (Prompt API session) when Tier 1 and Tier 2 fail", async () => {
      delete (globalThis as any).Summarizer;
      setCustomLegacyTaskFactories({
        summarizer: {
          create: jest
            .fn<any>()
            .mockRejectedValue(new Error("Legacy polyfill failed")),
        },
      });

      const mockPrompt = jest
        .fn<any>()
        .mockResolvedValue("Prompt API generated summary.");
      const mockDestroy = jest.fn<any>();
      (globalThis as any).LanguageModel = {
        create: jest.fn<any>().mockResolvedValue({
          prompt: mockPrompt,
          destroy: mockDestroy,
        }),
      };

      const result = await summarizeText("Important briefing", {
        type: "headline",
      });
      expect(result).toBe("Prompt API generated summary.");
      expect((globalThis as any).LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          initialPrompts: [
            { role: "system", content: expect.stringMatching(/headline/i) },
          ],
        }),
      );
      expect(mockPrompt).toHaveBeenCalledWith("TEXT: Important briefing");
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("uses overridePrompt in Tier 3 when overridePrompt is provided", async () => {
      delete (globalThis as any).Summarizer;
      setCustomLegacyTaskFactories({
        summarizer: {
          create: jest.fn<any>().mockRejectedValue(new Error("Unavailable")),
        },
      });

      const customPrompt = "You are a specialized legal document summarizer.";
      const mockPrompt = jest
        .fn<any>()
        .mockResolvedValue("Custom prompt summary.");
      (globalThis as any).LanguageModel = {
        create: jest.fn<any>().mockResolvedValue({
          prompt: mockPrompt,
          destroy: jest.fn<any>(),
        }),
      };

      const result = await summarizeText("Legal contract text", {
        overridePrompt: customPrompt,
      });
      expect(result).toBe("Custom prompt summary.");
      expect((globalThis as any).LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          initialPrompts: [{ role: "system", content: customPrompt }],
        }),
      );
    });

    it("throws clear error when all three tiers fail", async () => {
      (globalThis as any).Summarizer = {
        create: jest.fn<any>().mockRejectedValue(new Error("Native failed")),
      };
      setCustomLegacyTaskFactories({
        summarizer: {
          create: jest.fn<any>().mockRejectedValue(new Error("Legacy failed")),
        },
      });
      delete (globalThis as any).LanguageModel;

      await expect(summarizeText("Test text")).rejects.toThrow(
        /Summarizer task failed across all tiers/i,
      );
    });
  });

  describe("writeText", () => {
    it("forwards cancellation to writer creation and execution", async () => {
      const signal = new AbortController().signal;
      const write = jest.fn<any>().mockResolvedValue("Draft");
      const create = jest
        .fn<any>()
        .mockResolvedValue({ write, destroy: jest.fn<any>() });
      (globalThis as any).Writer = { create };

      await writeText("Draft", { signal, context: "Context" });
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ signal }));
      expect(write).toHaveBeenCalledWith("Draft", {
        context: "Context",
        signal,
      });
    });

    it.each(["AbortError", "QuotaExceededError", "TypeError"])(
      "does not fall back after a writer %s",
      async (name) => {
        const error = new DOMException("Writer failed", name);
        const legacyCreate = jest.fn<any>();
        (globalThis as any).Writer = {
          create: jest.fn<any>().mockRejectedValue(error),
        };
        setCustomLegacyTaskFactories({ writer: { create: legacyCreate } });

        await expect(writeText("Draft an email")).rejects.toBe(error);
        expect(legacyCreate).not.toHaveBeenCalled();
      },
    );

    it("calls Writer.create and writer.write (Tier 1)", async () => {
      const mockWrite = jest.fn<any>().mockResolvedValue("Generated output.");
      const mockDestroy = jest.fn<any>();

      (globalThis as any).Writer = {
        create: jest.fn<any>().mockResolvedValue({
          write: mockWrite,
          destroy: mockDestroy,
        }),
      };

      const result = await writeText("Write a story", {
        context: "Sci-fi theme",
      });
      expect(result).toBe("Generated output.");
      expect((globalThis as any).Writer.create).toHaveBeenCalledWith({
        context: "Sci-fi theme",
      });
      expect(mockWrite).toHaveBeenCalledWith("Write a story", {
        context: "Sci-fi theme",
      });
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("falls back to Tier 2 (legacy polyfill) when Tier 1 throws NotSupportedError or fails", async () => {
      (globalThis as any).Writer = {
        create: jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException(
              "The writer polyfill requires the LanguageModel API",
              "NotSupportedError",
            ),
          ),
      };

      const mockLegacyWrite = jest
        .fn<any>()
        .mockResolvedValue("Legacy polyfill writer output.");
      setCustomLegacyTaskFactories({
        writer: {
          create: jest.fn<any>().mockResolvedValue({
            write: mockLegacyWrite,
            destroy: jest.fn<any>(),
          }),
        },
      });

      const result = await writeText("Draft an email", { tone: "formal" });
      expect(result).toBe("Legacy polyfill writer output.");
      expect(mockLegacyWrite).toHaveBeenCalled();
    });

    it("falls back to Tier 3 (Prompt API session) when Tier 1 and Tier 2 both fail", async () => {
      (globalThis as any).Writer = {
        create: jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException("Unavailable", "NotSupportedError"),
          ),
      };
      setCustomLegacyTaskFactories({
        writer: {
          create: jest
            .fn<any>()
            .mockRejectedValue(
              new DOMException("Unavailable", "NotSupportedError"),
            ),
        },
      });

      const mockPrompt = jest
        .fn<any>()
        .mockResolvedValue("Prompt API generated writing.");
      const mockDestroy = jest.fn<any>();
      (globalThis as any).LanguageModel = {
        create: jest.fn<any>().mockResolvedValue({
          prompt: mockPrompt,
          destroy: mockDestroy,
        }),
      };

      const result = await writeText("Write a blog post", {
        tone: "casual",
        length: "medium",
        outputLanguage: "en",
      });

      expect(result).toBe("Prompt API generated writing.");
      expect((globalThis as any).LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          initialPrompts: [
            { role: "system", content: expect.stringContaining("casual") },
          ],
        }),
      );
      expect(mockPrompt).toHaveBeenCalledWith("TEXT: Write a blog post");
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("does not retry a failed Prompt API session without task instructions", async () => {
      (globalThis as any).Writer = {
        create: jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException("Unavailable", "NotSupportedError"),
          ),
      };
      setCustomLegacyTaskFactories({
        writer: {
          create: jest
            .fn<any>()
            .mockRejectedValue(
              new DOMException("Unavailable", "NotSupportedError"),
            ),
        },
      });
      const create = jest
        .fn<any>()
        .mockRejectedValue(new Error("Create failed"));
      (globalThis as any).LanguageModel = { create };

      await expect(writeText("Draft an email")).rejects.toThrow(
        "Create failed",
      );
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ initialPrompts: expect.any(Array) }),
      );
    });

    it("forwards cancellation to the direct Prompt API fallback", async () => {
      const signal = new AbortController().signal;
      const unsupported = jest
        .fn<any>()
        .mockRejectedValue(
          new DOMException("Unavailable", "NotSupportedError"),
        );
      (globalThis as any).Writer = { create: unsupported };
      setCustomLegacyTaskFactories({ writer: { create: unsupported } });
      const prompt = jest.fn<any>().mockResolvedValue("Draft");
      const create = jest
        .fn<any>()
        .mockResolvedValue({ prompt, destroy: jest.fn<any>() });
      (globalThis as any).LanguageModel = { create };

      await expect(writeText("Draft", { signal })).resolves.toBe("Draft");
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ signal }));
      expect(prompt).toHaveBeenCalledWith("TEXT: Draft", { signal });
    });

    it("throws clear error when all three tiers fail", async () => {
      (globalThis as any).Writer = {
        create: jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException("Unavailable", "NotSupportedError"),
          ),
      };
      setCustomLegacyTaskFactories({
        writer: {
          create: jest
            .fn<any>()
            .mockRejectedValue(
              new DOMException("Unavailable", "NotSupportedError"),
            ),
        },
      });
      (globalThis as any).LanguageModel = {
        create: jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException("Unavailable", "NotSupportedError"),
          ),
      };

      await expect(writeText("Write something")).rejects.toThrow(
        /Writer task failed across all tiers/i,
      );
    });
  });

  describe("rewriteText", () => {
    it("forwards cancellation to rewriter creation and execution", async () => {
      const signal = new AbortController().signal;
      const rewrite = jest.fn<any>().mockResolvedValue("Rewritten");
      const create = jest
        .fn<any>()
        .mockResolvedValue({ rewrite, destroy: jest.fn<any>() });
      (globalThis as any).Rewriter = { create };

      await rewriteText("Draft", { signal });
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ signal }));
      expect(rewrite).toHaveBeenCalledWith("Draft", { signal });
    });

    it.each(["AbortError", "QuotaExceededError", "TypeError"])(
      "does not fall back after a rewriter %s",
      async (name) => {
        const error = new DOMException("Rewriter failed", name);
        const legacyCreate = jest.fn<any>();
        (globalThis as any).Rewriter = {
          create: jest.fn<any>().mockRejectedValue(error),
        };
        setCustomLegacyTaskFactories({ rewriter: { create: legacyCreate } });

        await expect(rewriteText("Rough draft")).rejects.toBe(error);
        expect(legacyCreate).not.toHaveBeenCalled();
      },
    );

    it("calls Rewriter.create and rewriter.rewrite (Tier 1)", async () => {
      const mockRewrite = jest.fn<any>().mockResolvedValue("Rewritten text.");
      const mockDestroy = jest.fn<any>();

      (globalThis as any).Rewriter = {
        create: jest.fn<any>().mockResolvedValue({
          rewrite: mockRewrite,
          destroy: mockDestroy,
        }),
      };

      const result = await rewriteText("Original text", {
        tone: "more-formal",
      });
      expect(result).toBe("Rewritten text.");
      expect((globalThis as any).Rewriter.create).toHaveBeenCalledWith({
        tone: "more-formal",
      });
      expect(mockRewrite).toHaveBeenCalledWith("Original text", undefined);
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("falls back to Tier 2 (legacy polyfill) when Tier 1 fails", async () => {
      (globalThis as any).Rewriter = {
        create: jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException("Unavailable", "NotSupportedError"),
          ),
      };

      const mockLegacyRewrite = jest
        .fn<any>()
        .mockResolvedValue("Legacy polyfill rewritten text.");
      setCustomLegacyTaskFactories({
        rewriter: {
          create: jest.fn<any>().mockResolvedValue({
            rewrite: mockLegacyRewrite,
            destroy: jest.fn<any>(),
          }),
        },
      });

      const result = await rewriteText("Rough draft", { tone: "more-casual" });
      expect(result).toBe("Legacy polyfill rewritten text.");
      expect(mockLegacyRewrite).toHaveBeenCalled();
    });

    it("falls back to Tier 3 (Prompt API session) when Tier 1 and Tier 2 both fail", async () => {
      (globalThis as any).Rewriter = {
        create: jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException("Unavailable", "NotSupportedError"),
          ),
      };
      setCustomLegacyTaskFactories({
        rewriter: {
          create: jest
            .fn<any>()
            .mockRejectedValue(
              new DOMException("Unavailable", "NotSupportedError"),
            ),
        },
      });

      const mockPrompt = jest
        .fn<any>()
        .mockResolvedValue("Prompt API rewritten text.");
      const mockDestroy = jest.fn<any>();
      (globalThis as any).LanguageModel = {
        create: jest.fn<any>().mockResolvedValue({
          prompt: mockPrompt,
          destroy: mockDestroy,
        }),
      };

      const result = await rewriteText("Original draft", {
        tone: "more-formal",
        length: "shorter",
      });

      expect(result).toBe("Prompt API rewritten text.");
      expect((globalThis as any).LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          initialPrompts: [
            {
              role: "system",
              content: expect.stringMatching(/Distinguished Senior Editor/i),
            },
          ],
        }),
      );
      expect(mockPrompt).toHaveBeenCalledWith("TEXT: Original draft");
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("throws clear error when all three tiers fail", async () => {
      (globalThis as any).Rewriter = {
        create: jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException("Unavailable", "NotSupportedError"),
          ),
      };
      setCustomLegacyTaskFactories({
        rewriter: {
          create: jest
            .fn<any>()
            .mockRejectedValue(
              new DOMException("Unavailable", "NotSupportedError"),
            ),
        },
      });
      (globalThis as any).LanguageModel = {
        create: jest
          .fn<any>()
          .mockRejectedValue(
            new DOMException("Unavailable", "NotSupportedError"),
          ),
      };

      await expect(rewriteText("Rewrite this")).rejects.toThrow(
        /Rewriter task failed across all tiers/i,
      );
    });
  });

  describe("detectLanguage", () => {
    it("calls LanguageDetector.create and detector.detect", async () => {
      const mockDetect = jest
        .fn<any>()
        .mockResolvedValue([{ detectedLanguage: "en", confidence: 0.99 }]);
      const mockDestroy = jest.fn<any>();

      (globalThis as any).LanguageDetector = {
        create: jest.fn<any>().mockResolvedValue({
          detect: mockDetect,
          destroy: mockDestroy,
        }),
      };

      const result = await detectLanguage("Hello world");
      expect(result).toEqual([{ detectedLanguage: "en", confidence: 0.99 }]);
      expect(mockDetect).toHaveBeenCalledWith("Hello world");
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("throws error when LanguageDetector is not available", async () => {
      const origProp = Object.getOwnPropertyDescriptor(
        globalThis,
        "LanguageDetector",
      );
      Object.defineProperty(globalThis, "LanguageDetector", {
        get: () => undefined,
        set: () => {},
        configurable: true,
      });
      (globalThis as any).translation = {};
      if ((globalThis as any).ai) {
        delete (globalThis as any).ai.languageDetector;
      }
      try {
        await expect(detectLanguage("Hello world")).rejects.toThrow(
          "Language Detector API is not supported or polyfilled",
        );
      } finally {
        if (origProp) {
          Object.defineProperty(globalThis, "LanguageDetector", origProp);
        } else {
          delete (globalThis as any).LanguageDetector;
        }
      }
    });
  });

  describe("translateText", () => {
    it("calls Translator.create and translator.translate", async () => {
      const mockTranslate = jest.fn<any>().mockResolvedValue("Hola mundo");
      const mockDestroy = jest.fn<any>();

      (globalThis as any).Translator = {
        create: jest.fn<any>().mockResolvedValue({
          translate: mockTranslate,
          destroy: mockDestroy,
        }),
      };

      const result = await translateText("Hello world", {
        sourceLanguage: "en",
        targetLanguage: "es",
      });
      expect(result).toBe("Hola mundo");
      expect((globalThis as any).Translator.create).toHaveBeenCalledWith({
        sourceLanguage: "en",
        targetLanguage: "es",
      });
      expect(mockTranslate).toHaveBeenCalledWith("Hello world");
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("throws error when Translator is not available", async () => {
      const origProp = Object.getOwnPropertyDescriptor(
        globalThis,
        "Translator",
      );
      Object.defineProperty(globalThis, "Translator", {
        get: () => undefined,
        set: () => {},
        configurable: true,
      });
      (globalThis as any).translation = {};
      if ((globalThis as any).ai) {
        delete (globalThis as any).ai.translator;
      }
      try {
        await expect(
          translateText("Hello world", {
            sourceLanguage: "en",
            targetLanguage: "es",
          }),
        ).rejects.toThrow("Translator API is not supported or polyfilled");
      } finally {
        if (origProp) {
          Object.defineProperty(globalThis, "Translator", origProp);
        } else {
          delete (globalThis as any).Translator;
        }
      }
    });
  });

  describe("createMonitorHandler via task progress", () => {
    it("reports download progress events accurately", async () => {
      let capturedMonitor: any;
      (globalThis as any).Summarizer = {
        create: jest.fn<any>().mockImplementation(async (opts: any) => {
          capturedMonitor = opts?.monitor;
          return {
            summarize: jest.fn<any>().mockResolvedValue("Summary done"),
            destroy: jest.fn(),
          };
        }),
      };

      const progressUpdates: any[] = [];
      const onProgress = jest.fn((p) => {
        progressUpdates.push(p);
      });

      const promise = summarizeText("Sample doc", { onProgress });
      await new Promise((r) => setTimeout(r, 10));

      expect(typeof capturedMonitor).toBe("function");

      const listeners: Record<string, Function> = {};
      const mockTarget = {
        addEventListener: (name: string, fn: Function) => {
          listeners[name] = fn;
        },
      };

      capturedMonitor(mockTarget);
      expect(progressUpdates[0].message).toContain("0%");

      // Test 1: loaded / total ratio
      listeners["downloadprogress"]?.({ loaded: 40, total: 100 });
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(0.4);
      expect(progressUpdates[progressUpdates.length - 1].message).toContain(
        "40%",
      );

      // Test 2: loaded ratio decimal (0.75)
      listeners["downloadprogress"]?.({ loaded: 0.75 });
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(0.75);
      expect(progressUpdates[progressUpdates.length - 1].message).toContain(
        "75%",
      );

      // Test 3: loaded bytes > 1 without total
      listeners["downloadprogress"]?.({ loaded: 10 * 1024 * 1024 });
      expect(progressUpdates[progressUpdates.length - 1].message).toContain(
        "10.0 MB downloaded",
      );

      // Null target
      capturedMonitor(null);

      const res = await promise;
      expect(res).toBe("Summary done");
    });
  });

  describe("proofreadText", () => {
    it("calls Proofreader.create and proofreader.proofread when available", async () => {
      const mockProofread = jest.fn<any>().mockResolvedValue("Corrected text.");
      const mockDestroy = jest.fn<any>();

      (globalThis as any).Proofreader = {
        create: jest.fn<any>().mockResolvedValue({
          proofread: mockProofread,
          destroy: mockDestroy,
        }),
      };

      const result = await proofreadText("Bad text", { context: "Email" });
      expect(result).toBe("Corrected text.");
      expect((globalThis as any).Proofreader.create).toHaveBeenCalledWith({
        context: "Email",
      });
      expect(mockProofread).toHaveBeenCalledWith("Bad text", {
        context: "Email",
      });
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("falls back to rewriteText when Proofreader is absent", async () => {
      delete (globalThis as any).Proofreader;
      const mockRewrite = jest
        .fn<any>()
        .mockResolvedValue("Rewritten proofread text.");
      const mockDestroy = jest.fn<any>();

      (globalThis as any).Rewriter = {
        create: jest.fn<any>().mockResolvedValue({
          rewrite: mockRewrite,
          destroy: mockDestroy,
        }),
      };

      const result = await proofreadText("Bad text", { context: "Email" });
      expect(result).toBe("Rewritten proofread text.");
      expect(mockRewrite).toHaveBeenCalled();
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("throws error when both Proofreader and Rewriter fail", async () => {
      delete (globalThis as any).Proofreader;
      const create = jest
        .fn<any>()
        .mockRejectedValue(
          new DOMException("Unavailable", "NotSupportedError"),
        );
      (globalThis as any).Rewriter = { create };
      (globalThis as any).LanguageModel = { create };
      setCustomLegacyTaskFactories({ rewriter: { create } });

      await expect(
        proofreadText("Bad text", { context: "Email" }),
      ).rejects.toThrow(/Rewriter task failed across all tiers/);
    });
  });

  describe("embedText", () => {
    it("calls SemanticEmbedder.create and embedder.embed", async () => {
      const mockEmbed = jest.fn<any>().mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      });
      const mockDestroy = jest.fn<any>();

      (globalThis as any).SemanticEmbedder = {
        create: jest.fn<any>().mockResolvedValue({
          embed: mockEmbed,
          destroy: mockDestroy,
        }),
      };

      const result = await embedText("Hello embed");
      expect(result).toEqual({ embeddings: [[0.1, 0.2, 0.3]] });
      expect(mockEmbed).toHaveBeenCalledWith("Hello embed");
      expect(mockDestroy).toHaveBeenCalled();
    });

    it("throws error when SemanticEmbedder is not available", async () => {
      delete (globalThis as any).SemanticEmbedder;
      await expect(embedText("Hello embed")).rejects.toThrow(
        /Semantic Embedder API is not supported/,
      );
    });
  });
});
