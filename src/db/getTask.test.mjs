import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { getTask } = await import("./getTask.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("getTask", () => {
  it("returns normalized task", async () => {
    txPromise.mockResolvedValue({ id: "t1", enabled: 1 });
    await expect(getTask("t1")).resolves.toEqual({ id: "t1", enabled: true });
  });

  it("returns undefined for missing task", async () => {
    txPromise.mockResolvedValue(undefined);
    await expect(getTask("none")).resolves.toBeUndefined();
  });
});
