import { jest } from "@jest/globals";

jest.unstable_mockModule("./txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { deleteMessage } = await import("./deleteMessage.js");
const { txPromise } = await import("./txPromise.js");

describe("deleteMessage", () => {
  it("deletes message via delete and resolves undefined", async () => {
    (txPromise as any).mockResolvedValue("ok");
    const id = "msg-123";

    await expect(deleteMessage({} as any, id)).resolves.toBeUndefined();

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "messages",
      "readwrite",
      expect.any(Function),
    );

    // Verify the callback uses store.delete(id)
    const callback = (txPromise as any).mock.calls[0][3];
    const mockStore = { delete: jest.fn() };
    callback(mockStore);
    expect(mockStore.delete).toHaveBeenCalledWith(id);
  });
});
