import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/tx-promise.js", () => ({
  txPromise: jest.fn(),
}));

const { saveSession } = await import("./save-session.js");
const { txPromise } = await import("./tx-promise.js");

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
