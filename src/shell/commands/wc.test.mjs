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

describe("wc", () => {
  it("should count lines, words, chars", async () => {
    const result = await dispatch(db, "wc", [], ctx, "hello world\nnext line");

    expect(result.stdout).toBe("1 4 21\n");
  });

  it("should handle trailing newline in wc", async () => {
    const result = await dispatch(db, "wc", [], ctx, "hello world\n");

    expect(result.stdout).toBe("1 2 12\n");
  });

  it("supports -c for stdin", async () => {
    const result = await dispatch(db, "wc", ["-c"], ctx, "a b\nc");

    expect(result.stdout).toBe("5\n");
  });

  it("supports -cl combined flags", async () => {
    const result = await dispatch(db, "wc", ["-c", "-l"], ctx, "a b\nc");

    expect(result.stdout).toBe("1 5\n");
  });

  it("supports file operand output with name", async () => {
    safeRead.mockResolvedValueOnce("some words\nnext line\n");

    const result = await dispatch(db, "wc", ["file1"], ctx, "");

    expect(result.stdout).toBe("2 4 21 file1\n");
  });

  it("supports multiple operands and total", async () => {
    safeRead.mockResolvedValueOnce("a\nb").mockResolvedValueOnce("x y\nz\n");

    const result = await dispatch(
      db,
      "wc",
      ["input", "-", "file1"],
      ctx,
      "a b",
    );

    expect(result.stdout).toBe(
      "1 2 3 input\n0 2 3 -\n2 3 6 file1\n3 7 12 total\n",
    );
  });

  it("supports -L max line length", async () => {
    const result = await dispatch(db, "wc", ["-L"], ctx, "first\nsecond\n");

    expect(result.stdout).toBe("6\n");
  });

  it("wc :: >/dev/null && echo yes", async () => {
    const result = await dispatch(db, "wc", [], ctx, "");

    expect(result.stdout).toBe("0 0 0\n");

    expect(result.exitCode).toBe(0);
  });

  it("empty file :: ", async () => {
    const result = await dispatch(db, "wc", [], ctx, "");

    expect(result.stdout).toBe("0 0 0\n");
  });

  it("standard input :: ", async () => {
    const result = await dispatch(db, "wc", [], ctx, "a b\nc");

    expect(result.stdout).toBe("1 3 5\n");
  });

  it("standard input -c :: -c", async () => {
    const result = await dispatch(db, "wc", ["-c"], ctx, "a b\nc");

    expect(result.stdout).toBe("5\n");
  });

  it("standard input -cl :: -cl", async () => {
    const result = await dispatch(db, "wc", ["-cl"], ctx, "a b\nc");

    expect(result.stdout).toBe("1 5\n");
  });
});
