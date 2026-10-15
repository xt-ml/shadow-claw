import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/tx-promise.js", () => ({
  txPromise: jest.fn(),
}));

const { getTask } = await import("./get-task.js");
const { txPromise } = await import("./tx-promise.js");

describe("getTask", () => {
  it("returns normalized task", async () => {
    (txPromise as any).mockResolvedValue({ id: "t1", enabled: 1 });
    await expect(getTask("t1")).resolves.toEqual({ id: "t1", enabled: true });
  });

  it("returns undefined for missing task", async () => {
    (txPromise as any).mockResolvedValue(undefined);
    await expect(getTask("none")).resolves.toBeUndefined();
  });
});
