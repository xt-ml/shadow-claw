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

describe("cat", () => {
  it("cat", async () => {
    const result = await dispatch(db, "cat", [], ctx, "one");

    expect(result.stdout).toBe("one");
  });

  it("should read files", async () => {
    safeRead.mockResolvedValueOnce("file content");

    const result = await dispatch(db, "cat", ["file.txt"], ctx, "");

    expect(result.stdout).toBe("file content");

    expect(safeRead).toHaveBeenCalled();
  });

  it("should return error if file not found", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "cat", ["missing.txt"], ctx, "");

    expect(result.stderr).toContain("No such file");

    expect(result.exitCode).toBe(1);
  });

  it("-", async () => {
    const result = await dispatch(db, "cat", ["-"], ctx, "one");

    expect(result.stdout).toBe("one");
  });

  it("should combine stdin and file arguments", async () => {
    safeRead.mockResolvedValueOnce(" from file");

    const result = await dispatch(
      db,
      "cat",
      ["-", "file.txt"],
      ctx,
      "from stdin",
    );

    expect(result.stdout).toBe("from stdin from file");
  });

  it("file1 file2", async () => {
    safeRead.mockResolvedValueOnce("one\n").mockResolvedValueOnce("two\n");

    const result = await dispatch(db, "cat", ["file1", "file2"], ctx, "");

    expect(result.stdout).toBe("one\ntwo\n");
  });

  it("- file", async () => {
    safeRead.mockResolvedValueOnce("one\n");

    const result = await dispatch(db, "cat", ["-", "file1"], ctx, "zero\n");

    expect(result.stdout).toBe("zero\none\n");
  });

  it("file -", async () => {
    safeRead.mockResolvedValueOnce("one\n");

    const result = await dispatch(db, "cat", ["file1", "-"], ctx, "zero\n");

    expect(result.stdout).toBe("one\nzero\n");
  });
});
