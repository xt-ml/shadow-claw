import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { saveMessage } = await import("./saveMessage.js");
const { txPromise } = await import("../db/txPromise.js");

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
