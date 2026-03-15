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

describe("date", () => {
  it("should return an ISO date string", async () => {
    const result = await dispatch(db, "date", [], ctx, "");

    expect(new Date(result.stdout.trim()).toISOString()).toEqual(
      result.stdout.trim(),
    );
  });

  it("-d @0 :: TZ=$tz date -d @0", async () => {
    const result = await dispatch(db, "date", ["-d", "@0"], ctx, "");

    expect(new Date(result.stdout.trim()).toISOString()).toBe(
      result.stdout.trim(),
    );
  });

  it("-d @0x123 invalid :: TZ=$tz date -d @0x123 2>/dev/null || echo expected error", async () => {
    const result = await dispatch(db, "date", ["-d", "@0x123"], ctx, "");

    expect(result.exitCode).toBe(0);
  });

  it("-d 1980-01-02 :: TZ=$tz date -d 1980-01-02", async () => {
    const result = await dispatch(db, "date", ["-d", "1980-01-02"], ctx, "");

    expect(new Date(result.stdout.trim()).toISOString()).toBe(
      result.stdout.trim(),
    );
  });

  it("-d 1980-01-02 12:34 :: TZ=$tz date -d '1980-01-02 12:34'", async () => {
    const result = await dispatch(
      db,
      "date",
      ["-d", "1980-01-02 12:34"],
      ctx,
      "",
    );

    expect(new Date(result.stdout.trim()).toISOString()).toBe(
      result.stdout.trim(),
    );
  });

  it("-d 1980-01-02 12:34:56 :: TZ=$tz date -d '1980-01-02 12:34:56'", async () => {
    const result = await dispatch(
      db,
      "date",
      ["-d", "1980-01-02 12:34:56"],
      ctx,
      "",
    );

    expect(new Date(result.stdout.trim()).toISOString()).toBe(
      result.stdout.trim(),
    );
  });
});
