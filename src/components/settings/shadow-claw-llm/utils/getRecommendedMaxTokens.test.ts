import { modelRegistry } from "../../../../subsystems/providers/model-registry.js";
import { getRecommendedMaxTokens } from "./getRecommendedMaxTokens.js";

describe("getRecommendedMaxTokens", () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    modelRegistry.clear();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  function setNavigatorHardware(memory?: number, concurrency?: number) {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...originalNavigator,
        deviceMemory: memory,
        hardwareConcurrency: concurrency,
      },
      configurable: true,
      writable: true,
    });
  }

  describe("Prompt API fallback resolution", () => {
    it("resolves default fallback Qwen3-0.6B-ONNX with 131,072 native context when Prompt API is unsupported", () => {
      setNavigatorHardware(16, 8);
      const res = getRecommendedMaxTokens("prompt_api", "browser-built-in");

      expect(res.detail).toContain("131,072 tokens");
      expect(res.detail).toContain("Model ceiling: 32,768");
      expect(res.recommended).toBe(8192);
    });

    it("resolves explicitly provided fallbackModelId", () => {
      setNavigatorHardware(16, 8);
      const res = getRecommendedMaxTokens(
        "prompt_api",
        "browser-built-in",
        "onnx-community/gemma-3-1b-it-ONNX-GQA",
      );

      expect(res.detail).toContain("128,000 tokens");
      expect(res.detail).toContain("Model ceiling: 32,768");
      expect(res.recommended).toBe(8192);
    });

    it("uses dynamic modelRegistry context window when present", () => {
      setNavigatorHardware(32, 16);
      modelRegistry.registerModelInfo("onnx-community/Qwen3-0.6B-ONNX", {
        contextWindow: 131072,
        maxOutput: null,
      });

      const res = getRecommendedMaxTokens("prompt_api", "browser-built-in");

      expect(res.detail).toContain("131,072 tokens");
      // Ceiling is 65,536 when dynamic contextWindow >= 100,000
      expect(res.detail).toContain("Model ceiling: 65,536");
      expect(res.recommended).toBe(16384);
    });
  });

  describe("Hardware-aware scaling for local inference", () => {
    it("scales down for constrained hardware (low RAM, 4 CPU threads)", () => {
      setNavigatorHardware(4, 4);
      const res = getRecommendedMaxTokens(
        "transformers_js_browser",
        "onnx-community/Qwen3-0.6B-ONNX",
      );

      expect(res.recommended).toBe(2048);
      expect(res.detail).toContain("4 GB browser-reported memory");
      expect(res.detail).toContain("4 CPU threads");
    });

    it("scales up for high-end hardware (32GB RAM, 16 CPU threads)", () => {
      setNavigatorHardware(32, 16);
      const res = getRecommendedMaxTokens(
        "transformers_js_browser",
        "onnx-community/gemma-3-1b-it-ONNX",
      );

      expect(res.recommended).toBe(16384);
      expect(res.detail).toContain("32 GB browser-reported memory");
      expect(res.detail).toContain("16 CPU threads");
    });
  });

  describe("Cloud providers", () => {
    it("returns model ceiling directly for cloud providers", () => {
      const res = getRecommendedMaxTokens("openai", "gpt-4o");

      expect(res.recommended).toBe(16384);
      expect(res.detail).toBe("Model-aware ceiling: 16,384 tokens.");
    });

    it("returns generous ceiling for Claude Sonnet 4", () => {
      const res = getRecommendedMaxTokens("anthropic", "claude-sonnet-4");

      expect(res.recommended).toBe(64000);
      expect(res.detail).toBe("Model-aware ceiling: 64,000 tokens.");
    });
  });
});
