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

describe("diff", () => {
  it("returns code 2 for unknown flags", async () => {
    const result = await dispatch(
      db,
      "diff",
      ["--oops", "left", "right"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(2);

    expect(result.stderr).toBe("diff: unrecognized option '--oops'");
  });

  it("returns code 2 when input files are missing", async () => {
    safeRead.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const result = await dispatch(
      db,
      "diff",
      ["missing1", "missing2"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(2);

    expect(result.stderr).toBe("diff: missing1: No such file or directory");
  });

  it("accepts stdin for both operands", async () => {
    const result = await dispatch(db, "diff", ["-", "-"], ctx, "whatever\n");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("");
  });

  it("supports quiet mode for differences", async () => {
    safeRead
      .mockResolvedValueOnce("hello\nworld\n")
      .mockResolvedValueOnce("hello\nthere\n");

    const result = await dispatch(db, "diff", ["-q", "a", "b"], ctx, "");

    expect(result.exitCode).toBe(1);

    expect(result.stdout).toBe("Files a and b differ\n");
  });

  it("supports unified-style output labels", async () => {
    safeRead
      .mockResolvedValueOnce("1\n2\n3\n")
      .mockResolvedValueOnce("1\n2\n3\n4\n");

    const result = await dispatch(
      db,
      "diff",
      ["-u", "-L", "lll", "-L", "rrr", "left", "right"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(1);

    expect(result.stdout).toContain("--- lll\n");

    expect(result.stdout).toContain("+++ rrr\n");

    expect(result.stdout).toContain("+4\n");
  });
});
