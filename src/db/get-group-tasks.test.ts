import { jest } from "@jest/globals";

jest.unstable_mockModule("./get-all-tasks.js", () => ({
  getAllTasks: jest.fn(),
}));

const { getGroupTasks } = await import("./get-group-tasks.js");
const { getAllTasks } = await import("./get-all-tasks.js");

describe("getGroupTasks", () => {
  it("filters tasks by groupId", async () => {
    (getAllTasks as jest.Mock<any>).mockResolvedValue([
      { id: "task-1", groupId: "group-a", title: "Task 1" },
      { id: "task-2", groupId: "group-b", title: "Task 2" },
      { id: "task-3", groupId: "group-a", title: "Task 3" },
    ]);

    const result = await getGroupTasks({} as any, "group-a");
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["task-1", "task-3"]);
  });

  it("returns an empty array when no tasks match groupId", async () => {
    (getAllTasks as jest.Mock<any>).mockResolvedValue([
      { id: "task-1", groupId: "group-a", title: "Task 1" },
    ]);

    const result = await getGroupTasks({} as any, "group-z");
    expect(result).toEqual([]);
  });
});
