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

describe("tee", () => {
  it("should write to file and stdout", async () => {
    const result = await dispatch(db, "tee", ["out.txt"], ctx, "hello");

    expect(result.stdout).toBe("hello");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "out.txt",
      "hello",
    );
  });

  it(" :: tee", async () => {
    const result = await dispatch(db, "tee", [], ctx, "one");

    expect(result.stdout).toBe("one");

    expect(result.exitCode).toBe(0);
  });

  it(" :: tee -", async () => {
    const result = await dispatch(db, "tee", ["-"], ctx, "two\n");

    expect(result.stdout).toBe("two\n");

    expect(writeGroupFile).toHaveBeenCalledWith(db, "test-group", "-", "two\n");
  });

  it(" :: tee one > two && cmp one two && echo that", async () => {
    const result = await dispatch(db, "tee", ["one"], ctx, "three");

    expect(result.stdout).toBe("three");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "one",
      "three",
    );
  });
});
