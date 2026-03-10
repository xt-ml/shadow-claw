import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.mjs", () => ({
  txPromise: jest.fn(),
}));

const { saveTask } = await import("./saveTask.mjs");
const { txPromise } = await import("../db/txPromise.mjs");

describe("saveTask", () => {
  it("stores enabled=true as 1", async () => {
    const store = { put: jest.fn() };
    txPromise.mockImplementation((_db, _store, _mode, callback) =>
      Promise.resolve(callback(store)),
    );

    await saveTask({}, { id: "1", enabled: true, prompt: "run" });

    expect(store.put).toHaveBeenCalledWith({
      id: "1",
      enabled: 1,
      prompt: "run",
    });
  });

  it("stores enabled=false as 0", async () => {
    const store = { put: jest.fn() };
    txPromise.mockImplementation((_db, _store, _mode, callback) =>
      Promise.resolve(callback(store)),
    );

    await saveTask({}, { id: "2", enabled: false, prompt: "run" });

    expect(store.put).toHaveBeenCalledWith({
      id: "2",
      enabled: 0,
      prompt: "run",
    });
  });
});
