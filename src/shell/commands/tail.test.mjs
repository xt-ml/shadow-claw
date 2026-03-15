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

describe("tail", () => {
  it("should return last 10 lines by default", async () => {
    const input = Array(15)
      .fill(0)
      .map((_, i) => `line ${i + 1}`)
      .join("\n");

    const result = await dispatch(db, "tail", [], ctx, input);
    const lines = result.stdout.trim().split("\n");

    expect(lines.length).toBe(10);

    expect(lines[0]).toBe("line 6");

    expect(lines[9]).toBe("line 15");
  });

  it("should respect -n flag", async () => {
    const input = "1\n2\n3\n4\n5";
    const result = await dispatch(db, "tail", ["-n", "3"], ctx, input);

    expect(result.stdout).toBe("3\n4\n5");
  });

  it("tail :: tail && echo yes", async () => {
    const result = await dispatch(db, "tail", [], ctx, "");

    expect(result.stdout).toBe("");

    expect(result.exitCode).toBe(0);
  });

  it("file :: tail file1", async () => {
    safeRead.mockResolvedValueOnce(
      "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven\n",
    );

    const result = await dispatch(db, "tail", ["file1"], ctx, "");

    expect(result.stdout).toBe(
      "two\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven\n",
    );
  });

  it("-n in bounds :: tail -n 3 file1", async () => {
    safeRead.mockResolvedValueOnce("one\ntwo\nthree\nfour\n");

    const result = await dispatch(db, "tail", ["-n", "3", "file1"], ctx, "");

    expect(result.stdout).toBe("two\nthree\nfour\n");
  });

  it("-n out of bounds :: tail -n 999 file1", async () => {
    safeRead.mockResolvedValueOnce("one\ntwo\nthree\n");

    const result = await dispatch(db, "tail", ["-n", "999", "file1"], ctx, "");

    expect(result.stdout).toBe("one\ntwo\nthree\n");
  });

  it("-n+ in bounds :: tail -n +3 file1", async () => {
    safeRead.mockResolvedValueOnce("one\ntwo\nthree\nfour\n");

    const result = await dispatch(db, "tail", ["-n", "+3", "file1"], ctx, "");

    expect(result.stdout).toBe("three\nfour\n");
  });

  it("supports -c byte mode", async () => {
    const result = await dispatch(db, "tail", ["-c", "3"], ctx, "one\ntwo");

    expect(result.stdout).toBe("two");
  });

  it("supports -c +N byte mode", async () => {
    const result = await dispatch(db, "tail", ["-c", "+3"], ctx, "one\ntwo");

    expect(result.stdout).toBe("e\ntwo");
  });

  it("supports legacy -N shorthand", async () => {
    safeRead.mockResolvedValueOnce("one\ntwo\nthree");

    const result = await dispatch(db, "tail", ["-1", "file1"], ctx, "");

    expect(result.stdout).toBe("three");
  });
});
