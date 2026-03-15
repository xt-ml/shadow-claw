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

describe("mv", () => {
  it("should move file (copy then delete)", async () => {
    safeRead.mockResolvedValueOnce("content");

    await dispatch(db, "mv", ["src.txt", "dst.txt"], ctx, "");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "dst.txt",
      "content",
    );

    expect(deleteGroupFile).toHaveBeenCalledWith(db, "test-group", "src.txt");
  });

  it("should fail when operands are missing", async () => {
    const result = await dispatch(db, "mv", ["src.txt"], ctx, "");

    expect(result.stderr).toBe("mv: missing operands");

    expect(result.exitCode).toBe(1);
  });

  it("should fail when the source file does not exist", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "mv", ["src.txt", "dst.txt"], ctx, "");

    expect(result.stderr).toBe("mv: src.txt: No such file");

    expect(result.exitCode).toBe(1);
  });
});
