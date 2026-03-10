import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { saveSession } = await import("./saveSession.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("saveSession", () => {
  it("persists session and resolves undefined", async () => {
    txPromise.mockResolvedValue("ok");
    const session = { groupId: "g1" };

    await expect(saveSession({}, session)).resolves.toBeUndefined();
    expect(txPromise).toHaveBeenCalledWith(
      {},
      "sessions",
      "readwrite",
      expect.any(Function),
    );
  });
});
