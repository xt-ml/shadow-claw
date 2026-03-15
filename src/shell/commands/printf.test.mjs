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

describe("printf", () => {
  it("should format strings", async () => {
    const result = await dispatch(db, "printf", ["hello %s", "world"], ctx, "");

    expect(result.stdout).toBe("hello world");
  });

  it("should handle no arguments", async () => {
    const result = await dispatch(db, "printf", [], ctx, "");

    expect(result.stdout).toBe("");
  });

  it("text", async () => {
    const result = await dispatch(db, "printf", ["TEXT"], ctx, "");

    expect(result.stdout).toBe("TEXT");
  });

  it("escapes", async () => {
    const result = await dispatch(
      db,
      "printf",
      ["one\\ntwo\\n\\v\\t\\r\\f\\e\\b\\athree"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("one\ntwo\n\v\t\r\f\x1b\b\x07three");
  });

  it("%b escapes", async () => {
    const result = await dispatch(
      db,
      "printf",
      ["%b", "one\\ntwo\\n\\v\\t\\r\\f\\e\\b\\athree"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("one\ntwo\n\v\t\r\f\x1b\b\x07three");
  });

  it("null", async () => {
    const result = await dispatch(db, "printf", ["x\\0y"], ctx, "");

    const bytes = Array.from(new TextEncoder().encode(result.stdout)).map((b) =>
      b.toString(16).padStart(2, "0"),
    );

    expect(bytes.join(" ")).toBe("78 00 79");
  });

  it("trailing slash", async () => {
    const result = await dispatch(db, "printf", ["abc\\"], ctx, "");

    expect(result.stdout).toBe("abc\\");
  });
});
