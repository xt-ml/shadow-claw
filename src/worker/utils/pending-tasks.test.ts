import { pendingTasks } from "./pending-tasks.js";

describe("pendingTasks", () => {
  it("is a shared Map", () => {
    pendingTasks.set("g", () => {});

    expect(pendingTasks.has("g")).toBe(true);
    pendingTasks.clear();
  });
});
