import { jest } from "@jest/globals";

jest.unstable_mockModule("./tasks-utils.js", () => ({
  getGroupTasks: jest.fn(),
}));

const { getGroupTasks } = await import("./tasks-utils.js");
const { executeListTasks } = await import("./list-tasks.js");

describe("executeListTasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns message when no tasks found", async () => {
    (getGroupTasks as jest.Mock<any>).mockResolvedValue([]);
    const result = await executeListTasks({} as any, "group-1");
    expect(result).toBe("No tasks found for this group.");
  });

  it("returns formatted string of tasks", async () => {
    (getGroupTasks as jest.Mock<any>).mockResolvedValue([
      { id: "task-1", schedule: "* * * * *", type: "prompt", enabled: true },
      { id: "task-2", schedule: "0 0 * * *", enabled: false }, // test fallback
    ]);

    const result = await executeListTasks({} as any, "group-1");

    expect(result).toContain(
      "[ID: task-1] Schedule: * * * * *, Type: prompt, Enabled: true",
    );
    expect(result).toContain(
      "[ID: task-2] Schedule: 0 0 * * *, Type: prompt, Enabled: false",
    );
  });
});
