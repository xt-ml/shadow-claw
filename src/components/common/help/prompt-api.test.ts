import {
  buildPromptApiHelpDialogOptions,
  isNativePromptApiSupported,
  PROMPT_API_DOCS_URL,
  renderPromptApiStatusHtml,
} from "./prompt-api.js";

describe("prompt-api help and capability utilities", () => {
  const originalLanguageModel = (globalThis as any).LanguageModel;
  const originalAi = (globalThis as any).ai;
  const originalWindowLanguageModel =
    typeof window !== "undefined" ? (window as any).LanguageModel : undefined;
  const originalWindowAi =
    typeof window !== "undefined" ? (window as any).ai : undefined;

  afterEach(() => {
    (globalThis as any).LanguageModel = originalLanguageModel;
    (globalThis as any).ai = originalAi;
    if (typeof window !== "undefined") {
      (window as any).LanguageModel = originalWindowLanguageModel;
      (window as any).ai = originalWindowAi;
    }
  });

  describe("isNativePromptApiSupported", () => {
    it("should return true when window.LanguageModel.create is a function", () => {
      const mockLm = { create: () => {} };
      (globalThis as any).LanguageModel = mockLm;
      if (typeof window !== "undefined") {
        (window as any).LanguageModel = mockLm;
      }
      expect(isNativePromptApiSupported()).toBe(true);
    });

    it("should return true when window.ai.languageModel.create is a function", () => {
      delete (globalThis as any).LanguageModel;
      if (typeof window !== "undefined") {
        delete (window as any).LanguageModel;
      }
      const mockAi = {
        languageModel: {
          create: () => {},
        },
      };
      (globalThis as any).ai = mockAi;
      if (typeof window !== "undefined") {
        (window as any).ai = mockAi;
      }
      expect(isNativePromptApiSupported()).toBe(true);
    });

    it("should return false when LanguageModel and ai are undefined", () => {
      delete (globalThis as any).LanguageModel;
      delete (globalThis as any).ai;
      if (typeof window !== "undefined") {
        delete (window as any).LanguageModel;
        delete (window as any).ai;
      }
      expect(isNativePromptApiSupported()).toBe(false);
    });
  });

  describe("renderPromptApiStatusHtml", () => {
    it("should render native detected markup when supported is true", () => {
      const html = renderPromptApiStatusHtml(true);
      expect(html).toContain("Native Prompt API detected");
      expect(html).toContain("chat__prompt-api-badge--success");
      expect(html).toContain("built-in on-device AI support enabled");
    });

    it("should render fallback and flags instructions when supported is false", () => {
      const html = renderPromptApiStatusHtml(false);
      expect(html).toContain("Native Prompt API not detected");
      expect(html).toContain("chat__prompt-api-badge--warning");
      expect(html).toContain("chrome://flags");
      expect(html).toContain("#prompt-api-for-gemini-nano");
      expect(html).toContain("on-device model");
    });
  });

  describe("buildPromptApiHelpDialogOptions", () => {
    it("should build default dialog options with docs link", () => {
      const options = buildPromptApiHelpDialogOptions();
      expect(options.mode).toBe("info");
      expect(options.title).toBe("Prompt API Setup & Info");
      expect(options.autoCloseSeconds).toBe(30);
      expect(options.message).toContain("Prompt API");
      expect(options.links).toEqual([
        {
          label: "Prompt API Documentation",
          href: PROMPT_API_DOCS_URL,
        },
      ]);
      expect(options.details?.length).toBeGreaterThan(0);
    });

    it("should append reason to details if supplied", () => {
      const options = buildPromptApiHelpDialogOptions("Model quota exceeded");
      expect(options.details).toContain("Details: Model quota exceeded");
    });
  });
});
