import { jest } from "@jest/globals";
import {
  baseCtx,
  fail,
  ok,
  restoreCrypto,
  safeRead,
  setCrypto,
  setWebCrypto,
} from "./checksumTestHarness.mjs";

const { sha256sumCommand } = await import("./sha256sum.mjs");

describe("sha256sumCommand", () => {
  beforeEach(() => {
    setWebCrypto();
  });

  afterEach(() => {
    jest.clearAllMocks();
    restoreCrypto();
  });

  it("abc", async () => {
    const output = await sha256sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "abc",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  -\n",
      ),
    });
  });

  it("longer str", async () => {
    const output = await sha256sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1  -\n",
      ),
    });
  });

  it("seq 10000", async () => {
    const stdin = `${Array.from({ length: 10000 }, (_, i) => i + 1).join("\n")}\n`;

    const output = await sha256sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin,
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "8060aa0ac20a3e5db2b67325c98a0122f2d09a612574458225dcb9a086f87cc3  -\n",
      ),
    });
  });

  it("file", async () => {
    safeRead.mockResolvedValueOnce("abc");

    const output = await sha256sumCommand({
      db: {},
      args: ["input"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  input\n",
      ),
    });
  });

  it("file1 file2", async () => {
    safeRead.mockResolvedValueOnce("abc").mockResolvedValueOnce("def");

    const output = await sha256sumCommand({
      db: {},
      args: ["input", "file2"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  input\ncb8379ac2098aa165029e3938a51da0bcecfc008fd6795f401178647f96c5b34  file2\n",
      ),
    });
  });

  it("fails when crypto.subtle is unavailable", async () => {
    setCrypto({});

    const output = await sha256sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "hello",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: fail("sha256sum: crypto.subtle is not available"),
    });
  });

  it("fails when an operand file is missing", async () => {
    safeRead.mockResolvedValueOnce(null);

    const output = await sha256sumCommand({
      db: {},
      args: ["missing.txt"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: fail("sha256sum: missing.txt: No such file or directory"),
    });
  });
});
