import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("../storage/writeGroupFile.mjs", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("./checkTimeout.mjs", () => ({
  checkTimeout: jest.fn(),
}));

jest.unstable_mockModule("./dispatch.mjs", () => ({ dispatch: jest.fn() }));
jest.unstable_mockModule("./expandVarsAndSub.mjs", () => ({
  expandVarsAndSub: jest.fn((db, cmd) => Promise.resolve(cmd)),
}));

jest.unstable_mockModule("./resolvePath.mjs", () => ({
  resolvePath: jest.fn((p) => p),
}));

jest.unstable_mockModule("./safeRead.mjs", () => ({ safeRead: jest.fn() }));

describe("runSingle.mjs", () => {
  let runSingle;
  let writeGroupFile;
  let dispatch;

  beforeEach(async () => {
    jest.resetModules();

    const writeGroupFileModule = await import("../storage/writeGroupFile.mjs");
    writeGroupFile = writeGroupFileModule.writeGroupFile;

    const dispatchModule = await import("./dispatch.mjs");
    dispatch = dispatchModule.dispatch;

    // Default dispatch mock
    dispatch.mockResolvedValue({
      stdout: "mock output",
      stderr: "mock err",
      exitCode: 0,
    });

    const runSingleModule = await import("./runSingle.mjs");
    runSingle = runSingleModule.runSingle;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should parse and ignore /dev/null redirection", async () => {
    const ctx = { env: {}, groupId: "test-group" };
    const db = {};

    await runSingle(db, "echo hello > /dev/null", ctx, "");

    // Dispatch should be called with "echo" and ["hello"]
    expect(dispatch).toHaveBeenCalledWith(db, "echo", ["hello"], ctx, "");

    // writeGroupFile should NOT be called since redirect is to /dev/null
    expect(writeGroupFile).not.toHaveBeenCalled();
  });

  it("should handle 2>&1 and redirect stdout accordingly", async () => {
    const ctx = { env: {}, groupId: "test-group" };
    const db = {};

    // In our simplified shell, 2>&1 with > /dev/null means we ignore output
    await runSingle(db, "echo hello > /dev/null 2>&1", ctx, "");

    expect(dispatch).toHaveBeenCalledWith(db, "echo", ["hello"], ctx, "");

    expect(writeGroupFile).not.toHaveBeenCalled();
  });

  it("should handle variable assignment", async () => {
    const ctx = { env: {}, groupId: "test-group" };
    const db = {};

    const result = await runSingle(db, "FOO=bar", ctx, "");

    expect(ctx.env.FOO).toBe("bar");

    expect(result.exitCode).toBe(0);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("should handle output redirection to a file", async () => {
    const ctx = { env: {}, groupId: "test-group" };
    const db = {};
    dispatch.mockResolvedValue({ stdout: "hello", stderr: "", exitCode: 0 });

    await runSingle(db, "echo hello > out.txt", ctx, "");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "out.txt",
      "hello",
    );
  });

  it("should handle append redirection to a file", async () => {
    const ctx = { env: {}, groupId: "test-group" };
    const db = {};
    dispatch.mockResolvedValue({ stdout: " world", stderr: "", exitCode: 0 });

    // safeRead is used for append
    const safeReadModule = await import("./safeRead.mjs");
    safeReadModule.safeRead.mockResolvedValue("hello");

    await runSingle(db, "echo world >> out.txt", ctx, "");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "out.txt",
      "hello world",
    );
  });

  it("should return early if tokenization results in no tokens", async () => {
    const ctx = { env: {}, groupId: "test-group" };
    const db = {};

    const result = await runSingle(db, "   ", ctx, "");

    expect(result).toEqual({ stdout: "", stderr: "", exitCode: 0 });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("should handle multiple redirects", async () => {
    const ctx = { env: {}, groupId: "test-group" };
    const db = {};
    dispatch.mockResolvedValue({ stdout: "out", stderr: "err", exitCode: 1 });

    // echo hello > out.txt 2>&1
    // The order in the regex loop is right-to-left
    await runSingle(db, "echo hello > out.txt 2>&1", ctx, "");

    expect(dispatch).toHaveBeenCalledWith(db, "echo", ["hello"], ctx, "");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "out.txt",
      "out",
    );
  });

  it("should handle nested subdirectories in redirects via resolvePath", async () => {
    const ctx = { env: {}, groupId: "test-group", cwd: "/home" };
    const db = {};
    dispatch.mockResolvedValue({ stdout: "data", stderr: "", exitCode: 0 });

    const resolvePathModule = await import("./resolvePath.mjs");
    resolvePathModule.resolvePath.mockReturnValue("/home/subdir/file.txt");

    await runSingle(db, "echo data > subdir/file.txt", ctx, "");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "/home/subdir/file.txt",
      "data",
    );
  });
});
