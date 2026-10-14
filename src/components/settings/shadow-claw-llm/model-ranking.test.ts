import {
  compareLocalModelCandidates,
  getSortedTransformersJsBrowserModelIds,
  isLikelyInstructionModelId,
  ORIGINAL_PROMPT_API_MODELS,
  renderTransformersJsBrowserModelOptions,
} from "./model-ranking.js";

describe("model-ranking", () => {
  describe("isLikelyInstructionModelId", () => {
    it("identifies instruction/chat model names correctly", () => {
      expect(isLikelyInstructionModelId("meta-llama/Llama-3-8B-Instruct")).toBe(
        true,
      );
      expect(isLikelyInstructionModelId("google/gemma-2-2b-it")).toBe(true);
      expect(isLikelyInstructionModelId("mistralai/Mistral-7B-Chat-v0.3")).toBe(
        true,
      );
      expect(isLikelyInstructionModelId("org/model-assistant-v1")).toBe(true);
      expect(isLikelyInstructionModelId("org/model-tool-v2")).toBe(true);
      expect(
        isLikelyInstructionModelId("onnx-community/Qwen2.5-0.5B-Instruct"),
      ).toBe(true);
      expect(
        isLikelyInstructionModelId("deepseek-ai/deepseek-r1-distill-qwen-1.5b"),
      ).toBe(true);
    });

    it("returns false for non-instruction base model names", () => {
      expect(isLikelyInstructionModelId("bert-base-uncased")).toBe(false);
      expect(isLikelyInstructionModelId("gpt2")).toBe(false);
      expect(isLikelyInstructionModelId("t5-small")).toBe(false);
    });
  });

  describe("compareLocalModelCandidates", () => {
    it("prioritizes models supporting tools over unsupported", () => {
      const a = {
        id: "model-a-instruct-onnx-0.5b",
        supportsTools: true,
        contextLength: 8192,
      };
      const b = {
        id: "model-b-instruct-onnx-0.5b",
        supportsTools: false,
        contextLength: 8192,
      };

      expect(compareLocalModelCandidates(a, b, "local")).toBeLessThan(0);
      expect(compareLocalModelCandidates(b, a, "local")).toBeGreaterThan(0);
    });

    it("ranks the original 4 prompt api models at the top in order, with remainder models alphabetized for transformers_js_browser", () => {
      const qwen3 = {
        id: "onnx-community/Qwen3-0.6B-ONNX",
        supportsTools: true,
        contextLength: 32768,
      };
      const gemma3 = {
        id: "onnx-community/gemma-3-1b-it-ONNX-GQA",
        supportsTools: true,
        contextLength: 8192,
      };
      const gemma4E2B = {
        id: "onnx-community/gemma-4-E2B-it-ONNX",
        supportsTools: true,
        contextLength: 128000,
      };
      const gemma4E4B = {
        id: "onnx-community/gemma-4-E4B-it-ONNX",
        supportsTools: true,
        contextLength: 128000,
      };
      const remainderA = {
        id: "HuggingFaceTB/SmolLM3-3B-ONNX",
        supportsTools: true,
        contextLength: 8192,
      };
      const remainderZ = {
        id: "webgpu/Qwen3-4B-ONNX",
        supportsTools: true,
        contextLength: 8192,
      };

      // Top 4 in order
      expect(
        compareLocalModelCandidates(qwen3, gemma3, "transformers_js_browser"),
      ).toBeLessThan(0);
      expect(
        compareLocalModelCandidates(
          gemma3,
          gemma4E2B,
          "transformers_js_browser",
        ),
      ).toBeLessThan(0);
      expect(
        compareLocalModelCandidates(
          gemma4E2B,
          gemma4E4B,
          "transformers_js_browser",
        ),
      ).toBeLessThan(0);

      // Top 4 vs remainder
      expect(
        compareLocalModelCandidates(
          gemma4E4B,
          remainderA,
          "transformers_js_browser",
        ),
      ).toBeLessThan(0);
      expect(
        compareLocalModelCandidates(
          remainderA,
          qwen3,
          "transformers_js_browser",
        ),
      ).toBeGreaterThan(0);

      // Remainder alphabetized
      expect(
        compareLocalModelCandidates(
          remainderA,
          remainderZ,
          "transformers_js_browser",
        ),
      ).toBeLessThan(0);
      expect(
        compareLocalModelCandidates(
          remainderZ,
          remainderA,
          "transformers_js_browser",
        ),
      ).toBeGreaterThan(0);
    });

    it("getSortedTransformersJsBrowserModelIds returns original 4 at top and remainder alphabetized", () => {
      const sorted = getSortedTransformersJsBrowserModelIds();
      expect(sorted.slice(0, 4)).toEqual(ORIGINAL_PROMPT_API_MODELS);
      const remainder = sorted.slice(4);
      const remainderSorted = [...remainder].sort((a, b) => a.localeCompare(b));
      expect(remainder).toEqual(remainderSorted);
    });

    it("renderTransformersJsBrowserModelOptions renders top 4 models, hr separator, and alphabetized remainder", () => {
      const html = renderTransformersJsBrowserModelOptions(
        "onnx-community/Qwen3-0.6B-ONNX",
      );

      // Verify top 4 models rendered with curated labels
      expect(html).toContain(
        '<option value="onnx-community/Qwen3-0.6B-ONNX" selected>onnx-community/Qwen3-0.6B-ONNX — Recommended (Fast, Compact &amp; Tool Calling)</option>',
      );
      expect(html).toContain(
        '<option value="onnx-community/gemma-3-1b-it-ONNX-GQA">onnx-community/gemma-3-1b-it-ONNX-GQA — Alternative (1B Parameters)</option>',
      );
      expect(html).toContain(
        '<option value="onnx-community/gemma-4-E2B-it-ONNX">onnx-community/gemma-4-E2B-it-ONNX — Alternative (2B Parameters, 128k Context)</option>',
      );
      expect(html).toContain(
        '<option value="onnx-community/gemma-4-E4B-it-ONNX">onnx-community/gemma-4-E4B-it-ONNX — Alternative (4B Parameters, 128k Context)</option>',
      );

      // Verify <hr /> separator is placed after top 4 models
      const idxGemma4E4B = html.indexOf(
        'value="onnx-community/gemma-4-E4B-it-ONNX"',
      );
      const idxHr = html.indexOf("<hr>");
      const idxSmol = html.indexOf('value="HuggingFaceTB/SmolLM3-3B-ONNX"');

      expect(idxHr).toBeGreaterThan(idxGemma4E4B);
      expect(idxHr).toBeLessThan(idxSmol);

      // Verify custom model option is appended when requested
      const withCustom = renderTransformersJsBrowserModelOptions(
        "onnx-community/Qwen3-0.6B-ONNX",
        undefined,
        { includeCustom: true },
      );
      expect(withCustom).toContain(
        '<option value="__custom__">-- Custom Model ID --</option>',
      );
    });

    it("handles various model sizes (0.7b, 1.1b, 1.5b, 7b, unstated size)", () => {
      const m07 = {
        id: "model-0.7b-onnx",
        supportsTools: true,
        contextLength: 4096,
      };
      const m11 = {
        id: "model-1.1b-onnx",
        supportsTools: true,
        contextLength: 4096,
      };
      const m15 = {
        id: "model-1.5b-onnx",
        supportsTools: true,
        contextLength: 4096,
      };
      const m7b = {
        id: "model-7b-onnx",
        supportsTools: true,
        contextLength: 4096,
      };
      const mNoSize = {
        id: "model-onnx",
        supportsTools: true,
        contextLength: 4096,
      };

      expect(compareLocalModelCandidates(m07, m11, "local")).toBeLessThan(0);
      expect(compareLocalModelCandidates(m11, m15, "local")).toBeLessThan(0);
      expect(compareLocalModelCandidates(m15, mNoSize, "local")).toBeLessThan(
        0,
      );
      expect(compareLocalModelCandidates(mNoSize, m7b, "local")).toBeLessThan(
        0,
      );
    });

    it("handles Gemma style E2B/E4B IDs and tie-breaking by context length and id", () => {
      const gemma = {
        id: "google/gemma-e2b-it-onnx",
        supportsTools: true,
        contextLength: 8192,
      };
      const gemmaHighCtx = {
        id: "google/gemma-e2b-it-onnx",
        supportsTools: true,
        contextLength: 16384,
      };

      // Equal score -> higher context length wins (score negative)
      expect(
        compareLocalModelCandidates(gemmaHighCtx, gemma, "local"),
      ).toBeLessThan(0);

      // Same context length -> alphabetical tie break
      const m1 = {
        id: "model-1-onnx-0.5b",
        supportsTools: true,
        contextLength: 4096,
      };
      const m2 = {
        id: "model-2-onnx-0.5b",
        supportsTools: true,
        contextLength: 4096,
      };
      expect(compareLocalModelCandidates(m1, m2, "local")).toBeLessThan(0);
    });

    it("scores reasoning/thinking models appropriately", () => {
      const normal = {
        id: "qwen-0.5b-onnx-q4",
        supportsTools: true,
        contextLength: 8192,
      };
      const thinking = {
        id: "qwen-0.5b-thinking-onnx-q4",
        supportsTools: true,
        contextLength: 8192,
      };

      expect(
        compareLocalModelCandidates(normal, thinking, "local"),
      ).toBeLessThan(0);
    });
  });
});
