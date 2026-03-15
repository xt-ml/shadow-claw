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

describe("echo", () => {
  it("should echo arguments", async () => {
    const result = await dispatch(db, "echo", ["hello", "world"], ctx, "");

    expect(result.stdout).toBe("hello world\n");

    expect(result.exitCode).toBe(0);
  });

  it("echo", async () => {
    const result = await dispatch(db, "echo", [], ctx, "");

    expect(result.stdout).toBe("\n");
  });

  it("1 2 3", async () => {
    const result = await dispatch(db, "echo", ["one", "two", "three"], ctx, "");

    expect(result.stdout).toBe("one two three\n");
  });

  it("with spaces", async () => {
    const result = await dispatch(db, "echo", ["one  two\tthree"], ctx, "");

    expect(result.stdout).toBe("one  two\tthree\n");
  });

  it(" :: -n", async () => {
    const result = await dispatch(db, "echo", ["-n"], ctx, "");

    expect(result.stdout).toBe("");
  });

  it(" :: -n one", async () => {
    const result = await dispatch(db, "echo", ["-n", "one"], ctx, "");

    expect(result.stdout).toBe("one");
  });
});
