import { jest } from "@jest/globals";
import { createCtx, createDb, loadDispatchHarness } from "./testHarness.mjs";

let dispatch;
let safeRead;
let listGroupFiles;
let writeGroupFile;
let deleteGroupFile;
let deleteGroupDirectory;
let db;
let ctx;

beforeEach(async () => {
  ({
    dispatch,
    safeRead,
    listGroupFiles,
    writeGroupFile,
    deleteGroupFile,
    deleteGroupDirectory,
  } = await loadDispatchHarness());
  db = createDb();
  ctx = createCtx();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("rm", () => {
  it("should delete a file", async () => {
    await dispatch(db, "rm", ["file.txt"], ctx, "");

    expect(deleteGroupFile).toHaveBeenCalledWith(db, "test-group", "file.txt");
  });

  it("should delete a directory with -r", async () => {
    await dispatch(db, "rm", ["-r", "subdir"], ctx, "");

    expect(deleteGroupDirectory).toHaveBeenCalledWith(
      db,
      "test-group",
      "subdir",
    );
  });

  it("should not fail with -f if file missing", async () => {
    deleteGroupFile.mockRejectedValueOnce(new Error("missing"));

    const result = await dispatch(db, "rm", ["-f", "missing.txt"], ctx, "");

    expect(result.exitCode).toBe(0);
  });

  it("should call deleteGroupFile for simple rm", async () => {
    const ctx = { env: {}, groupId: "test-group", cwd: "." };
    const db = {};

    await dispatch(db, "rm", ["file.txt"], ctx, "");

    expect(deleteGroupFile).toHaveBeenCalledWith(db, "test-group", "file.txt");

    expect(deleteGroupDirectory).not.toHaveBeenCalled();
  });

  it("should call deleteGroupDirectory for rm -r", async () => {
    const ctx = { env: {}, groupId: "test-group", cwd: "." };
    const db = {};

    await dispatch(db, "rm", ["-r", "my_dir"], ctx, "");

    expect(deleteGroupDirectory).toHaveBeenCalledWith(
      db,
      "test-group",
      "my_dir",
    );

    expect(deleteGroupFile).not.toHaveBeenCalled();
  });

  it("should call deleteGroupDirectory for rm -rf", async () => {
    const ctx = { env: {}, groupId: "test-group", cwd: "." };
    const db = {};

    await dispatch(db, "rm", ["-rf", "my_dir"], ctx, "");

    expect(deleteGroupDirectory).toHaveBeenCalledWith(
      db,
      "test-group",
      "my_dir",
    );
  });

  it("should not fail if -f is provided and deletion throws", async () => {
    const ctx = { env: {}, groupId: "test-group", cwd: "." };
    const db = {};

    deleteGroupFile.mockRejectedValue(new Error("File not found"));

    const result = await dispatch(db, "rm", ["-f", "missing.txt"], ctx, "");

    expect(result.exitCode).toBe(0);
  });

  it("should fail if deletion throws without -f", async () => {
    deleteGroupFile.mockRejectedValueOnce(new Error("missing"));

    const result = await dispatch(db, "rm", ["missing.txt"], ctx, "");

    expect(result.stderr).toBe("rm: missing.txt: No such file or directory");

    expect(result.exitCode).toBe(1);
  });

  it("text-file", async () => {
    const result = await dispatch(db, "rm", ["file.txt"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(deleteGroupFile).toHaveBeenCalledWith(db, "test-group", "file.txt");
  });

  it("-i nonexistent", async () => {
    deleteGroupFile.mockRejectedValueOnce(new Error("missing"));

    const result = await dispatch(db, "rm", ["-i", "file.txt"], ctx, "");

    expect(result.exitCode).toBe(1);

    expect(result.stderr).toBe("rm: file.txt: No such file or directory");
  });

  it("empty directory", async () => {
    const result = await dispatch(db, "rm", ["-r", "dir"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(deleteGroupDirectory).toHaveBeenCalledWith(db, "test-group", "dir");
  });

  it("text file(mode 000)", async () => {
    const result = await dispatch(db, "rm", ["-f", "file.txt"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(deleteGroupFile).toHaveBeenCalledWith(db, "test-group", "file.txt");
  });

  it("-rv dir", async () => {
    const result = await dispatch(db, "rm", ["-rv", "d1"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("removed directory 'd1'\n");

    expect(deleteGroupDirectory).toHaveBeenCalledWith(db, "test-group", "d1");
  });
});
