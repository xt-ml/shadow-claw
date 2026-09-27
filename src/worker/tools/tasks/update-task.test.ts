import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ShadowClawDatabase } from "../../../db/types.js";

interface TaskRecord {
  id: string;
  schedule?: string;
  type?: string;
  prompt?: string;
  tools?: string[];
  enabled?: boolean;
  name?: string;
}

const mockPost =
  jest.fn<(msg: { type: string; payload: { task: TaskRecord } }) => void>();
const mockGetGroupTasks = jest.fn<() => Promise<TaskRecord[]>>();

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: mockPost,
}));

jest.unstable_mockModule("./tasks-utils.js", () => ({
  getGroupTasks: mockGetGroupTasks,
}));

const { executeUpdateTask } = await import("./update-task.js");

describe("executeUpdateTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error if task not found", async () => {
    mockGetGroupTasks.mockResolvedValue([{ id: "task-2" }]);
    const result = await executeUpdateTask(
      {} as ShadowClawDatabase,
      { id: "task-1" },
      "group-1",
    );
    expect(result).toBe("Error: Task with ID task-1 not found.");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("updates all provided fields successfully", async () => {
    const mockTask: TaskRecord = {
      id: "task-1",
      schedule: "* * * * *",
      type: "prompt",
      prompt: "old prompt",
      tools: [],
      enabled: false,
      name: "old name",
    };
    mockGetGroupTasks.mockResolvedValue([mockTask]);

    const result = await executeUpdateTask(
      {} as ShadowClawDatabase,
      {
        id: "task-1",
        schedule: "0 0 * * *",
        type: "tools",
        prompt: "new prompt",
        tools: ["tool1"],
        enabled: true,
        name: "  new name  ",
      },
      "group-1",
    );

    expect(mockTask.schedule).toBe("0 0 * * *");
    expect(mockTask.type).toBe("tools");
    expect(mockTask.prompt).toBe("new prompt");
    expect(mockTask.tools).toEqual(["tool1"]);
    expect(mockTask.enabled).toBe(true);
    expect(mockTask.name).toBe("new name");

    expect(mockPost).toHaveBeenCalledWith({
      type: "update-task",
      payload: { task: mockTask },
    });
    expect(result).toBe("Task task-1 updated successfully.");
  });

  it("preserves unchanged fields when optional fields are omitted or type is prompt/invalid", async () => {
    const mockTask: TaskRecord = {
      id: "task-1",
      schedule: "original-schedule",
      type: "tools",
      prompt: "original-prompt",
      tools: ["t0"],
      enabled: true,
      name: "original-name",
    };
    mockGetGroupTasks.mockResolvedValue([mockTask]);

    // Update with type "prompt", tools not an array, non-string name
    const result = await executeUpdateTask(
      {} as ShadowClawDatabase,
      {
        id: "task-1",
        type: "prompt",
        name: null,
      },
      "group-1",
    );

    expect(mockTask.schedule).toBe("original-schedule");
    expect(mockTask.type).toBe("prompt");
    expect(mockTask.prompt).toBe("original-prompt");
    expect(mockTask.tools).toEqual(["t0"]);
    expect(mockTask.enabled).toBe(true);
    expect(mockTask.name).toBeUndefined();
    expect(result).toBe("Task task-1 updated successfully.");
  });

  it("ignores unknown type values", async () => {
    const mockTask: TaskRecord = {
      id: "task-1",
      type: "tools",
    };
    mockGetGroupTasks.mockResolvedValue([mockTask]);

    await executeUpdateTask(
      {} as ShadowClawDatabase,
      {
        id: "task-1",
        type: "unknown-type",
      },
      "group-1",
    );

    expect(mockTask.type).toBe("tools");
  });
});
