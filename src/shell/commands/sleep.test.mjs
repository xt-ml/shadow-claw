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

describe("sleep", () => {
  it("should wait (mocked timer)", async () => {
    jest.useFakeTimers();

    const promise = dispatch(db, "sleep", ["0.1"], ctx, "");
    jest.advanceTimersByTime(100);

    const result = await promise;
    expect(result.exitCode).toBe(0);

    jest.useRealTimers();
  });
});
