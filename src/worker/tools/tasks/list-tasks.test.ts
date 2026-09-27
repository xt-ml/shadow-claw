import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ShadowClawDatabase } from "../../../db/types.js";

const mockGetGroupTasks = jest.fn<() => Promise<unknown[]>>();

jest.unstable_mockModule("./tasks-utils.js", () => ({
  getGroupTasks: mockGetGroupTasks,
}));

const { executeListTasks } = await import("./list-tasks.js");

describe("executeListTasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns message when no tasks found", async () => {
    mockGetGroupTasks.mockResolvedValue([]);
    const result = await executeListTasks({} as ShadowClawDatabase, "group-1");
    expect(result).toBe("No tasks found for this group.");
  });

  it("returns formatted string of tasks", async () => {
    mockGetGroupTasks.mockResolvedValue([
      {
        id: "task-1",
        schedule: "* * * * *",
        type: "prompt",
        enabled: true,
        name: "Task 1",
        createdAt: 100,
      },
      { id: "task-2", schedule: "0 0 * * *", enabled: false, createdAt: 200 }, // test fallback
    ]);

    const result = await executeListTasks({} as ShadowClawDatabase, "group-1");

    expect(result).toContain(
      "[ID: task-1] Name: Task 1, Schedule: * * * * *, Type: prompt, Enabled: true",
    );
    expect(result).toContain(
      "[ID: task-2] Name: (none), Schedule: 0 0 * * *, Type: prompt, Enabled: false",
    );
  });

  it("sorts tasks by explicit order when orders differ", async () => {
    mockGetGroupTasks.mockResolvedValue([
      {
        id: "task-b",
        order: 2,
        schedule: "0 0 * * *",
        type: "tools",
        enabled: true,
        name: "Task B",
        createdAt: 100,
      },
      {
        id: "task-a",
        order: 1,
        schedule: "0 0 * * *",
        type: "tools",
        enabled: true,
        name: "Task A",
        createdAt: 200,
      },
    ]);

    const result = await executeListTasks({} as ShadowClawDatabase, "group-1");
    const lines = result.split("\n");
    expect(lines[0]).toContain("task-a");
    expect(lines[1]).toContain("task-b");
  });
});
