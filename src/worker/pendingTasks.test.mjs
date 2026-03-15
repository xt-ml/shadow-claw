import { pendingTasks } from "./pendingTasks.mjs";

describe("pendingTasks", () => {
  it("is a shared Map", () => {
    pendingTasks.set("g", () => {});

    expect(pendingTasks.has("g")).toBe(true);
    pendingTasks.clear();
  });
});
