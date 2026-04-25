import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { setConfig } = await import("./setConfig.js");
const { txPromise } = await import("../db/txPromise.js");

describe("setConfig", () => {
  it("persists key/value and resolves undefined", async () => {
    (txPromise as any).mockResolvedValue(1);

    await expect(setConfig({} as any, "k", "v")).resolves.toBeUndefined();

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "config",
      "readwrite",
      expect.any(Function),
    );
  });
});
