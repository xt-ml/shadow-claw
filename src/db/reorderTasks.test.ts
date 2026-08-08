import { jest } from "@jest/globals";

jest.unstable_mockModule("./getAllTasks.js", () => ({
  getAllTasks: jest.fn(),
}));

jest.unstable_mockModule("./saveTask.js", () => ({
  saveTask: jest.fn(),
}));

const { reorderTasks } = await import("./reorderTasks.js");
const { getAllTasks } = await import("./getAllTasks.js");
const { saveTask } = await import("./saveTask.js");

describe("reorderTasks", () => {
  it("assigns sequential orders to tasks based on orderedIds list", async () => {
    const mockTasks = [
      { id: "task-1", groupId: "group-a", createdAt: 100, enabled: true },
      { id: "task-2", groupId: "group-a", createdAt: 101, enabled: true },
      { id: "task-3", groupId: "group-b", createdAt: 102, enabled: true },
    ];

    (getAllTasks as any).mockResolvedValue(mockTasks);
    (saveTask as any).mockResolvedValue(undefined);

    const updated = await reorderTasks({} as any, "group-a", [
      "task-2",
      "task-1",
    ]);

    expect(updated).toEqual([
      {
        id: "task-2",
        groupId: "group-a",
        createdAt: 101,
        enabled: true,
        order: 0,
      },
      {
        id: "task-1",
        groupId: "group-a",
        createdAt: 100,
        enabled: true,
        order: 1,
      },
    ]);

    expect(saveTask).toHaveBeenCalledTimes(2);
    expect(saveTask).toHaveBeenNthCalledWith(1, {} as any, {
      id: "task-2",
      groupId: "group-a",
      createdAt: 101,
      enabled: true,
      order: 0,
    });
    expect(saveTask).toHaveBeenNthCalledWith(2, {} as any, {
      id: "task-1",
      groupId: "group-a",
      createdAt: 100,
      enabled: true,
      order: 1,
    });
  });

  it("handles tasks that are not present in orderedIds list", async () => {
    const mockTasks = [
      { id: "task-1", groupId: "group-a", createdAt: 100, enabled: true },
      { id: "task-2", groupId: "group-a", createdAt: 101, enabled: true },
      { id: "task-3", groupId: "group-a", createdAt: 102, enabled: true },
    ];

    (getAllTasks as any).mockResolvedValue(mockTasks);
    (saveTask as any).mockResolvedValue(undefined);

    const updated = await reorderTasks({} as any, "group-a", ["task-3"]);

    expect(updated).toEqual([
      {
        id: "task-3",
        groupId: "group-a",
        createdAt: 102,
        enabled: true,
        order: 0,
      },
      {
        id: "task-1",
        groupId: "group-a",
        createdAt: 100,
        enabled: true,
        order: 1,
      },
      {
        id: "task-2",
        groupId: "group-a",
        createdAt: 101,
        enabled: true,
        order: 2,
      },
    ]);
  });
});
