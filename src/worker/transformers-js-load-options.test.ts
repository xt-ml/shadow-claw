import { getPreferredDtypes } from "./transformers-js-load-options.js";

describe("getPreferredDtypes", () => {
  it("prefers quantized dtypes for webgpu", () => {
    expect(
      getPreferredDtypes("webgpu", "onnx-community/gemma-3-1b-it-ONNX", 8),
    ).toEqual(["q4f16", "q4", "fp16"]);
  });

  it("avoids fp32 fallback for 1B cpu models", () => {
    expect(
      getPreferredDtypes("cpu", "onnx-community/gemma-3-1b-it-ONNX", 16),
    ).toEqual(["q8", "q4", "fp16"]);
  });

  it("allows fp32 fallback only for small cpu models on high-memory devices", () => {
    expect(
      getPreferredDtypes("cpu", "onnx-community/Qwen3-0.6B-ONNX", 16),
    ).toEqual(["q8", "q4", "fp16", "fp32"]);
  });

  it("supports explicit quality mode for cpu", () => {
    expect(
      getPreferredDtypes(
        "cpu",
        "onnx-community/gemma-3-1b-it-ONNX",
        8,
        "quality",
      ),
    ).toEqual(["fp32", "fp16", "q8", "q4"]);
  });

  it("supports explicit memory mode for cpu", () => {
    expect(
      getPreferredDtypes(
        "cpu",
        "onnx-community/gemma-3-1b-it-ONNX",
        16,
        "memory",
      ),
    ).toEqual(["q4", "q8", "fp16"]);
  });
});
