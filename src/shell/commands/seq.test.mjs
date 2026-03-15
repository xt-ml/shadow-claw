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

describe("seq", () => {
  it("should generate sequence with end", async () => {
    const result = await dispatch(db, "seq", ["3"], ctx, "");

    expect(result.stdout).toBe("1\n2\n3\n");
  });

  it("should generate sequence with start and end", async () => {
    const result = await dispatch(db, "seq", ["2", "4"], ctx, "");

    expect(result.stdout).toBe("2\n3\n4\n");
  });

  it("should generate sequence with step", async () => {
    const result = await dispatch(db, "seq", ["1", "2", "5"], ctx, "");

    expect(result.stdout).toBe("1\n3\n5\n");
  });

  it("(exit with error) :: seq 2> /dev/null || echo yes", async () => {
    const result = await dispatch(db, "seq", [], ctx, "");

    expect(result.exitCode).toBe(1);
  });

  it("one argument", async () => {
    const result = await dispatch(db, "seq", ["3"], ctx, "");

    expect(result.stdout).toBe("1\n2\n3\n");

    expect(result.exitCode).toBe(0);
  });

  it("two arguments", async () => {
    const result = await dispatch(db, "seq", ["5", "7"], ctx, "");

    expect(result.stdout).toBe("5\n6\n7\n");

    expect(result.exitCode).toBe(0);
  });

  it("two arguments reversed", async () => {
    const result = await dispatch(db, "seq", ["7", "5"], ctx, "");

    expect(result.stdout).toBe("");

    expect(result.exitCode).toBe(0);
  });

  it("(exit with error) :: seq 1 2 3 4 2> /dev/null || echo yes", async () => {
    const result = await dispatch(db, "seq", ["1", "2", "3", "4"], ctx, "");

    expect(result.exitCode).toBe(1);
  });
});
