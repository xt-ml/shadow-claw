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

describe("realpath", () => {
  it("resolves current directory to absolute path", async () => {
    const result = await dispatch(db, "realpath", ["."], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace\n");
  });

  it("resolves a relative path to absolute", async () => {
    const result = await dispatch(db, "realpath", ["sub/dir"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace/sub/dir\n");
  });

  it("resolves a missing path by default (no error)", async () => {
    const result = await dispatch(db, "realpath", ["missing"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace/missing\n");
  });

  it("normalises .. in path", async () => {
    const result = await dispatch(db, "realpath", ["sub/../other"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace/other\n");
  });

  it("accepts multiple arguments and outputs one per line", async () => {
    const result = await dispatch(db, "realpath", ["a", "b/c"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace/a\n/workspace/b/c\n");
  });

  it("returns exit 1 with -e for a missing path", async () => {
    listGroupFiles.mockRejectedValueOnce(new Error("no dir"));
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "realpath", ["-e", "missing"], ctx, "");

    expect(result.exitCode).toBe(1);

    expect(result.stderr).toContain("missing");
  });

  it("succeeds with -e when path exists as a file", async () => {
    listGroupFiles.mockRejectedValueOnce(new Error("not a dir"));
    safeRead.mockResolvedValueOnce("content");

    const result = await dispatch(db, "realpath", ["-e", "file.txt"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace/file.txt\n");
  });

  it("succeeds with -e when path exists as a directory", async () => {
    listGroupFiles.mockResolvedValueOnce([]);

    const result = await dispatch(db, "realpath", ["-e", "subdir"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace/subdir\n");
  });
});
