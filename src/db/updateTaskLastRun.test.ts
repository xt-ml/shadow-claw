import { jest } from "@jest/globals";

jest.unstable_mockModule("./db.js", () => ({
  getDb: jest.fn(),
}));

const { updateTaskLastRun } = await import("./updateTaskLastRun.js");
const { getDb } = await import("./db.js");

describe("updateTaskLastRun", () => {
  it("updates and saves task when found", async () => {
    const getReq: any = {};
    const putReq: any = {};
    const store: any = {
      get: jest.fn(() => getReq),
      put: jest.fn(() => putReq),
    };

    (getDb as any).mockReturnValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => store) })),
    });

    const pending = updateTaskLastRun("t1", 1234);
    await Promise.resolve(); // Allow updateTaskLastRun to attach handlers

    getReq.result = { id: "t1", lastRun: null };

    getReq.onsuccess();

    putReq.onsuccess();

    await expect(pending).resolves.toBeUndefined();

    expect(store.put).toHaveBeenCalledWith({ id: "t1", lastRun: 1234 });
  });

  it("resolves when task does not exist", async () => {
    const getReq: any = {};
    const store: any = {
      get: jest.fn(() => getReq),
      put: jest.fn(),
    };

    (getDb as any).mockReturnValue({
      transaction: jest.fn(() => ({ objectStore: jest.fn(() => store) })),
    });

    const pending = updateTaskLastRun("missing", 5);
    await Promise.resolve(); // Allow updateTaskLastRun to attach handlers

    getReq.result = undefined;

    getReq.onsuccess();

    await expect(pending).resolves.toBeUndefined();

    expect(store.put).not.toHaveBeenCalled();
  });
});
