import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { post } = await import("../../utils/post.js");
const { executeDeleteTask } = await import("./delete-task.js");

describe("executeDeleteTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error if id is missing", () => {
    const result = executeDeleteTask({}, "group-1");
    expect(result).toBe("Error: Missing required task ID for deletion.");
    expect(post).not.toHaveBeenCalled();
  });

  it("deletes a task successfully", () => {
    const result = executeDeleteTask({ id: "task-1" }, "group-1");

    expect(post).toHaveBeenCalledWith({
      type: "delete-task",
      payload: { id: "task-1", groupId: "group-1" },
    });

    expect(result).toBe("Task task-1 deleted successfully.");
  });
});
