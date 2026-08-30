import {
  compareLocalModelCandidates,
  isLikelyInstructionModelId,
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

    it("ranks smaller quantized ONNX models higher for transformers_js_browser", () => {
      const smallOnnx = {
        id: "onnx-community/Qwen2.5-0.5B-Instruct-q4",
        supportsTools: true,
        contextLength: 32768,
      };
      const largeNonOnnx = {
        id: "meta-llama/Llama-3-8B-Instruct",
        supportsTools: true,
        contextLength: 8192,
      };

      expect(
        compareLocalModelCandidates(
          smallOnnx,
          largeNonOnnx,
          "transformers_js_browser",
        ),
      ).toBeLessThan(0);
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
