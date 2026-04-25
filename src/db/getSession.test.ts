import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { getSession } = await import("./getSession.js");
const { txPromise } = await import("../db/txPromise.js");

describe("getSession", () => {
  it("reads session by group id", async () => {
    const session: any = { groupId: "g1", messages: [], updatedAt: 1 };

    (txPromise as any).mockResolvedValue(session);

    await expect(getSession({} as any, "g1")).resolves.toEqual(session);

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "sessions",
      "readonly",
      expect.any(Function),
    );
  });
});
