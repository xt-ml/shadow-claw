import { jest } from "@jest/globals";
import {
  baseCtx,
  fail,
  ok,
  restoreCrypto,
  safeRead,
  setWebCrypto,
} from "./checksumTestHarness.mjs";

const { sha1sumCommand } = await import("./sha1sum.mjs");

describe("sha1sumCommand", () => {
  beforeEach(() => {
    setWebCrypto();
  });

  afterEach(() => {
    jest.clearAllMocks();
    restoreCrypto();
  });

  it("abc", async () => {
    const output = await sha1sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "abc",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok("a9993e364706816aba3e25717850c26c9cd0d89d  -\n"),
    });
  });

  it("longer str", async () => {
    const output = await sha1sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok("84983e441c3bd26ebaae4aa1f95129e5e54670f1  -\n"),
    });
  });

  it("seq 10000", async () => {
    const stdin = `${Array.from({ length: 10000 }, (_, i) => i + 1).join("\n")}\n`;

    const output = await sha1sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin,
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok("f70b7b8768a1183d6d1cd79d3b076d9eb5156350  -\n"),
    });
  });

  it("file", async () => {
    safeRead.mockResolvedValueOnce("abc");

    const output = await sha1sumCommand({
      db: {},
      args: ["input"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok("a9993e364706816aba3e25717850c26c9cd0d89d  input\n"),
    });
  });

  it("file1 file2", async () => {
    safeRead.mockResolvedValueOnce("abc").mockResolvedValueOnce("def");

    const output = await sha1sumCommand({
      db: {},
      args: ["input", "file2"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "a9993e364706816aba3e25717850c26c9cd0d89d  input\n589c22335a381f122d129225f5c0ba3056ed5811  file2\n",
      ),
    });
  });
});
