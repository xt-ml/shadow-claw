import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/tx-promise.js", () => ({
  txPromise: jest.fn(),
}));

const { saveMessage } = await import("./save-message.js");
const { txPromise } = await import("./tx-promise.js");

describe("saveMessage", () => {
  it("persists message via put and resolves undefined", async () => {
    (txPromise as any).mockResolvedValue("ok");
    const msg: any = { id: "m1" };

    await expect(saveMessage({} as any, msg)).resolves.toBeUndefined();

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "messages",
      "readwrite",
      expect.any(Function),
    );
  });
});
