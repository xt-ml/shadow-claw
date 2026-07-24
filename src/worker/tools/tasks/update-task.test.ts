import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

jest.unstable_mockModule("./tasks-utils.js", () => ({
  getGroupTasks: jest.fn(),
}));

const { post } = await import("../../utils/post.js");
const { getGroupTasks } = await import("./tasks-utils.js");
const { executeUpdateTask } = await import("./update-task.js");

describe("executeUpdateTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error if task not found", async () => {
    (getGroupTasks as jest.Mock<any>).mockResolvedValue([{ id: "task-2" }]);
    const result = await executeUpdateTask(
      {} as any,
      { id: "task-1" },
      "group-1",
    );
    expect(result).toBe("Error: Task with ID task-1 not found.");
    expect(post).not.toHaveBeenCalled();
  });

  it("updates task successfully", async () => {
    const mockTask = {
      id: "task-1",
      schedule: "* * * * *",
      type: "prompt",
      prompt: "old prompt",
      tools: [],
      enabled: false,
    };
    (getGroupTasks as jest.Mock<any>).mockResolvedValue([mockTask]);

    const result = await executeUpdateTask(
      {} as any,
      {
        id: "task-1",
        schedule: "0 0 * * *",
        type: "tools",
        prompt: "new prompt",
        tools: ["tool1"],
        enabled: true,
      },
      "group-1",
    );

    expect(mockTask.schedule).toBe("0 0 * * *");
    expect(mockTask.type).toBe("tools");
    expect(mockTask.prompt).toBe("new prompt");
    expect(mockTask.tools).toEqual(["tool1"]);
    expect(mockTask.enabled).toBe(true);

    expect(post).toHaveBeenCalledWith({
      type: "update-task",
      payload: { task: mockTask },
    });
    expect(result).toBe("Task task-1 updated successfully.");
  });
});
