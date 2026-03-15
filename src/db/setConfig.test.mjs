import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { setConfig } = await import("./setConfig.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("setConfig", () => {
  it("persists key/value and resolves undefined", async () => {
    txPromise.mockResolvedValue(1);

    await expect(setConfig({}, "k", "v")).resolves.toBeUndefined();

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "config",
      "readwrite",
      expect.any(Function),
    );
  });
});
