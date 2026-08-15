import {
  getPreferredDtypes,
  normalizeDtypeStrategy,
} from "./transformers-js-load-options.js";

describe("normalizeDtypeStrategy", () => {
  it("normalizes explicit dtype strategies", () => {
    expect(normalizeDtypeStrategy("q4f16")).toBe("q4f16");
    expect(normalizeDtypeStrategy("q4")).toBe("q4");
    expect(normalizeDtypeStrategy("q8")).toBe("q8");
    expect(normalizeDtypeStrategy("fp16")).toBe("fp16");
    expect(normalizeDtypeStrategy("fp32")).toBe("fp32");
    expect(normalizeDtypeStrategy("memory")).toBe("memory");
    expect(normalizeDtypeStrategy("balanced")).toBe("balanced");
    expect(normalizeDtypeStrategy("quality")).toBe("quality");
    expect(normalizeDtypeStrategy("auto")).toBe("auto");
    expect(normalizeDtypeStrategy(undefined)).toBe("auto");
    expect(normalizeDtypeStrategy("unknown")).toBe("auto");
  });
});

describe("getPreferredDtypes", () => {
  it("prefers quantized dtypes for webgpu in auto mode", () => {
    expect(
      getPreferredDtypes("webgpu", "onnx-community/gemma-3-1b-it-ONNX", 8),
    ).toEqual(["q4f16", "q4", "fp16"]);
    expect(
      getPreferredDtypes("webgpu", "onnx-community/Qwen3-0.6B-ONNX", 8),
    ).toEqual(["q4f16", "q4", "fp16"]);
  });

  it("prefers q4f16 first for cpu models in auto mode", () => {
    expect(
      getPreferredDtypes("cpu", "onnx-community/gemma-3-1b-it-ONNX", 16),
    ).toEqual(["q4f16", "q4", "q8", "fp16"]);
  });

  it("allows fp32 fallback only for small cpu models on high-memory devices in auto mode", () => {
    expect(
      getPreferredDtypes("cpu", "onnx-community/Qwen3-0.6B-ONNX", 16),
    ).toEqual(["q4f16", "q4", "q8", "fp16", "fp32"]);
  });

  it("supports explicit user-selected dtype overrides", () => {
    expect(
      getPreferredDtypes("webgpu", "onnx-community/Qwen3-0.6B-ONNX", 8, "q4"),
    ).toEqual(["q4", "q4f16", "q8", "fp16"]);

    expect(
      getPreferredDtypes(
        "webgpu",
        "onnx-community/Qwen3-0.6B-ONNX",
        8,
        "q4f16",
      ),
    ).toEqual(["q4f16", "q4", "fp16"]);

    expect(
      getPreferredDtypes("cpu", "onnx-community/Qwen3-0.6B-ONNX", 8, "q8"),
    ).toEqual(["q8", "q4", "fp16"]);

    expect(
      getPreferredDtypes("webgpu", "onnx-community/Qwen3-0.6B-ONNX", 8, "fp16"),
    ).toEqual(["fp16", "q4f16", "q4"]);

    expect(
      getPreferredDtypes("cpu", "onnx-community/Qwen3-0.6B-ONNX", 8, "fp32"),
    ).toEqual(["fp32", "fp16", "q8", "q4"]);
  });

  it("supports explicit quality mode for cpu and webgpu", () => {
    expect(
      getPreferredDtypes(
        "cpu",
        "onnx-community/gemma-3-1b-it-ONNX",
        8,
        "quality",
      ),
    ).toEqual(["fp32", "fp16", "q8", "q4"]);

    expect(
      getPreferredDtypes(
        "webgpu",
        "onnx-community/gemma-3-1b-it-ONNX",
        8,
        "quality",
      ),
    ).toEqual(["fp16", "q4f16", "q4"]);
  });

  it("supports explicit memory mode for cpu and webgpu", () => {
    expect(
      getPreferredDtypes(
        "cpu",
        "onnx-community/gemma-3-1b-it-ONNX",
        16,
        "memory",
      ),
    ).toEqual(["q4", "q8", "fp16"]);

    expect(
      getPreferredDtypes(
        "webgpu",
        "onnx-community/gemma-3-1b-it-ONNX",
        16,
        "memory",
      ),
    ).toEqual(["q4", "q4f16", "fp16"]);
  });

  it("supports explicit balanced mode for cpu and webgpu", () => {
    expect(
      getPreferredDtypes(
        "cpu",
        "onnx-community/gemma-3-1b-it-ONNX",
        16,
        "balanced",
      ),
    ).toEqual(["q4f16", "q4", "q8", "fp16", "fp32"]);

    expect(
      getPreferredDtypes(
        "webgpu",
        "onnx-community/gemma-3-1b-it-ONNX",
        16,
        "balanced",
      ),
    ).toEqual(["q4f16", "q4", "fp16"]);
  });
});
