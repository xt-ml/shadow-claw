import { jest } from "@jest/globals";
import {
  ensureBuiltinAiPolyfills,
  isBuiltinTaskSupported,
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
  });

  afterEach(() => {
    (globalThis as any).LanguageModel = originalGlobals.LanguageModel;
    (globalThis as any).Summarizer = originalGlobals.Summarizer;
    (globalThis as any).Writer = originalGlobals.Writer;
    (globalThis as any).Rewriter = originalGlobals.Rewriter;
    (globalThis as any).LanguageDetector = originalGlobals.LanguageDetector;
    (globalThis as any).Translator = originalGlobals.Translator;
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
