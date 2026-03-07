import { createTokenUsageMessage } from "./createTokenUsageMessage.mjs";
import { createToolActivityMessage } from "./createToolActivityMessage.mjs";
import { formatShellOutput } from "./formatShellOutput.mjs";

describe("worker utilities", () => {
  describe("createTokenUsageMessage", () => {
    it("should format token usage message correctly", () => {
      const usage = { input_tokens: 100, output_tokens: 50 };
      const result = createTokenUsageMessage("g1", usage, 1000);
      expect(result).toEqual({
        type: "token-usage",
        payload: {
          groupId: "g1",
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          contextLimit: 1000,
        },
      });
    });
  });

  describe("createToolActivityMessage", () => {
    it("should format tool activity message correctly", () => {
      const result = createToolActivityMessage("g1", "bash", "running");
      expect(result).toEqual({
        type: "tool-activity",
        payload: {
          groupId: "g1",
          tool: "bash",
          status: "running",
        },
      });
    });
  });

  describe("formatShellOutput", () => {
    it("should format successful shell output", () => {
      const result = formatShellOutput({
        stdout: "hello",
        stderr: "",
        exitCode: 0,
      });

      expect(result).toBe("hello");
    });

    it("should format shell output with stderr", () => {
      const result = formatShellOutput({
        stdout: "some",
        stderr: "fail",
        exitCode: 1,
      });

      expect(result).toBe("some\nfail");
    });

    it("should handle empty output with exit code", () => {
      const result = formatShellOutput({
        stdout: "",
        stderr: "",
        exitCode: 1,
      });

      expect(result).toBe("[exit code: 1]");
    });

    it("should handle completely empty output", () => {
      const result = formatShellOutput({
        stdout: "",
        stderr: "",
        exitCode: 0,
      });

      expect(result).toBe("(no output)");
    });
  });
});
