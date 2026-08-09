import { jest } from "@jest/globals";
import {
  executeSummarizeText,
  executeWriteText,
  executeRewriteText,
  executeDetectLanguage,
  executeTranslateText,
} from "./builtin-ai.js";

describe("builtin-ai worker tools", () => {
  const originalGlobals: Record<string, any> = {};

  beforeEach(() => {
    originalGlobals.Summarizer = (globalThis as any).Summarizer;
    originalGlobals.Writer = (globalThis as any).Writer;
    originalGlobals.Rewriter = (globalThis as any).Rewriter;
    originalGlobals.LanguageDetector = (globalThis as any).LanguageDetector;
    originalGlobals.Translator = (globalThis as any).Translator;
  });

  afterEach(() => {
    (globalThis as any).Summarizer = originalGlobals.Summarizer;
    (globalThis as any).Writer = originalGlobals.Writer;
    (globalThis as any).Rewriter = originalGlobals.Rewriter;
    (globalThis as any).LanguageDetector = originalGlobals.LanguageDetector;
    (globalThis as any).Translator = originalGlobals.Translator;
  });

  describe("executeSummarizeText", () => {
    it("returns error message when text is missing", async () => {
      const res = await executeSummarizeText({});
      expect(res).toBe("Error: text is required for summarize_text");
    });

    it("calls summarizeText and returns output", async () => {
      (globalThis as any).Summarizer = {
        create: jest.fn<any>().mockResolvedValue({
          summarize: jest.fn<any>().mockResolvedValue("Bullet point 1"),
          destroy: jest.fn<any>(),
        }),
      };

      const res = await executeSummarizeText({
        text: "Hello world",
        type: "key-points",
      });
      expect(res).toBe("Bullet point 1");
    });
  });

  describe("executeWriteText", () => {
    it("returns error message when prompt is missing", async () => {
      const res = await executeWriteText({});
      expect(res).toBe("Error: prompt is required for write_text");
    });

    it("calls writeText and returns output", async () => {
      (globalThis as any).Writer = {
        create: jest.fn<any>().mockResolvedValue({
          write: jest.fn<any>().mockResolvedValue("Once upon a time"),
          destroy: jest.fn<any>(),
        }),
      };

      const res = await executeWriteText({ prompt: "Write a story" });
      expect(res).toBe("Once upon a time");
    });
  });

  describe("executeRewriteText", () => {
    it("returns error message when text is missing", async () => {
      const res = await executeRewriteText({});
      expect(res).toBe("Error: text is required for rewrite_text");
    });

    it("calls rewriteText and returns output", async () => {
      (globalThis as any).Rewriter = {
        create: jest.fn<any>().mockResolvedValue({
          rewrite: jest.fn<any>().mockResolvedValue("Formal greeting"),
          destroy: jest.fn<any>(),
        }),
      };

      const res = await executeRewriteText({
        text: "Hey",
        tone: "more-formal",
      });
      expect(res).toBe("Formal greeting");
    });
  });

  describe("executeDetectLanguage", () => {
    it("returns error message when text is missing", async () => {
      const res = await executeDetectLanguage({});
      expect(res).toBe("Error: text is required for detect_language");
    });

    it("calls detectLanguage and returns JSON output", async () => {
      (globalThis as any).LanguageDetector = {
        create: jest.fn<any>().mockResolvedValue({
          detect: jest
            .fn<any>()
            .mockResolvedValue([{ detectedLanguage: "fr", confidence: 0.95 }]),
          destroy: jest.fn<any>(),
        }),
      };

      const res = await executeDetectLanguage({ text: "Bonjour" });
      expect(JSON.parse(res)).toEqual([
        { detectedLanguage: "fr", confidence: 0.95 },
      ]);
    });
  });

  describe("executeTranslateText", () => {
    it("returns error message when required parameters are missing", async () => {
      const res = await executeTranslateText({ text: "Hello" });
      expect(res).toBe(
        "Error: text, sourceLanguage, and targetLanguage are required for translate_text",
      );
    });

    it("calls translateText and returns output", async () => {
      (globalThis as any).Translator = {
        create: jest.fn<any>().mockResolvedValue({
          translate: jest.fn<any>().mockResolvedValue("Bonjour"),
          destroy: jest.fn<any>(),
        }),
      };

      const res = await executeTranslateText({
        text: "Hello",
        sourceLanguage: "en",
        targetLanguage: "fr",
      });
      expect(res).toBe("Bonjour");
    });
  });
});
