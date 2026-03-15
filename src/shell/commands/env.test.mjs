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

describe("env", () => {
  it("should list environment variables", async () => {
    const result = await dispatch(db, "env", [], ctx, "");

    expect(result.stdout).toContain("PWD=/workspace");
  });

  it("read", async () => {
    ctx.env = { WALRUS: "42", BANANA: "hello", LETTERS: "" };

    const result = await dispatch(db, "env", [], ctx, "");
    const lines = result.stdout.trim().split("\n").sort();

    expect(lines).toEqual(["BANANA=hello", "LETTERS=", "WALRUS=42"]);
  });

  it("-u", async () => {
    ctx.env = { WALRUS: "42", BANANA: "hello", LETTERS: "" };

    const result = await dispatch(db, "env", ["-u", "BANANA"], ctx, "");
    const lines = result.stdout.trim().split("\n").sort();

    expect(lines).toEqual(["LETTERS=", "WALRUS=42"]);
  });

  it("-uu", async () => {
    ctx.env = { WALRUS: "42", BANANA: "hello", LETTERS: "" };

    const result = await dispatch(
      db,
      "env",
      ["-u", "LETTERS", "-u", "WALRUS"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("BANANA=hello\n");
  });

  it("-i uses old \\$PATH", async () => {
    ctx.env = { PATH: "/usr/bin", WALRUS: "42" };

    const result = await dispatch(db, "env", ["-i"], ctx, "");

    expect(result.stdout).toBe("\n");

    expect(ctx.env.PATH).toBe("/usr/bin");
  });

  it("-i env", async () => {
    ctx.env = { PATH: "/usr/bin", WALRUS: "42" };

    const result = await dispatch(db, "env", ["-i", "env"], ctx, "");

    expect(result.stdout).toBe("\n");
  });
});
