import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { getConfig } = await import("./getConfig.js");
const { txPromise } = await import("../db/txPromise.js");

describe("getConfig", () => {
  it("returns entry value", async () => {
    (txPromise as any).mockResolvedValue({ key: "k", value: "abc" });

    await expect(getConfig({} as any, "k")).resolves.toBe("abc");
  });

  it("returns undefined when config key does not exist", async () => {
    (txPromise as any).mockResolvedValue(undefined);

    await expect(getConfig({} as any, "missing")).resolves.toBeUndefined();
  });
});
