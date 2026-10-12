import { jest } from "@jest/globals";
import {
  buildPromptApiHelpDialogOptions,
  isNativePromptApiSupported,
  isNativePromptApiAvailable,
  isPromptApiPotentiallySupported,
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

    it("should return false when TRANSFORMERS_CONFIG is defined", () => {
      const mockLm = { create: () => {} };
      (globalThis as any).LanguageModel = mockLm;
      (globalThis as any).TRANSFORMERS_CONFIG = {};
      expect(isNativePromptApiSupported()).toBe(false);
      delete (globalThis as any).TRANSFORMERS_CONFIG;
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

  describe("isNativePromptApiAvailable", () => {
    it("should return true when availability() is readily or downloadable", async () => {
      const mockLm = {
        create: () => {},
        availability: jest.fn().mockResolvedValue("readily"),
      };
      (globalThis as any).LanguageModel = mockLm;
      expect(await isNativePromptApiAvailable()).toBe(true);

      mockLm.availability.mockResolvedValue("after-download");
      expect(await isNativePromptApiAvailable()).toBe(true);
    });

    it("should return false when availability() is unavailable or no", async () => {
      const mockLm = {
        create: () => {},
        availability: jest.fn().mockResolvedValue("unavailable"),
      };
      (globalThis as any).LanguageModel = mockLm;
      expect(await isNativePromptApiAvailable()).toBe(false);

      mockLm.availability.mockResolvedValue("no");
      expect(await isNativePromptApiAvailable()).toBe(false);
    });

    it("should return false when availability() throws", async () => {
      const mockLm = {
        create: () => {},
        availability: jest.fn().mockRejectedValue(new Error("API disabled")),
      };
      (globalThis as any).LanguageModel = mockLm;
      expect(await isNativePromptApiAvailable()).toBe(false);
    });

    it("should return false when LanguageModel is not supported", async () => {
      delete (globalThis as any).LanguageModel;
      delete (globalThis as any).ai;
      expect(await isNativePromptApiAvailable()).toBe(false);
    });
  });

  describe("isPromptApiPotentiallySupported", () => {
    it("should return false to treat undetected prompt API as unavailable", () => {
      expect(isPromptApiPotentiallySupported()).toBe(false);
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
