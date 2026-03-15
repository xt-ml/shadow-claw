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

describe("rev", () => {
  it("rev", async () => {
    const result = await dispatch(db, "rev", [], ctx, "zero\n");

    expect(result.stdout).toBe("orez\n");
  });

  it("file1 file2", async () => {
    safeRead.mockResolvedValueOnce("one\n").mockResolvedValueOnce("two\n");

    const result = await dispatch(db, "rev", ["file1", "file2"], ctx, "");

    expect(result.stdout).toBe("eno\nowt\n");
  });

  it("should reverse lines", async () => {
    const result = await dispatch(db, "rev", [], ctx, "abc\ndef");

    expect(result.stdout).toBe("cba\nfed");
  });

  it("should reverse file content when a file argument is provided", async () => {
    safeRead.mockResolvedValueOnce("abc\ndef");

    const result = await dispatch(db, "rev", ["input.txt"], ctx, "ignored");

    expect(safeRead).toHaveBeenCalledWith(db, "test-group", "input.txt");

    expect(result.stdout).toBe("cba\nfed");
  });

  it("should return empty output when file content is missing", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "rev", ["missing.txt"], ctx, "ignored");

    expect(result.stdout).toBe("");
  });
});
