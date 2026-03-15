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

describe("readlink", () => {
  it("exits non-zero for a regular file (not a symlink)", async () => {
    // safeRead succeeds → it's a regular file, not a symlink
    safeRead.mockResolvedValueOnce("content");

    const result = await dispatch(db, "readlink", ["file.txt"], ctx, "");

    expect(result.exitCode).toBe(1);
  });

  it("exits non-zero for a missing path", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "readlink", ["notfound"], ctx, "");

    expect(result.exitCode).toBe(1);
  });

  it("resolves current directory to absolute path with -f", async () => {
    const result = await dispatch(db, "readlink", ["-f", "."], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace\n");
  });

  it("resolves a subpath to absolute path with -f", async () => {
    const result = await dispatch(
      db,
      "readlink",
      ["-f", "sub/file.txt"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace/sub/file.txt\n");
  });

  it("resolves a non-existent path with -f (no existence check)", async () => {
    const result = await dispatch(db, "readlink", ["-f", "notfound"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace/notfound\n");
  });

  it("resolves to absolute path with -m (no existence check)", async () => {
    const result = await dispatch(
      db,
      "readlink",
      ["-m", "sub/two/three"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("/workspace/sub/two/three\n");
  });
});
