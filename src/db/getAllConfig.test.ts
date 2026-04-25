import { jest } from "@jest/globals";

const openDatabase = jest.fn();

jest.unstable_mockModule("./openDatabase.js", () => ({
  openDatabase,
}));

jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { getAllConfig } = await import("./getAllConfig.js");
const { txPromise } = await import("../db/txPromise.js");

describe("getAllConfig", () => {
  it("reads all config entries via txPromise", async () => {
    const db: any = { name: "mock-db" };

    (openDatabase as any).mockResolvedValue(db);

    (txPromise as any).mockResolvedValue([{ key: "k", value: "v" }]);

    const result = await getAllConfig();

    expect(result).toEqual([{ key: "k", value: "v" }]);

    expect(txPromise).toHaveBeenCalledWith(
      db,
      "config",
      "readonly",
      expect.any(Function),
    );
  });
});
