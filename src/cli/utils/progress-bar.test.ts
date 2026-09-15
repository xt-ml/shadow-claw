import { describe, it, expect } from "@jest/globals";
import { formatBytes, createCliProgressBar } from "./progress-bar.js";

describe("progress-bar", () => {
  describe("formatBytes", () => {
    it("formats 0 bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(-10)).toBe("0 B");
      expect(formatBytes(NaN)).toBe("0 B");
    });

    it("formats bytes, KB, MB, and GB", () => {
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
      expect(formatBytes(1048576)).toBe("1 MB");
      expect(formatBytes(1048576 * 500)).toBe("500 MB");
      expect(formatBytes(1073741824 * 2.5)).toBe("2.5 GB");
    });
  });

  describe("createCliProgressBar (non-TTY)", () => {
    it("logs milestones on non-TTY streams", () => {
      let output = "";
      const mockStream = {
        isTTY: false,
        write: (str: string) => {
          output += str;
        },
      };

      const bar = createCliProgressBar({
        modelId: "test-model",
        stream: mockStream,
        isTTY: false,
      });

      bar.update({ status: "initiate", file: "model.onnx" });
      bar.update({
        status: "progress",
        file: "model.onnx",
        progress: 25,
        loaded: 250000,
        total: 1000000,
      });
      bar.update({
        status: "progress",
        file: "model.onnx",
        progress: 45,
        loaded: 450000,
        total: 1000000,
      });
      bar.update({ status: "done", file: "model.onnx" });
      bar.finish("All done!");

      expect(output).toContain(
        "[Download] Starting test-model (model.onnx)...",
      );
      expect(output).toContain("[Download] test-model [model.onnx]: 20%");
      expect(output).toContain("[Download] test-model [model.onnx]: 40%");
      expect(output).toContain("[Download] Finished file: model.onnx");
      expect(output).toContain("All done!");
    });
  });

  describe("createCliProgressBar (TTY)", () => {
    it("writes dynamic carriage returns in TTY mode", () => {
      let output = "";
      const mockStream = {
        isTTY: true,
        write: (str: string) => {
          output += str;
        },
      };

      const bar = createCliProgressBar({
        modelId: "onnx-community/Qwen3-0.6B-ONNX",
        stream: mockStream,
        barWidth: 20,
        isTTY: true,
      });

      bar.update({
        status: "progress",
        file: "model.onnx",
        progress: 50,
        loaded: 50000000,
        total: 100000000,
      });

      expect(output).toContain(
        "\r\x1b[2KDownloading onnx-community/Qwen3-0.6B-ONNX [model.onnx]",
      );
      expect(output).toContain("50.0%");
      expect(output).toContain("47.7 MB / 95.4 MB");

      bar.finish();
      expect(output).toContain(
        "✔ Model onnx-community/Qwen3-0.6B-ONNX downloaded successfully.\n",
      );
    });

    it("handles failure message", () => {
      let output = "";
      const mockStream = {
        isTTY: true,
        write: (str: string) => {
          output += str;
        },
      };

      const bar = createCliProgressBar({
        modelId: "bad-model",
        stream: mockStream,
        isTTY: true,
      });

      bar.fail();
      expect(output).toContain("✖ Failed to download bad-model.\n");
    });

    it("renders multiple downloading files on separate lines in TTY mode", () => {
      const writes: string[] = [];
      const mockStream = {
        isTTY: true,
        write: (str: string) => {
          writes.push(str);
        },
      };

      const bar = createCliProgressBar({
        modelId: "test-model",
        stream: mockStream,
        barWidth: 20,
        isTTY: true,
      });

      // File 1 starts
      bar.update({
        status: "progress",
        file: "embed_tokens.onnx",
        progress: 30,
        loaded: 300,
        total: 1000,
      });

      // File 2 starts concurrently
      bar.update({
        status: "progress",
        file: "decoder_model.onnx",
        progress: 10,
        loaded: 100,
        total: 1000,
      });

      const fullOutput = writes.join("");

      // File 1 was rendered on first line
      expect(fullOutput).toContain("embed_tokens.onnx");
      // Advance to separate line for File 2
      expect(fullOutput).toContain("\n");
      // File 2 rendered on its own line
      expect(fullOutput).toContain("decoder_model.onnx");

      // Now File 1 updates again while File 2 is below it
      bar.update({
        status: "progress",
        file: "embed_tokens.onnx",
        progress: 60,
        loaded: 600,
        total: 1000,
      });

      const latestWrites = writes.slice(-1)[0];
      // File 1 update should use cursor-up ANSI sequence to target its line
      expect(latestWrites).toContain("\x1b[1A");
      expect(latestWrites).toContain("embed_tokens.onnx");
      expect(latestWrites).toContain("\x1b[1B");

      bar.finish();
    });

    it("suppresses all output when enabled is false (e.g. --no-progress)", () => {
      let output = "";
      const mockStream = {
        isTTY: true,
        write: (str: string) => {
          output += str;
        },
      };

      const bar = createCliProgressBar({
        modelId: "quiet-model",
        stream: mockStream,
        isTTY: true,
        enabled: false,
      });

      bar.update({ status: "initiate", file: "model.onnx" });
      bar.update({
        status: "progress",
        file: "model.onnx",
        progress: 50,
        loaded: 500,
        total: 1000,
      });
      bar.update({ status: "done", file: "model.onnx" });
      bar.finish();

      expect(output).toBe("");
    });
  });
});
