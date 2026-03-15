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

describe("find", () => {
  it("lists current tree recursively", async () => {
    listGroupFiles
      .mockResolvedValueOnce(["alpha.txt", "dir/"])
      .mockResolvedValueOnce(["nested.md"]);

    const result = await dispatch(db, "find", [], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe(".\n./alpha.txt\n./dir\n./dir/nested.md\n");
  });

  it("filters by -name", async () => {
    listGroupFiles.mockResolvedValueOnce(["file"]);

    const result = await dispatch(
      db,
      "find",
      ["dir", "-name", "file"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("dir/file\n");
  });

  it("filters by -iname case-insensitively", async () => {
    listGroupFiles.mockResolvedValueOnce(["Alpha.txt", "beta.txt"]);

    const result = await dispatch(
      db,
      "find",
      [".", "-iname", "alpha.txt"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("./Alpha.txt\n");
  });

  it("supports -type f", async () => {
    listGroupFiles
      .mockResolvedValueOnce(["alpha.txt", "dir/"])
      .mockResolvedValueOnce(["nested.md"]);

    const result = await dispatch(db, "find", [".", "-type", "f"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("./alpha.txt\n./dir/nested.md\n");
  });

  it("supports -maxdepth", async () => {
    listGroupFiles
      .mockResolvedValueOnce(["alpha.txt", "dir/"])
      .mockResolvedValueOnce(["nested.md"]);

    const result = await dispatch(db, "find", [".", "-maxdepth", "1"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe(".\n./alpha.txt\n./dir\n");
  });

  it("returns a clear error for a missing root", async () => {
    listGroupFiles.mockRejectedValueOnce(new Error("missing"));
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "find", ["missing-root"], ctx, "");

    expect(result.exitCode).toBe(1);

    expect(result.stderr).toBe("find: missing-root: No such file or directory");
  });
});
