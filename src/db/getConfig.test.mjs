import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { getConfig } = await import("./getConfig.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("getConfig", () => {
  it("returns entry value", async () => {
    txPromise.mockResolvedValue({ key: "k", value: "abc" });
    await expect(getConfig({}, "k")).resolves.toBe("abc");
  });

  it("returns undefined when config key does not exist", async () => {
    txPromise.mockResolvedValue(undefined);
    await expect(getConfig({}, "missing")).resolves.toBeUndefined();
  });
});
