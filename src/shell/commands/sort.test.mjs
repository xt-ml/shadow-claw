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

describe("sort", () => {
  it("should sort lines alphabetically", async () => {
    const result = await dispatch(db, "sort", [], ctx, "c\na\nb");

    expect(result.stdout).toBe("a\nb\nc\n");
  });

  it("should sort numerically with -n", async () => {
    const result = await dispatch(db, "sort", ["-n"], ctx, "10\n2\n1");

    expect(result.stdout).toBe("1\n2\n10\n");
  });

  it("should reverse order with -r", async () => {
    const result = await dispatch(db, "sort", ["-r"], ctx, "a\nb\nc");

    expect(result.stdout).toBe("c\nb\na\n");
  });

  it("should unique with -u", async () => {
    const result = await dispatch(db, "sort", ["-u"], ctx, "a\na\nb");

    expect(result.stdout).toBe("a\nb\n");
  });

  // Combined flags: numeric reverse -rn
  it("should sort numerically in reverse with -rn", async () => {
    const result = await dispatch(db, "sort", ["-r", "-n"], ctx, "10\n2\n1");

    expect(result.stdout).toBe("10\n2\n1\n");
  });

  // Combined flags: numeric unique -nu
  it("should sort numerically with unique with -nu", async () => {
    const result = await dispatch(db, "sort", ["-n", "-u"], ctx, "3\n1\n3\n2");

    expect(result.stdout).toBe("1\n2\n3\n");
  });

  // Combined flags: reverse unique -ru
  it("should sort alphabetically reverse with unique -ru", async () => {
    const result = await dispatch(db, "sort", ["-r", "-u"], ctx, "a\na\nb\nc");

    expect(result.stdout).toBe("c\nb\na\n");
  });

  // Combined flags: all three -rnu
  it("should sort numerically reverse with unique -rnu", async () => {
    const result = await dispatch(
      db,
      "sort",
      ["-r", "-n", "-u"],
      ctx,
      "2\n1\n2\n3",
    );

    expect(result.stdout).toBe("3\n2\n1\n");
  });

  // Edge case: empty input
  it("should handle empty input", async () => {
    const result = await dispatch(db, "sort", [], ctx, "");

    expect(result.stdout).toBe("\n");
  });

  // Edge case: single line
  it("should handle single line", async () => {
    const result = await dispatch(db, "sort", [], ctx, "hello");

    expect(result.stdout).toBe("hello\n");
  });

  // Edge case: all identical lines
  it("should handle all identical lines", async () => {
    const result = await dispatch(db, "sort", [], ctx, "a\na\na");

    expect(result.stdout).toBe("a\na\na\n");
  });

  // Edge case: all identical with -u
  it("should reduce identical lines with -u", async () => {
    const result = await dispatch(db, "sort", ["-u"], ctx, "a\na\na");

    expect(result.stdout).toBe("a\n");
  });

  // Testing numeric sort with negative numbers
  it("should sort negative numbers", async () => {
    const result = await dispatch(db, "sort", ["-n"], ctx, "10\n-5\n0\n3");

    expect(result.stdout).toBe("-5\n0\n3\n10\n");
  });

  // Testing numeric reverse with negatives
  it("should reverse sort negative numbers", async () => {
    const result = await dispatch(db, "sort", ["-r", "-n"], ctx, "-5\n10\n0");

    expect(result.stdout).toBe("10\n0\n-5\n");
  });

  it("should sort data loaded from a file operand", async () => {
    safeRead.mockResolvedValueOnce("pear\napple\nbanana");

    const result = await dispatch(db, "sort", ["fruits.txt"], ctx, "ignored");

    expect(safeRead).toHaveBeenCalledWith(db, "test-group", "fruits.txt");

    expect(result.stdout).toBe("apple\nbanana\npear\n");
  });

  it("should treat missing file content as empty input", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "sort", ["missing.txt"], ctx, "ignored");

    expect(result.stdout).toBe("\n");
  });

  it("supports -c check mode for unsorted input", async () => {
    const result = await dispatch(db, "sort", ["-c"], ctx, "a\nb\na\nc");

    expect(result.stdout).toBe("");

    expect(result.exitCode).toBe(1);
  });

  it("supports -c check mode for sorted input", async () => {
    const result = await dispatch(db, "sort", ["-c"], ctx, "a\nb\nc\n");

    expect(result.stdout).toBe("");

    expect(result.exitCode).toBe(0);
  });

  it("supports -uc duplicate check", async () => {
    const result = await dispatch(db, "sort", ["-u", "-c"], ctx, "a\nb\nb\nc");

    expect(result.stdout).toBe("");

    expect(result.exitCode).toBe(1);
  });

  it("sort", async () => {
    safeRead.mockResolvedValueOnce("c\na\nb\n");

    const result = await dispatch(db, "sort", ["input"], ctx, "");

    expect(result.stdout).toBe("a\nb\nc\n");
  });

  it("#2", async () => {
    safeRead.mockResolvedValueOnce("3\n1\n010\n");

    const result = await dispatch(db, "sort", ["input"], ctx, "");

    expect(result.stdout).toBe("010\n1\n3\n");
  });

  it("stdin", async () => {
    const result = await dispatch(db, "sort", [], ctx, "b\na\nc\n");

    expect(result.stdout).toBe("a\nb\nc\n");
  });

  it("numeric", async () => {
    safeRead.mockResolvedValueOnce("3\n1\n010\n");

    const result = await dispatch(db, "sort", ["-n", "input"], ctx, "");

    expect(result.stdout).toBe("1\n3\n010\n");
  });

  it("reverse", async () => {
    safeRead.mockResolvedValueOnce("point\nwook\npabst\naargh\nwalrus\n");

    const result = await dispatch(db, "sort", ["-r", "input"], ctx, "");

    expect(result.stdout).toBe("wook\nwalrus\npoint\npabst\naargh\n");
  });
});
