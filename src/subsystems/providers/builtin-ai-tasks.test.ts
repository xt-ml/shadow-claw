import { jest } from "@jest/globals";
import {
  createTaskInstanceWithFallback,
  ensureBuiltinAiPolyfills,
  isBuiltinTaskSupported,
  isWebGpuAdapterAvailable,
  summarizeText,
  writeText,
  rewriteText,
  detectLanguage,
  translateText,
} from "./builtin-ai-tasks.js";

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
  });

  afterEach(() => {
    (globalThis as any).LanguageModel = originalGlobals.LanguageModel;
    (globalThis as any).Summarizer = originalGlobals.Summarizer;
    (globalThis as any).Writer = originalGlobals.Writer;
    (globalThis as any).Rewriter = originalGlobals.Rewriter;
    (globalThis as any).LanguageDetector = originalGlobals.LanguageDetector;
    (globalThis as any).Translator = originalGlobals.Translator;
    delete (globalThis as any).TRANSFORMERS_CONFIG;
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
  });

  describe("createTaskInstanceWithFallback", () => {
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
  });

  describe("isBuiltinTaskSupported", () => {
    it("returns false when global task class is missing", () => {
      delete (globalThis as any).Summarizer;
      expect(isBuiltinTaskSupported("summarizer")).toBe(false);
    });

    it("returns true when global task class is present", () => {
      (globalThis as any).Summarizer = class {};
      expect(isBuiltinTaskSupported("summarizer")).toBe(true);
    });
  });

  describe("ensureBuiltinAiPolyfills", () => {
    it("runs without error and attempts polyfill load when globals are absent", async () => {
      await expect(ensureBuiltinAiPolyfills()).resolves.not.toThrow();
    });

    it("configures wasm device when WebGPU requestAdapter returns null", async () => {
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
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });
  });

  describe("summarizeText", () => {
    it("calls Summarizer.create and summarizer.summarize", async () => {
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

    it("throws clear error when Summarizer API fails or is missing", async () => {
      (globalThis as any).Summarizer = {
        create: jest.fn<any>().mockImplementation(() => {
          throw new Error("Summarizer API is not supported or polyfilled");
        }),
      };
      await expect(summarizeText("Test text")).rejects.toThrow(
        "Summarizer API is not supported",
      );
    });
  });

  describe("writeText", () => {
    it("calls Writer.create and writer.write", async () => {
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
  });

  describe("rewriteText", () => {
    it("calls Rewriter.create and rewriter.rewrite", async () => {
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
  });
});
