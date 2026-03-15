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

describe("base64", () => {
  it("simple", async () => {
    const result = await dispatch(db, "base64", [], ctx, "simple\n");

    expect(result.stdout).toBe("c2ltcGxlCg==\n");
  });

  it("file", async () => {
    safeRead.mockResolvedValueOnce("simple\n");

    const result = await dispatch(db, "base64", ["input"], ctx, "");

    expect(result.stdout).toBe("c2ltcGxlCg==\n");
  });

  it("simple -d", async () => {
    const result = await dispatch(db, "base64", ["-d"], ctx, "c2ltcGxlCg==\n");

    expect(result.stdout).toBe("simple\n");
  });

  it("simple -d input", async () => {
    safeRead.mockResolvedValueOnce("c2ltcGxlCg==");

    const result = await dispatch(db, "base64", ["-d", "input"], ctx, "");

    expect(result.stdout).toBe("simple\n");
  });

  it("default wrap", async () => {
    const result = await dispatch(
      db,
      "base64",
      [],
      ctx,
      "We've replaced the dilithium they normally use with Folger's Crystals.",
    );

    expect(result.stdout).toBe(
      "V2UndmUgcmVwbGFjZWQgdGhlIGRpbGl0aGl1bSB0aGV5IG5vcm1hbGx5IHVzZSB3aXRoIEZvbGdl\ncidzIENyeXN0YWxzLg==\n",
    );
  });

  it("-w 10", async () => {
    const result = await dispatch(
      db,
      "base64",
      ["-w", "10"],
      ctx,
      "Marching to the beat of a different kettle of fish.\n",
    );

    expect(result.stdout).toBe(
      "TWFyY2hpbm\ncgdG8gdGhl\nIGJlYXQgb2\nYgYSBkaWZm\nZXJlbnQga2\nV0dGxlIG9m\nIGZpc2guCg\n==\n",
    );
  });
});
