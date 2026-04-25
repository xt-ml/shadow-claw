import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { deleteTask } = await import("./deleteTask.js");
const { txPromise } = await import("../db/txPromise.js");

describe("deleteTask", () => {
  it("calls txPromise with tasks store and readwrite mode", async () => {
    (txPromise as any).mockResolvedValue(undefined);

    await deleteTask({} as any, "task-1");

    expect(txPromise).toHaveBeenCalledWith(
      {},
      "tasks",
      "readwrite",
      expect.any(Function),
    );
  });

  it("deletes the provided task id", async () => {
    const store: any = { delete: jest.fn() };

    (txPromise as any).mockImplementation((_db, _store, _mode, callback) =>
      Promise.resolve(callback(store)),
    );

    await deleteTask({} as any, "task-2");

    expect(store.delete).toHaveBeenCalledWith("task-2");
  });

  it("rejects when id is undefined", async () => {
    await expect(deleteTask({} as any, undefined as any)).rejects.toThrow();
  });

  it("rejects when id is empty string", async () => {
    await expect(deleteTask({} as any, "")).rejects.toThrow();
  });
});
