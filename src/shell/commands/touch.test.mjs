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

describe("touch", () => {
  it("should create an empty file if it does not exist", async () => {
    safeRead.mockResolvedValueOnce(null);

    await dispatch(db, "touch", ["newfile.txt"], ctx, "");

    expect(writeGroupFile).toHaveBeenCalledWith(
      db,
      "test-group",
      "newfile.txt",
      "",
    );
  });

  it("should not overwrite if file exists", async () => {
    safeRead.mockResolvedValueOnce("existing content");

    await dispatch(db, "touch", ["existing.txt"], ctx, "");

    expect(writeGroupFile).not.toHaveBeenCalled();
  });

  it("touch :: touch walrus && [ -e walrus ] && echo yes", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "touch", ["walrus"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(writeGroupFile).toHaveBeenCalledWith(db, "test-group", "walrus", "");
  });

  it("1 2 3 :: touch one two three && rm one two three && echo yes", async () => {
    safeRead
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await dispatch(db, "touch", ["one", "two", "three"], ctx, "");

    expect(writeGroupFile).toHaveBeenCalledTimes(3);
  });

  it("-c :: touch -c walrus && [ -e walrus ] && echo yes", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(db, "touch", ["-c", "walrus"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(writeGroupFile).not.toHaveBeenCalled();
  });

  it("-c missing :: touch -c warrus && [ ! -e warrus ] && echo yes", async () => {
    safeRead.mockResolvedValueOnce(null);

    await dispatch(db, "touch", ["-c", "warrus"], ctx, "");

    expect(writeGroupFile).not.toHaveBeenCalled();
  });

  it("-t - :: TZ=utc touch -t 200109090146.40 - > walrus && TZ=utc date -r walrus +%s", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(
      db,
      "touch",
      ["-t", "200109090146.40", "-"],
      ctx,
      "",
    );

    expect(result.exitCode).toBe(0);

    expect(writeGroupFile).toHaveBeenCalledWith(db, "test-group", "-", "");
  });
});
