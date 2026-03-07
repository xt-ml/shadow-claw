import { jest } from "@jest/globals";

// Mock txPromise
jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { deleteConfig } = await import("./deleteConfig.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("deleteConfig", () => {
  const db = {};
  const key = "test-key";

  it("should call txPromise with config store and readwrite mode", async () => {
    txPromise.mockResolvedValue();

    await deleteConfig(db, key);

    expect(txPromise).toHaveBeenCalledWith(
      db,
      "config",
      "readwrite",
      expect.any(Function),
    );
  });

  it("should call store.delete with the provided key", async () => {
    const mockStore = {
      delete: jest.fn(),
    };

    txPromise.mockImplementation((db, storeName, mode, callback) => {
      return Promise.resolve(callback(mockStore));
    });

    await deleteConfig(db, key);

    expect(mockStore.delete).toHaveBeenCalledWith(key);
  });
});
