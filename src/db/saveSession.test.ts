import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { saveSession } = await import("./saveSession.js");
const { txPromise } = await import("../db/txPromise.js");

describe("saveSession", () => {
  it("persists session and resolves undefined", async () => {
    (txPromise as any).mockResolvedValue("ok");
    const session: any = { groupId: "g1" };

    await expect(saveSession({} as any, session)).resolves.toBeUndefined();

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "sessions",
      "readwrite",
      expect.any(Function),
    );
  });
});
