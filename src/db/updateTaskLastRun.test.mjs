import { jest } from "@jest/globals";

jest.unstable_mockModule("./db.mjs", () => ({
  getDb: jest.fn(),
}));

const { updateTaskLastRun } = await import("./updateTaskLastRun.mjs");
const { getDb } = await import("./db.mjs");

describe("updateTaskLastRun", () => {
  it("updates and saves task when found", async () => {
    const getReq = {};
    const putReq = {};
    const store = {
      get: jest.fn(() => getReq),
      put: jest.fn(() => putReq),
    };

    getDb.mockReturnValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => store) })),
    });

    const pending = updateTaskLastRun("t1", 1234);
    getReq.result = { id: "t1", lastRun: null };
    getReq.onsuccess();
    putReq.onsuccess();

    await expect(pending).resolves.toBeUndefined();

    expect(store.put).toHaveBeenCalledWith({ id: "t1", lastRun: 1234 });
  });

  it("resolves when task does not exist", async () => {
    const getReq = {};
    const store = {
      get: jest.fn(() => getReq),
      put: jest.fn(),
    };

    getDb.mockReturnValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => store) })),
    });

    const pending = updateTaskLastRun("missing", 5);
    getReq.result = undefined;
    getReq.onsuccess();

    await expect(pending).resolves.toBeUndefined();

    expect(store.put).not.toHaveBeenCalled();
  });
});
