import { jest } from "@jest/globals";
import {
  baseCtx,
  fail,
  ok,
  restoreCrypto,
  safeRead,
  setWebCrypto,
} from "./checksumTestHarness.mjs";

const { sha512sumCommand } = await import("./sha512sum.mjs");

describe("sha512sumCommand", () => {
  beforeEach(() => {
    setWebCrypto();
  });

  afterEach(() => {
    jest.clearAllMocks();
    restoreCrypto();
  });

  it("abc", async () => {
    const output = await sha512sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "abc",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f  -\n",
      ),
    });
  });

  it("longer str", async () => {
    const output = await sha512sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin: "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "204a8fc6dda82f0a0ced7beb8e08a41657c16ef468b228a8279be331a703c33596fd15c13b1b07f9aa1d3bea57789ca031ad85c7a71dd70354ec631238ca3445  -\n",
      ),
    });
  });

  it("seq 10000", async () => {
    const stdin = `${Array.from({ length: 10000 }, (_, i) => i + 1).join("\n")}\n`;

    const output = await sha512sumCommand({
      db: {},
      args: [],
      ctx: baseCtx(),
      stdin,
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "3000c8961bb83de289fa8b407d0ea23f53a57ea11ddb0f782a4ccc0f586780822946053132794b177823c2974873d5dfb2ab1b6c45ae3328e2e703ca907f54d7  -\n",
      ),
    });
  });

  it("file", async () => {
    safeRead.mockResolvedValueOnce("abc");

    const output = await sha512sumCommand({
      db: {},
      args: ["input"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f  input\n",
      ),
    });
  });

  it("file1 file2", async () => {
    safeRead.mockResolvedValueOnce("abc").mockResolvedValueOnce("def");

    const output = await sha512sumCommand({
      db: {},
      args: ["input", "file2"],
      ctx: baseCtx(),
      stdin: "",
      ok,
      fail,
    });

    expect(output).toEqual({
      result: ok(
        "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f  input\n40a855bf0a93c1019d75dd5b59cd8157608811dd75c5977e07f3bc4be0cad98b22dde4db9ddb429fc2ad3cf9ca379fedf6c1dc4d4bb8829f10c2f0ee04a66663  file2\n",
      ),
    });
  });
});
