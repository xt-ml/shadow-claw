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

describe("head", () => {
  it("should return first 10 lines by default", async () => {
    const input = Array(15)
      .fill(0)
      .map((_, i) => `line ${i + 1}`)
      .join("\n");

    const result = await dispatch(db, "head", [], ctx, input);
    const lines = result.stdout.trim().split("\n");

    expect(lines.length).toBe(10);

    expect(lines[0]).toBe("line 1");

    expect(lines[9]).toBe("line 10");
  });

  it("stdin", async () => {
    const result = await dispatch(db, "head", ["-n", "1"], ctx, "one\ntwo");

    expect(result.stdout).toBe("one\n");
  });

  it("should respect -n flag", async () => {
    const input = "1\n2\n3\n4\n5";
    const result = await dispatch(db, "head", ["-n", "3"], ctx, input);

    expect(result.stdout).toBe("1\n2\n3\n");
  });

  it("accepts stdin via explicit '-' operand", async () => {
    const result = await dispatch(
      db,
      "head",
      ["-n", "1", "-"],
      ctx,
      "one\ntwo",
    );

    expect(result.stdout).toBe("one\n");
  });

  it("stdin via -", async () => {
    const result = await dispatch(
      db,
      "head",
      ["-n", "1", "-"],
      ctx,
      "one\ntwo",
    );

    expect(result.stdout).toBe("one\n");
  });

  it("file", async () => {
    safeRead.mockResolvedValueOnce("one\ntwo");

    const result = await dispatch(db, "head", ["input", "-n", "1"], ctx, "");

    expect(result.stdout).toBe("one\n");
  });

  it("supports legacy -NUMBER shorthand", async () => {
    safeRead.mockResolvedValueOnce("one\ntwo\nthree\nfour");

    const result = await dispatch(db, "head", ["-2", "input"], ctx, "");

    expect(result.stdout).toBe("one\ntwo\n");
  });

  it("-number", async () => {
    safeRead.mockResolvedValueOnce("one\ntwo\nthree\nfour");

    const result = await dispatch(db, "head", ["-2", "input"], ctx, "");

    expect(result.stdout).toBe("one\ntwo\n");
  });

  it("default lines", async () => {
    const result = await dispatch(
      db,
      "head",
      [],
      ctx,
      "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12",
    );

    expect(result.stdout).toBe("1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n");
  });

  it("supports -c byte count", async () => {
    const result = await dispatch(db, "head", ["-c", "3"], ctx, "one\ntwo");

    expect(result.stdout).toBe("one");
  });

  it("-n takes precedence over -c when specified last", async () => {
    const result = await dispatch(
      db,
      "head",
      ["-c", "3", "-n", "1"],
      ctx,
      "one\ntwo",
    );

    expect(result.stdout).toBe("one\n");
  });

  it("-c takes precedence over -n when specified last", async () => {
    const result = await dispatch(
      db,
      "head",
      ["-n", "1", "-c", "3"],
      ctx,
      "one\ntwo",
    );

    expect(result.stdout).toBe("one");
  });
});
