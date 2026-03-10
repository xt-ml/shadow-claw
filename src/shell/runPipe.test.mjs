import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("./checkTimeout.mjs", () => ({
  checkTimeout: jest.fn(),
}));

jest.unstable_mockModule("./runSingle.mjs", () => ({
  runSingle: jest.fn(),
}));

jest.unstable_mockModule("./splitOnOperators.mjs", () => ({
  splitOnOperators: jest.fn(),
}));

const { runPipe } = await import("./runPipe.mjs");
const { runPipeline } = await import("./runPipeline.mjs");
const { runSingle } = await import("./runSingle.mjs");
const { splitOnOperators } = await import("./splitOnOperators.mjs");

describe("Shell Pipelines", () => {
  const db = {};
  const ctx = { groupId: "test-group" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("runPipe", () => {
    it("should split and run piped commands", async () => {
      runSingle
        .mockResolvedValueOnce({ stdout: "out1", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "out2", stderr: "", exitCode: 0 });

      const result = await runPipe(db, "cmd1 | cmd2", ctx);

      expect(runSingle).toHaveBeenCalledTimes(2);
      expect(runSingle).toHaveBeenNthCalledWith(1, db, "cmd1", ctx, "");
      expect(runSingle).toHaveBeenNthCalledWith(2, db, "cmd2", ctx, "out1");
      expect(result.stdout).toBe("out2");
    });

    it("should handle quoted pipes", async () => {
      runSingle.mockResolvedValueOnce({
        stdout: "out",
        stderr: "",
        exitCode: 0,
      });

      await runPipe(db, "echo 'a | b'", ctx);

      expect(runSingle).toHaveBeenCalledTimes(1);
      expect(runSingle).toHaveBeenCalledWith(db, "echo 'a | b'", ctx, "");
    });

    it("should handle double-quoted pipes", async () => {
      runSingle
        .mockResolvedValueOnce({ stdout: "a | b", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "done", stderr: "", exitCode: 0 });

      const result = await runPipe(db, 'echo "a | b" | cat', ctx);

      expect(runSingle).toHaveBeenNthCalledWith(1, db, 'echo "a | b"', ctx, "");
      expect(runSingle).toHaveBeenNthCalledWith(2, db, "cat", ctx, "a | b");
      expect(result.stdout).toBe("done");
    });

    it("should ignore pipes inside subshell syntax", async () => {
      runSingle
        .mockResolvedValueOnce({ stdout: "sub", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "ok", stderr: "", exitCode: 0 });

      await runPipe(db, "echo $(a | b) | wc", ctx);

      expect(runSingle).toHaveBeenCalledTimes(2);
      expect(runSingle).toHaveBeenNthCalledWith(
        1,
        db,
        "echo $(a | b)",
        ctx,
        "",
      );
      expect(runSingle).toHaveBeenNthCalledWith(2, db, "wc", ctx, "sub");
    });

    it("should ignore empty pipeline segments", async () => {
      runSingle
        .mockResolvedValueOnce({ stdout: "x", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "y", stderr: "", exitCode: 0 });

      await runPipe(db, " | cmd1 |   | cmd2 | ", ctx);

      expect(runSingle).toHaveBeenCalledTimes(2);
      expect(runSingle).toHaveBeenNthCalledWith(1, db, "cmd1", ctx, "");
      expect(runSingle).toHaveBeenNthCalledWith(2, db, "cmd2", ctx, "x");
    });
  });

  describe("runPipeline", () => {
    it("should handle && operator", async () => {
      splitOnOperators.mockReturnValue([
        { cmd: "cmd1", op: "&&" },
        { cmd: "cmd2", op: "" },
      ]);

      runSingle
        .mockResolvedValueOnce({ stdout: "o1", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "o2", stderr: "", exitCode: 0 });

      const result = await runPipeline(db, "cmd1 && cmd2", ctx);

      expect(runSingle).toHaveBeenCalledTimes(2);
      expect(result.stdout).toBe("o2");
    });

    it("should stop on && failure", async () => {
      splitOnOperators.mockReturnValue([
        { cmd: "cmd1", op: "&&" },
        { cmd: "cmd2", op: "" },
      ]);

      runSingle.mockResolvedValueOnce({
        stdout: "o1",
        stderr: "err",
        exitCode: 1,
      });

      const result = await runPipeline(db, "cmd1 && cmd2", ctx);

      expect(runSingle).toHaveBeenCalledTimes(1);
      expect(result.exitCode).toBe(1);
    });

    it("should handle || operator", async () => {
      splitOnOperators.mockReturnValue([
        { cmd: "cmd1", op: "||" },
        { cmd: "cmd2", op: "" },
      ]);

      runSingle
        .mockResolvedValueOnce({ stdout: "o1", stderr: "err", exitCode: 1 })
        .mockResolvedValueOnce({ stdout: "o2", stderr: "", exitCode: 0 });

      const result = await runPipeline(db, "cmd1 || cmd2", ctx);

      expect(runSingle).toHaveBeenCalledTimes(2);
      expect(result.exitCode).toBe(0);
    });
  });
});
