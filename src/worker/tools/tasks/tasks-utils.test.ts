import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../db/getAllTasks.js", () => ({
  getAllTasks: jest.fn(),
}));

const { getGroupTasks } = await import("./tasks-utils.js");
const { getAllTasks } = await import("../../../db/getAllTasks.js");

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
});
