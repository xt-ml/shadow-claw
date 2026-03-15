import { jest } from "@jest/globals";
import {
  baseCtx,
  fail,
  ok,
  restoreCrypto,
  safeRead,
} from "./checksumTestHarness.mjs";

const { md5sumCommand } = await import("./md5sum.mjs");

describe("md5sumCommand", () => {
  afterEach(() => {
    jest.clearAllMocks();
    restoreCrypto();
  });

  it("'' :: md5sum", async () => {
    const output = await md5sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok("d41d8cd98f00b204e9800998ecf8427e  -\n"),
    });
  });

  it("infile", async () => {
    safeRead.mockResolvedValueOnce("a");

    const output = await md5sumCommand({
      db: {},
      args: ["input"],
      ctx: baseCtx("docs", "/workspace/docs"),
      stdin: "ignored",
      ok,
      fail,
    });

    expect(safeRead).toHaveBeenCalledWith({}, "g1", "docs/input");

    expect(output).toEqual({
      result: ok("0cc175b9c0f1b6a831c399e269772661  input\n"),
    });
  });

  it("two files", async () => {
    safeRead.mockResolvedValueOnce("message digest");

    const output = await md5sumCommand({
      db: {},
      args: ["-", "input"],
      ctx: baseCtx(),
      stdin: "abc",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "900150983cd24fb0d6963f7d28e17f72  -\nf96b697d7cb7938d525a2f31aaf161d0  input\n",
      ),
    });
  });

  it("4", async () => {
    const output = await md5sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "abcdefghijklmnopqrstuvwxyz",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok("c3fcd3d76192e4007dfb496cca67e13b  -\n"),
    });
  });

  it("5", async () => {
    const output = await md5sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok("d174ab98d277d9f5a5611c2c9f419d9f  -\n"),
    });
  });

  it("fails when an operand file is missing", async () => {
    safeRead.mockResolvedValueOnce(null);

    const output = await md5sumCommand({
      db: {},
      args: ["missing.txt"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: fail("md5sum: missing.txt: No such file or directory"),
    });
  });
});
