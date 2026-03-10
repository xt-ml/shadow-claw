import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { getAllConfig } = await import("./getAllConfig.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("getAllConfig", () => {
  it("reads all config entries via txPromise", async () => {
    txPromise.mockResolvedValue([{ key: "k", value: "v" }]);
    const result = await getAllConfig();

    expect(result).toEqual([{ key: "k", value: "v" }]);
    expect(txPromise).toHaveBeenCalledWith(
      "config",
      "readonly",
      expect.any(Function),
    );
  });
});
