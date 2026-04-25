import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { getAllTasks } = await import("./getAllTasks.js");
const { txPromise } = await import("../db/txPromise.js");

describe("getAllTasks", () => {
  it("normalizes enabled to boolean values", async () => {
    (txPromise as any).mockResolvedValue([
      { id: "1", enabled: 1 },
      { id: "2", enabled: 0 },
      { id: "3" },
    ]);

    const tasks = await getAllTasks({} as any);

    expect(tasks).toEqual([
      { id: "1", enabled: true },
      { id: "2", enabled: false },
      { id: "3", enabled: false },
    ]);
  });

  it("reads from tasks store in readonly mode", async () => {
    const store: any = {
      getAll: jest.fn().mockReturnValue([{ id: "1", enabled: 1 }]),
    };

    (txPromise as any).mockImplementation((_db, _store, _mode, callback) =>
      Promise.resolve(callback(store)),
    );

    await getAllTasks({} as any);

    expect(store.getAll).toHaveBeenCalled();

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "tasks",
      "readonly",
      expect.any(Function),
    );
  });
});
