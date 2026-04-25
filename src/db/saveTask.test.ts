import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/txPromise.js", () => ({
  txPromise: jest.fn(),
}));

const { saveTask } = await import("./saveTask.js");
const { txPromise } = await import("../db/txPromise.js");

describe("saveTask", () => {
  it("stores enabled=true as 1", async () => {
    const store: any = { put: jest.fn() };

    (txPromise as any).mockImplementation(
      (_db: any, _store: any, _mode: any, callback: any) =>
        Promise.resolve(callback(store)),
    );

    await saveTask({} as any, { id: "1", enabled: true, prompt: "run" } as any);

    expect(store.put).toHaveBeenCalledWith({
      id: "1",
      enabled: 1,
      prompt: "run",
    });
  });

  it("stores enabled=false as 0", async () => {
    const store: any = { put: jest.fn() };

    (txPromise as any).mockImplementation(
      (_db: any, _store: any, _mode: any, callback: any) =>
        Promise.resolve(callback(store)),
    );

    await saveTask(
      {} as any,
      { id: "2", enabled: false, prompt: "run" } as any,
    );

    expect(store.put).toHaveBeenCalledWith({
      id: "2",
      enabled: 0,
      prompt: "run",
    });
  });
});
