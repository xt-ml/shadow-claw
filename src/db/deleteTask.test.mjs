import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { deleteTask } = await import("./deleteTask.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("deleteTask", () => {
  it("calls txPromise with tasks store and readwrite mode", async () => {
    txPromise.mockResolvedValue(undefined);

    await deleteTask({}, "task-1");

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "tasks",
      "readwrite",
      expect.any(Function),
    );
  });

  it("deletes the provided task id", async () => {
    const store = { delete: jest.fn() };
    txPromise.mockImplementation((_db, _store, _mode, callback) =>
      Promise.resolve(callback(store)),
    );

    await deleteTask({}, "task-2");

    expect(store.delete).toHaveBeenCalledWith("task-2");
  });
});
