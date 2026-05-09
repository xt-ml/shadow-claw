import { jest } from "@jest/globals";

// Mock txPromise
jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { deleteConfig } = await import("./deleteConfig.js");
const { txPromise } = await import("../db/txPromise.js");

describe("deleteConfig", () => {
  const db: any = {} as any;
  const key = "test-key";

  it("should call txPromise with config store and readwrite mode", async () => {
    (txPromise as any).mockResolvedValue();

    await deleteConfig(db, key);

    expect(txPromise).toHaveBeenCalledWith(
      db,
      "config",
      "readwrite",
      expect.any(Function),
    );
  });

  it("should call store.delete with the provided key", async () => {
    const mockStore: any = {
      delete: jest.fn(),
    };

    (txPromise as any).mockImplementation(
      (_db, _storeName, _mode, callback) => {
        return Promise.resolve(callback(mockStore));
      },
    );

    await deleteConfig(db, key);

    expect(mockStore.delete).toHaveBeenCalledWith(key);
  });
});
