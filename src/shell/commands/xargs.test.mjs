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

describe("xargs", () => {
  it("should run command with arguments from stdin", async () => {
    // runSingle is used, which we might need to mock if it's not working in tests
    // For now let's see if we can just test the dispatch call
    const result = await dispatch(db, "xargs", ["echo"], ctx, "a\nb\nc");

    expect(result.stdout).toBe("a b c\n");
  });

  it("should pass stdin through when no command is provided", async () => {
    const result = await dispatch(db, "xargs", [], ctx, "a\nb\nc\n");

    expect(result.stdout).toBe("a b c\n");

    expect(result.exitCode).toBe(0);
  });

  it("xargs :: xargs && echo yes", async () => {
    const result = await dispatch(db, "xargs", [], ctx, "hello");

    expect(result.stdout).toBe("hello\n");

    expect(result.exitCode).toBe(0);
  });

  it("spaces :: xargs", async () => {
    const result = await dispatch(
      db,
      "xargs",
      [],
      ctx,
      "one two\tthree  \nfour\n\n",
    );

    expect(result.stdout).toBe("one two three four\n");
  });

  it("-a :: xargs -a args cat -", async () => {
    safeRead
      .mockResolvedValueOnce("one\ntwo\nthree\n")
      .mockResolvedValueOnce("1\n")
      .mockResolvedValueOnce("2\n")
      .mockResolvedValueOnce("3\n");

    const result = await dispatch(
      db,
      "xargs",
      ["-a", "args", "cat", "-"],
      ctx,
      "stdin\n",
    );

    expect(result.stdout).toBe("stdin\n1\n2\n3\n");

    expect(result.exitCode).toBe(0);
  });

  it("-n 0 :: xargs -n 0 2>/dev/null || echo ok", async () => {
    const result = await dispatch(
      db,
      "xargs",
      ["-n", "0"],
      ctx,
      "one \ntwo\n three",
    );

    expect(result.exitCode).toBe(1);

    expect(result.stderr).toBe("xargs: value 0 for -n option should be >= 1");
  });

  it("-n 1 :: xargs -n 1", async () => {
    const result = await dispatch(db, "xargs", ["-n", "1"], ctx, "one\n");

    expect(result.stdout).toBe("one\n");

    expect(result.exitCode).toBe(0);
  });
});
