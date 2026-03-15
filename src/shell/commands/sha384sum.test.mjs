import { jest } from "@jest/globals";
import {
  baseCtx,
  fail,
  ok,
  restoreCrypto,
  safeRead,
  setWebCrypto,
} from "./checksumTestHarness.mjs";

const { sha384sumCommand } = await import("./sha384sum.mjs");

describe("sha384sumCommand", () => {
  beforeEach(() => {
    setWebCrypto();
  });

  afterEach(() => {
    jest.clearAllMocks();
    restoreCrypto();
  });

  it("abc", async () => {
    const output = await sha384sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "abc",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7  -\n",
      ),
    });
  });

  it("longer str", async () => {
    const output = await sha384sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "3391fdddfc8dc7393707a65b1b4709397cf8b1d162af05abfe8f450de5f36bc6b0455a8520bc4e6f5fe95b1fe3c8452b  -\n",
      ),
    });
  });

  it("seq 10000", async () => {
    const stdin = `${Array.from({ length: 10000 }, (_, i) => i + 1).join("\n")}\n`;

    const output = await sha384sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin,
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "7d2a49098f0df0f3c152ca9916a3864542258b2bd487e00ea33cb68e7d27c5c0f25b540d29f62fb33720846073c51b66  -\n",
      ),
    });
  });

  it("file", async () => {
    safeRead.mockResolvedValueOnce("abc");

    const output = await sha384sumCommand({
      db: {},
      args: ["input"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7  input\n",
      ),
    });
  });

  it("file1 file2", async () => {
    safeRead.mockResolvedValueOnce("abc").mockResolvedValueOnce("def");

    const output = await sha384sumCommand({
      db: {},
      args: ["input", "file2"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7  input\n180c325cccb299e76ec6c03a5b5a7755af8ef499906dbf531f18d0ca509e4871b0805cac0f122b962d54badc6119f3cf  file2\n",
      ),
    });
  });
});
