import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { getAllTasks } = await import("./getAllTasks.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("getAllTasks", () => {
  it("normalizes enabled to boolean values", async () => {
    txPromise.mockResolvedValue([
      { id: "1", enabled: 1 },
      { id: "2", enabled: 0 },
      { id: "3" },
    ]);

    const tasks = await getAllTasks({});

    expect(tasks).toEqual([
      { id: "1", enabled: true },
      { id: "2", enabled: false },
      { id: "3", enabled: false },
    ]);
  });

  it("reads from tasks store in readonly mode", async () => {
    const store = {
      getAll: jest.fn().mockReturnValue([{ id: "1", enabled: 1 }]),
    };
    txPromise.mockImplementation((_db, _store, _mode, callback) =>
      Promise.resolve(callback(store)),
    );

    await getAllTasks({});

    expect(store.getAll).toHaveBeenCalled();
    expect(txPromise).toHaveBeenCalledWith(
      {},
      "tasks",
      "readonly",
      expect.any(Function),
    );
  });
});
