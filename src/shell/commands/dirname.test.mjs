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

describe("dirname", () => {
  it("should return dirname", async () => {
    const result = await dispatch(db, "dirname", ["/foo/bar/baz.txt"], ctx, "");

    expect(result.stdout).toBe("/foo/bar\n");
  });

  it("should return . for relative file", async () => {
    const result = await dispatch(db, "dirname", ["file.txt"], ctx, "");

    expect(result.stdout).toBe(".\n");
  });

  it("handles slash-only path", async () => {
    const result = await dispatch(db, "dirname", ["///////"], ctx, "");

    expect(result.stdout).toBe("/\n");
  });

  it("trailing slash basename gives .", async () => {
    const result = await dispatch(db, "dirname", ["a//////"], ctx, "");

    expect(result.stdout).toBe(".\n");
  });

  it("preserves repeated leading/interior slashes", async () => {
    const result = await dispatch(
      db,
      "dirname",
      ["/////a///b///c///d/////"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("/////a///b///c\n");
  });

  it("supports multiple operands", async () => {
    const result = await dispatch(
      db,
      "dirname",
      ["hello/a", "world/b"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("hello\nworld\n");
  });

  it("/-only :: dirname ///////", async () => {
    const result = await dispatch(db, "dirname", ["///////"], ctx, "");

    expect(result.stdout).toBe("/\n");
  });

  it("trailing / :: dirname a//////", async () => {
    const result = await dispatch(db, "dirname", ["a//////"], ctx, "");

    expect(result.stdout).toBe(".\n");
  });

  it("combined :: dirname /////a///b///c///d/////", async () => {
    const result = await dispatch(
      db,
      "dirname",
      ["/////a///b///c///d/////"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("/////a///b///c\n");
  });

  it("/a/ :: dirname /////a///", async () => {
    const result = await dispatch(db, "dirname", ["/////a///"], ctx, "");

    expect(result.stdout).toBe("/\n");
  });

  it("multiple :: dirname hello/a world/b", async () => {
    const result = await dispatch(
      db,
      "dirname",
      ["hello/a", "world/b"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("hello\nworld\n");
  });
});
