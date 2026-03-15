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

/** Serialize what our tar implementation writes. */
function makeArchive(entries) {
  return JSON.stringify({ shadowclawTar: true, entries });
}

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

describe("tar", () => {
  it("creates an archive with combined cf flag", async () => {
    safeRead.mockResolvedValueOnce("file content");

    const result = await dispatch(
      db,
      "tar",
      ["cf", "out.tar", "file.txt"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(0);

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "out.tar",
      expect.stringContaining('"shadowclawTar":true'),
    );
  });

  it("creates an archive with separated -c -f flags", async () => {
    safeRead.mockResolvedValueOnce("hello");

    const result = await dispatch(
      db,
      "tar",
      ["-c", "-f", "archive.tar", "file.txt"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(0);

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "archive.tar",
      expect.stringContaining("file.txt"),
    );
  });

  it("lists archive contents with combined tf flag", async () => {
    safeRead.mockResolvedValueOnce(
      makeArchive([
        { name: "a.txt", content: "aaa" },
        { name: "b.txt", content: "bbb" },
      ]),
    );

    const result = await dispatch(db, "tar", ["tf", "out.tar"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("a.txt\nb.txt\n");
  });

  it("extracts archive with combined xf flag", async () => {
    safeRead.mockResolvedValueOnce(
      makeArchive([
        { name: "a.txt", content: "aaa" },
        { name: "b.txt", content: "bbb" },
      ]),
    );

    const result = await dispatch(db, "tar", ["xf", "out.tar"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "a.txt",
      "aaa",
    );

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "b.txt",
      "bbb",
    );
  });

  it("round-trips create → list via archive data", async () => {
    // Create
    safeRead.mockResolvedValueOnce("hello world");
    await dispatch(db, "tar", ["cf", "a.tar", "greet.txt"], ctx, "");

    // Capture what was written
    const writtenContent = writeGroupFile.mock.calls[0][3];

    // List
    safeRead.mockResolvedValueOnce(writtenContent);
    const listResult = await dispatch(db, "tar", ["tf", "a.tar"], ctx, "");

    expect(listResult.stdout).toBe("greet.txt\n");
  });

  it("returns exit 2 for unknown mode", async () => {
    const result = await dispatch(db, "tar", ["--oops"], ctx, "");

    expect(result.exitCode).toBe(2);
  });

  it("returns exit 2 when archive file is missing for extract", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "tar", ["xf", "missing.tar"], ctx, "");

    expect(result.exitCode).toBe(2);

    expect(result.stderr).toContain("missing.tar");
  });
});
