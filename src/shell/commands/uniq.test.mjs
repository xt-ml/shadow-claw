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

describe("uniq", () => {
  it("should remove consecutive duplicates", async () => {
    const result = await dispatch(db, "uniq", [], ctx, "a\na\nb\na");

    expect(result.stdout).toBe("a\nb\na");
  });

  // Test with all identical
  it("should handle all identical lines", async () => {
    const result = await dispatch(db, "uniq", [], ctx, "a\na\na");

    expect(result.stdout).toBe("a");
  });

  // Test with no duplicates
  it("should preserve all unique consecutive", async () => {
    const result = await dispatch(db, "uniq", [], ctx, "a\nb\nc");

    expect(result.stdout).toBe("a\nb\nc");
  });

  // Test with single line
  it("should handle single line", async () => {
    const result = await dispatch(db, "uniq", [], ctx, "hello");

    expect(result.stdout).toBe("hello");
  });

  // Test empty input
  it("should handle empty input", async () => {
    const result = await dispatch(db, "uniq", [], ctx, "");

    expect(result.stdout).toBe("");
  });

  // Test non-consecutive duplicates not removed
  it("should NOT remove non-consecutive duplicates", async () => {
    const result = await dispatch(db, "uniq", [], ctx, "a\nb\na");

    expect(result.stdout).toBe("a\nb\na");
  });

  // Test multiple duplicates in a row
  it("should reduce multiple to one", async () => {
    const result = await dispatch(db, "uniq", [], ctx, "a\na\na\nb\nc\nc");

    expect(result.stdout).toBe("a\nb\nc");
  });
});
