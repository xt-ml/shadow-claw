import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

jest.unstable_mockModule("./tasks-utils.js", () => ({
  getGroupTasks: jest.fn(),
}));

const { post } = await import("../../utils/post.js");
const { getGroupTasks } = await import("./tasks-utils.js");
const { executeEnableTask } = await import("./enable-task.js");

describe("executeEnableTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error if task not found", async () => {
    (getGroupTasks as jest.Mock<any>).mockResolvedValue([{ id: "task-2" }]);
    const result = await executeEnableTask(
      {} as any,
      { id: "task-1" },
      "group-1",
    );
    expect(result).toBe("Error: Task with ID task-1 not found.");
    expect(post).not.toHaveBeenCalled();
  });

  it("enables task successfully", async () => {
    const mockTask = { id: "task-1", enabled: false };
    (getGroupTasks as jest.Mock<any>).mockResolvedValue([mockTask]);

    const result = await executeEnableTask(
      {} as any,
      { id: "task-1" },
      "group-1",
    );

    expect(mockTask.enabled).toBe(true);
    expect(post).toHaveBeenCalledWith({
      type: "update-task",
      payload: { task: mockTask },
    });
    expect(result).toBe("Task task-1 enabled successfully.");
  });
});
