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

describe("basename", () => {
  it("should return basename", async () => {
    const result = await dispatch(
      db,
      "basename",
      ["/foo/bar/baz.txt"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("baz.txt\n");
  });

  it("should remove suffix", async () => {
    const result = await dispatch(
      db,
      "basename",
      ["/foo/bar/baz.txt", ".txt"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("baz\n");
  });

  it("handles slash-only path", async () => {
    const result = await dispatch(db, "basename", ["///////"], ctx, "");

    expect(result.stdout).toBe("/\n");
  });

  it("strips trailing slashes", async () => {
    const result = await dispatch(db, "basename", ["a//////"], ctx, "");

    expect(result.stdout).toBe("a\n");
  });

  it("suffix cannot remove whole basename", async () => {
    const result = await dispatch(db, "basename", [".txt", ".txt"], ctx, "");

    expect(result.stdout).toBe(".txt\n");
  });

  it("supports -a with multiple paths", async () => {
    const result = await dispatch(
      db,
      "basename",
      ["-a", "/a/b/f1", "/c/d/f2"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("f1\nf2\n");
  });

  it("supports -s and implies -a", async () => {
    const result = await dispatch(
      db,
      "basename",
      ["-s", ".txt", "/a/b/c.txt", "/a/b/d.txt"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("c\nd\n");
  });

  it("/-only :: ///////", async () => {
    const result = await dispatch(db, "basename", ["///////"], ctx, "");

    expect(result.stdout).toBe("/\n");
  });

  it("trailing / :: a//////", async () => {
    const result = await dispatch(db, "basename", ["a//////"], ctx, "");

    expect(result.stdout).toBe("a\n");
  });

  it("combined :: /////a///b///c///d/////", async () => {
    const result = await dispatch(
      db,
      "basename",
      ["/////a///b///c///d/////"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("d\n");
  });

  it("suffix :: a/b/c/d.suffix .suffix", async () => {
    const result = await dispatch(
      db,
      "basename",
      ["a/b/c/d.suffix", ".suffix"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("d\n");
  });

  it("suffix=result :: .txt .txt", async () => {
    const result = await dispatch(db, "basename", [".txt", ".txt"], ctx, "");

    expect(result.stdout).toBe(".txt\n");
  });
});
