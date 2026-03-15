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

describe("mkdir", () => {
  it("mkdir", async () => {
    const result = await dispatch(db, "mkdir", ["one"], ctx, "");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "one/.keep",
      "",
    );

    expect(result.stdout).toBe("");
  });

  it("-p existing", async () => {
    writeGroupFile.mockRejectedValueOnce(new Error("already exists"));

    const result = await dispatch(db, "mkdir", ["-p", "existing"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("");
  });

  it("-vp", async () => {
    const result = await dispatch(db, "mkdir", ["-v", "-p", "walrus"], ctx, "");

    expect(result.stdout).toBe("mkdir: created directory 'walrus'\n");
  });

  it("-vp exists", async () => {
    writeGroupFile.mockRejectedValueOnce(new Error("already exists"));

    const result = await dispatch(db, "mkdir", ["-v", "-p", "walrus"], ctx, "");

    expect(result.stdout).toBe("");

    expect(result.exitCode).toBe(0);
  });

  it("should create a .keep file in the new directory", async () => {
    await dispatch(db, "mkdir", ["newdir"], ctx, "");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "newdir/.keep",
      "",
    );
  });
});
