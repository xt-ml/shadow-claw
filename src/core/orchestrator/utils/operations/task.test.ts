import { shouldStartLocalScheduler } from "./task.js";

describe("task operations", () => {
  it("shouldStartLocalScheduler returns true if serviceWorker missing", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { serviceWorker: undefined },
      configurable: true,
    });
    expect(await shouldStartLocalScheduler()).toBe(true);
  });
});
