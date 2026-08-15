import {
  DEFAULT_PROMPT_API_MODEL_SIZE_BYTES,
  PromptApiProgressAggregator,
} from "./promptApiProgressAggregator.js";

describe("PromptApiProgressAggregator", () => {
  it("exports a non-zero default model size constant", () => {
    expect(DEFAULT_PROMPT_API_MODEL_SIZE_BYTES).toBeGreaterThan(
      800 * 1024 * 1024,
    );
  });

  it("does not prematurely lock at 100% or flicker when a small metadata file finishes before the large model file", () => {
    const emitted: Array<{
      status: string;
      progress: number | null;
      message: string;
    }> = [];
    const aggregator = new PromptApiProgressAggregator(
      (status, progress, message) => {
        emitted.push({ status, progress, message });
      },
      // Simulating a case where expected total was set to 20 MB (metadata only)
      { expectedTotalBytes: 20 * 1024 * 1024 },
    );

    const tokenizerUrl = "https://example.com/tokenizer.json";
    const modelUrl = "https://example.com/model_q4.onnx_data";

    // Tokenizer downloads 20 MB and completes
    aggregator.onStreamProgress(
      tokenizerUrl,
      20 * 1024 * 1024,
      20 * 1024 * 1024,
      true,
    );
    expect(emitted[emitted.length - 1]?.progress).toBe(1);
    expect(emitted[emitted.length - 1]?.message).toContain(
      "20.0 / 20.0 MB · 100%",
    );

    // Large model file stream arrives: 135.4 MB of 839.0 MB
    aggregator.onStreamProgress(
      modelUrl,
      135.4 * 1024 * 1024,
      839 * 1024 * 1024,
      false,
    );

    // The display MUST recalculate for the expanded total (155.4 MB / 859.0 MB ≈ 18%)
    // and must NOT be stuck at 100%!
    const latest = emitted[emitted.length - 1];
    expect(latest?.message).not.toContain("100%");
    expect(latest?.message).toContain("155.4 / 859.0 MB · 18%");
    expect(latest?.progress).toBeCloseTo(155.4 / 859.0, 2);
  });

  it("ignores coarse polyfill fractional events while active stream progress is ongoing to avoid flickering", () => {
    const emitted: Array<{
      status: string;
      progress: number | null;
      message: string;
    }> = [];
    const aggregator = new PromptApiProgressAggregator(
      (status, progress, message) => {
        emitted.push({ status, progress, message });
      },
      { expectedTotalBytes: 800 * 1024 * 1024 },
    );

    const modelUrl = "https://example.com/model_q4.onnx_data";

    // Active byte stream progress
    aggregator.onStreamProgress(
      modelUrl,
      200 * 1024 * 1024,
      800 * 1024 * 1024,
      false,
    );
    expect(emitted[emitted.length - 1]?.message).toContain(
      "200.0 / 800.0 MB · 25%",
    );

    const emitCountBefore = emitted.length;

    // Polyfill fires coarse downloadprogress event (e.g. loaded: 0.01 or 1, total: 1)
    aggregator.onProgressEvent({ loaded: 0.01, total: 1 });
    aggregator.onProgressEvent({ loaded: 1, total: 1 });

    // Should NOT have overwritten with coarse values
    expect(emitted.length).toBe(emitCountBefore);
    expect(emitted[emitted.length - 1]?.message).toContain(
      "200.0 / 800.0 MB · 25%",
    );

    // Further stream progress works as expected
    aggregator.onStreamProgress(
      modelUrl,
      400 * 1024 * 1024,
      800 * 1024 * 1024,
      false,
    );
    expect(emitted[emitted.length - 1]?.message).toContain(
      "400.0 / 800.0 MB · 50%",
    );
  });

  it("formats fractional polyfill progress events into MB and percentage monotonically", () => {
    const emitted: Array<{
      status: string;
      progress: number | null;
      message: string;
    }> = [];
    const aggregator = new PromptApiProgressAggregator(
      (status, progress, message) => {
        emitted.push({ status, progress, message });
      },
      { expectedTotalBytes: 800 * 1024 * 1024 }, // 800 MB
    );

    // Initial 0%
    aggregator.onProgressEvent({ loaded: 0, total: 1 });
    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual({
      status: "running",
      progress: 0,
      message: "Downloading Prompt API model... (0.0 / 800.0 MB · 0%)",
    });

    // 1% from polyfill
    aggregator.onProgressEvent({ loaded: 0.0125, total: 1 });
    expect(emitted[emitted.length - 1]).toEqual({
      status: "running",
      progress: 0.0125,
      message: "Downloading Prompt API model... (10.0 / 800.0 MB · 1%)",
    });

    // 50%
    aggregator.onProgressEvent({ loaded: 0.5, total: 1 });
    expect(emitted[emitted.length - 1]).toEqual({
      status: "running",
      progress: 0.5,
      message: "Downloading Prompt API model... (400.0 / 800.0 MB · 50%)",
    });
  });

  it("is resilient to non-monotonic progress events from multi-component downloads", () => {
    const emitted: Array<{
      status: string;
      progress: number | null;
      message: string;
    }> = [];
    const aggregator = new PromptApiProgressAggregator(
      (status, progress, message) => {
        emitted.push({ status, progress, message });
      },
      { expectedTotalBytes: 800 * 1024 * 1024 },
    );

    // Component 1 progresses to 10%
    aggregator.onProgressEvent({ loaded: 0.1, total: 1 });
    expect(emitted[emitted.length - 1]?.progress).toBe(0.1);

    // Subsequent event with lower fraction (e.g. Component 2 starts from 1%)
    aggregator.onProgressEvent({ loaded: 0.01, total: 1 });
    // Must NOT drop back down to 1%; must remain at at least 10%
    expect(emitted[emitted.length - 1]?.progress).toBe(0.1);
    expect(emitted[emitted.length - 1]?.message).toContain("10%");

    // Higher progress event arrives
    aggregator.onProgressEvent({ loaded: 0.25, total: 1 });
    expect(emitted[emitted.length - 1]?.progress).toBe(0.25);
    expect(emitted[emitted.length - 1]?.message).toContain("25%");
  });

  it("aggregates live byte-level stream progress from createModelCacheFetch across multiple URLs", () => {
    const emitted: Array<{
      status: string;
      progress: number | null;
      message: string;
    }> = [];
    const aggregator = new PromptApiProgressAggregator(
      (status, progress, message) => {
        emitted.push({ status, progress, message });
      },
      { expectedTotalBytes: 100 * 1024 * 1024 }, // 100 MB total
    );

    const file1Url = "https://example.com/model/tokenizer.json";
    const file2Url = "https://example.com/model/model.onnx_data";

    // File 1 downloads 10 MB of 10 MB
    aggregator.onStreamProgress(
      file1Url,
      10 * 1024 * 1024,
      10 * 1024 * 1024,
      true,
    );
    expect(emitted[emitted.length - 1]).toEqual({
      status: "running",
      progress: 0.1, // 10MB / 100MB
      message: "Downloading Prompt API model... (10.0 / 100.0 MB · 10%)",
    });

    // File 2 downloads 40 MB of 90 MB
    aggregator.onStreamProgress(
      file2Url,
      40 * 1024 * 1024,
      90 * 1024 * 1024,
      false,
    );
    expect(emitted[emitted.length - 1]).toEqual({
      status: "running",
      progress: 0.5, // (10MB + 40MB) / 100MB
      message: "Downloading Prompt API model... (50.0 / 100.0 MB · 50%)",
    });

    // File 2 finishes 90 MB
    aggregator.onStreamProgress(
      file2Url,
      90 * 1024 * 1024,
      90 * 1024 * 1024,
      true,
    );
    expect(emitted[emitted.length - 1]).toEqual({
      status: "running",
      progress: 1, // (10MB + 90MB) / 100MB
      message: "Downloading Prompt API model... (100.0 / 100.0 MB · 100%)",
    });
  });

  it("never bounces the displayed total when new files are discovered during download", () => {
    const emitted: Array<{
      status: string;
      progress: number | null;
      message: string;
    }> = [];
    const aggregator = new PromptApiProgressAggregator(
      (status, progress, message) => {
        emitted.push({ status, progress, message });
      },
      // Simulates DEFAULT_PROMPT_API_MODEL_SIZE_BYTES being between the two file totals
      { expectedTotalBytes: 784 * 1024 * 1024 }, // 784 MB
    );

    const modelUrl = "https://example.com/model/model_q4.onnx";
    const tokenizerUrl = "https://example.com/model/tokenizer.json";

    // Model file starts — 747 MB total (less than expectedTotalBytes)
    // effectiveTotal should be max(747, 784) = 784
    aggregator.onStreamProgress(
      modelUrl,
      100 * 1024 * 1024,
      747 * 1024 * 1024,
      false,
    );
    expect(emitted[emitted.length - 1]?.message).toContain("784.0 MB");

    // Model makes more progress (still only one file known)
    aggregator.onStreamProgress(
      modelUrl,
      400 * 1024 * 1024,
      747 * 1024 * 1024,
      false,
    );
    expect(emitted[emitted.length - 1]?.message).toContain("784.0 MB");

    // Tokenizer starts — sumTotal becomes 747 + 138 = 885 MB (exceeds expectedTotalBytes)
    // The displayed total must NOT drop — it should go from 784 to 885, never back
    aggregator.onStreamProgress(
      tokenizerUrl,
      10 * 1024 * 1024,
      138 * 1024 * 1024,
      false,
    );
    expect(emitted[emitted.length - 1]?.message).toContain("885.0 MB");

    // Verify the displayed total NEVER decreased across ALL emissions
    const totalPattern = /\/ (\d+\.\d+) MB/;
    let maxTotal = 0;
    for (const e of emitted) {
      const match = e.message.match(totalPattern);
      if (match) {
        const total = parseFloat(match[1]);
        expect(total).toBeGreaterThanOrEqual(maxTotal);
        maxTotal = total;
      }
    }
  });

  it("handles native Chrome raw byte events with explicit total", () => {
    const emitted: Array<{
      status: string;
      progress: number | null;
      message: string;
    }> = [];
    const aggregator = new PromptApiProgressAggregator(
      (status, progress, message) => {
        emitted.push({ status, progress, message });
      },
      { expectedTotalBytes: 0 },
    );

    // Chrome sends loaded and total in raw bytes
    aggregator.onProgressEvent({
      loaded: 250 * 1024 * 1024,
      total: 1000 * 1024 * 1024,
    });

    expect(emitted[emitted.length - 1]).toEqual({
      status: "running",
      progress: 0.25,
      message: "Downloading Prompt API model... (250.0 / 1000.0 MB · 25%)",
    });
  });

  it("handles unknown total byte streams with MB downloaded message", () => {
    const emitted: Array<{
      status: string;
      progress: number | null;
      message: string;
    }> = [];
    const aggregator = new PromptApiProgressAggregator(
      (status, progress, message) => {
        emitted.push({ status, progress, message });
      },
      { expectedTotalBytes: 0 }, // no default metadata size
    );

    aggregator.onProgressEvent({
      loaded: 45 * 1024 * 1024,
      total: 0,
    });

    expect(emitted[emitted.length - 1]).toEqual({
      status: "running",
      progress: null,
      message: "Downloading Prompt API model... (45.0 MB downloaded)",
    });
  });

  it("emits done and error states correctly", () => {
    const emitted: Array<{
      status: string;
      progress: number | null;
      message: string;
    }> = [];
    const aggregator = new PromptApiProgressAggregator(
      (status, progress, message) => {
        emitted.push({ status, progress, message });
      },
    );

    aggregator.onDone();
    expect(emitted[emitted.length - 1]).toEqual({
      status: "done",
      progress: 1,
      message: "Prompt API model ready.",
    });

    aggregator.onError(new Error("Network timeout"));
    expect(emitted[emitted.length - 1]).toEqual({
      status: "error",
      progress: null,
      message: "Network timeout",
    });
  });
});
