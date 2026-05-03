import {
  compareLocalModelCandidates,
  isLikelyInstructionModelId,
} from "./model-ranking.js";

describe("model-ranking", () => {
  it("detects instruction-oriented local IDs", () => {
    expect(
      isLikelyInstructionModelId("onnx-community/gemma-3-1b-it-ONNX"),
    ).toBe(true);
    expect(isLikelyInstructionModelId("onnx-community/Qwen3-0.6B-ONNX")).toBe(
      true,
    );
    expect(isLikelyInstructionModelId("some-org/base-embedding-model")).toBe(
      false,
    );
  });

  it("ranks small ONNX instruction models above larger ones for browser provider", () => {
    const small = {
      id: "onnx-community/Qwen3-0.6B-ONNX",
      supportsTools: true,
      contextLength: 32768,
    };
    const medium = {
      id: "onnx-community/gemma-3-1b-it-ONNX",
      supportsTools: true,
      contextLength: 32768,
    };
    const large = {
      id: "onnx-community/gemma-4-E4B-it-ONNX",
      supportsTools: true,
      contextLength: 131072,
    };

    expect(
      compareLocalModelCandidates(small, medium, "transformers_js_browser"),
    ).toBeLessThan(0);
    expect(
      compareLocalModelCandidates(medium, large, "transformers_js_browser"),
    ).toBeLessThan(0);
  });

  it("de-prioritizes non-ONNX candidates for browser provider", () => {
    const onnxCandidate = {
      id: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
      supportsTools: true,
      contextLength: 16384,
    };
    const nonOnnxCandidate = {
      id: "google/gemma-4-E2B-it",
      supportsTools: true,
      contextLength: 131072,
    };

    expect(
      compareLocalModelCandidates(
        onnxCandidate,
        nonOnnxCandidate,
        "transformers_js_browser",
      ),
    ).toBeLessThan(0);
  });
});
