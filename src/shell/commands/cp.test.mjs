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

describe("cp", () => {
  it("should copy file content", async () => {
    safeRead.mockResolvedValueOnce("content");

    await dispatch(db, "cp", ["src.txt", "dst.txt"], ctx, "");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "dst.txt",
      "content",
    );
  });

  it("should fail if source does not exist", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "cp", ["src.txt", "dst.txt"], ctx, "");

    expect(result.stderr).toContain("No such file");

    expect(result.exitCode).toBe(1);
  });

  it("should fail when operands are missing", async () => {
    const result = await dispatch(db, "cp", ["src.txt"], ctx, "");

    expect(result.stderr).toBe("cp: missing operands");

    expect(result.exitCode).toBe(1);
  });

  it("not enough arguments [fail] :: one 2>/dev/null || echo yes", async () => {
    const result = await dispatch(db, "cp", ["one"], ctx, "");

    expect(result.exitCode).toBe(1);
  });

  it("-missing source [fail] :: missing two 2>/dev/null || echo yes", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "cp", ["missing", "two"], ctx, "");

    expect(result.exitCode).toBe(1);

    expect(result.stderr).toContain("No such file");
  });

  it("file->file :: random two && cmp random two && echo yes", async () => {
    safeRead.mockResolvedValueOnce("random-bytes");

    const result = await dispatch(db, "cp", ["random", "two"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "two",
      "random-bytes",
    );
  });

  it("file->dir :: random two && cmp random two/random && echo yes", async () => {
    safeRead.mockResolvedValueOnce("random-bytes");

    const result = await dispatch(db, "cp", ["random", "two/random"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "two/random",
      "random-bytes",
    );
  });

  it("-r dir again :: -r one/. dir && diff -r one dir && echo yes", async () => {
    safeRead.mockResolvedValueOnce("dir-content");

    const result = await dispatch(db, "cp", ["one/.", "dir"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "dir",
      "dir-content",
    );
  });
});
