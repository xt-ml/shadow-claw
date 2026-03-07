import { jest } from "@jest/globals";

// Mock dispatch to avoid hitting all commands and storage
jest.unstable_mockModule("./dispatch.mjs", () => ({
  dispatch: jest.fn(),
  SUPPORTED_COMMANDS: new Set(["echo", "true", "false"]),
}));

const { executeShell } = await import("./shell.mjs");
const { dispatch } = await import("./dispatch.mjs");

describe("shell.mjs integration", () => {
  const db = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should execute a simple command", async () => {
    dispatch.mockResolvedValue({
      stdout: "hello\n",
      stderr: "",
      exitCode: 0,
    });

    const result = await executeShell(db, "echo hello", groupId);

    expect(result.stdout).toBe("hello\n");
    expect(result.exitCode).toBe(0);
    expect(dispatch).toHaveBeenCalledWith(
      db,
      "echo",
      ["hello"],
      expect.objectContaining({
        groupId,
        cwd: ".",
      }),
      "",
    );
  });

  it("should handle command failure", async () => {
    dispatch.mockResolvedValue({
      stdout: "",
      stderr: "error",
      exitCode: 1,
    });

    const result = await executeShell(db, "false", groupId);

    expect(result.stderr).toBe("error");
    expect(result.exitCode).toBe(1);
  });

  it("should handle logical AND (&&)", async () => {
    dispatch
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // true
      .mockResolvedValueOnce({ stdout: "success\n", stderr: "", exitCode: 0 }); // echo

    const result = await executeShell(db, "true && echo success", groupId);

    expect(result.stdout).toBe("success\n");
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("should skip second command in && if first fails", async () => {
    dispatch.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 1 }); // false

    const result = await executeShell(db, "false && echo success", groupId);

    expect(result.exitCode).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("should handle logical OR (||)", async () => {
    dispatch
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 1 }) // false
      .mockResolvedValueOnce({ stdout: "fallback\n", stderr: "", exitCode: 0 }); // echo

    const result = await executeShell(db, "false || echo fallback", groupId);

    expect(result.stdout).toBe("fallback\n");
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("should skip second command in || if first succeeds", async () => {
    dispatch.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // true

    const result = await executeShell(db, "true || echo never", groupId);

    expect(result.exitCode).toBe(0);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("should handle errors in runPipeline", async () => {
    dispatch.mockRejectedValue(new Error("Unexpected crash"));

    const result = await executeShell(db, "echo crash", groupId);

    expect(result.stderr).toBe("Unexpected crash");
    expect(result.exitCode).toBe(1);
  });

  it("should trim command input", async () => {
    dispatch.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await executeShell(db, "  true  ", groupId);

    expect(dispatch).toHaveBeenCalledWith(
      db,
      "true",
      [],
      expect.anything(),
      "",
    );
  });
});
