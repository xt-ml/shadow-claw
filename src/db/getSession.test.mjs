import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { getSession } = await import("./getSession.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("getSession", () => {
  it("reads session by group id", async () => {
    const session = { groupId: "g1", messages: [], updatedAt: 1 };
    txPromise.mockResolvedValue(session);

    await expect(getSession({}, "g1")).resolves.toEqual(session);
    expect(txPromise).toHaveBeenCalledWith(
      {},
      "sessions",
      "readonly",
      expect.any(Function),
    );
  });
});
