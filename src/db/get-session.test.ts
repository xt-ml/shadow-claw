import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/tx-promise.js", () => ({
  txPromise: jest.fn(),
}));

const { getSession } = await import("./get-session.js");
const { txPromise } = await import("./tx-promise.js");

describe("getSession", () => {
  it("reads session by group id", async () => {
    const session: any = { groupId: "g1", messages: [], updatedAt: 1 };

    (txPromise as any).mockImplementation(
      async (
        _db: any,
        _storeName: any,
        _mode: any,
        fn: (store: any) => any,
      ) => {
        const mockStore = {
          get: jest.fn().mockReturnValue(session),
        };
        return fn(mockStore);
      },
    );

    await expect(getSession({} as any, "g1")).resolves.toEqual(session);

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "sessions",
      "readonly",
      expect.any(Function),
    );
  });
});
