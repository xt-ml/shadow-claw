import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { saveMessage } = await import("./saveMessage.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("saveMessage", () => {
  it("persists message via put and resolves undefined", async () => {
    txPromise.mockResolvedValue("ok");
    const msg = { id: "m1" };

    await expect(saveMessage({}, msg)).resolves.toBeUndefined();

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "messages",
      "readwrite",
      expect.any(Function),
    );
  });
});
