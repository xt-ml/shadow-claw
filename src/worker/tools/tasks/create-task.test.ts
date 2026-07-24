import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../utils/ulid.js", () => ({
  ulid: jest.fn(() => "mock-ulid"),
}));

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { post } = await import("../../utils/post.js");
const { executeCreateTask } = await import("./create-task.js");

describe("executeCreateTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-24T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns error if schedule is missing", () => {
    const result = executeCreateTask(
      { type: "prompt", prompt: "test" },
      "group-1",
    );
    expect(result).toBe(
      "Error: Missing or invalid 'schedule' (cron expression) for create_task.",
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("returns error if type is prompt and prompt is missing", () => {
    const result = executeCreateTask({ schedule: "* * * * *" }, "group-1");
    expect(result).toBe(
      "Error: Missing or invalid 'prompt' for create_task with type 'prompt'.",
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("creates a tools task successfully", () => {
    const result = executeCreateTask(
      {
        schedule: "* * * * *",
        type: "tools",
        tools: ["tool1", "tool2"],
      },
      "group-1",
    );

    expect(post).toHaveBeenCalledWith({
      type: "task-created",
      payload: {
        task: {
          createdAt: Date.now(),
          enabled: true,
          groupId: "group-1",
          id: "mock-ulid",
          lastRun: null,
          prompt: "",
          schedule: "* * * * *",
          tools: ["tool1", "tool2"],
          type: "tools",
        },
      },
    });

    expect(result).toContain("Task created successfully");
    expect(result).toContain("ID: mock-ulid");
  });

  it("creates a prompt task successfully", () => {
    const result = executeCreateTask(
      {
        schedule: "0 0 * * *",
        type: "prompt",
        prompt: " Hello World ",
      },
      "group-1",
    );

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task-created",
        payload: expect.objectContaining({
          task: expect.objectContaining({
            prompt: "Hello World",
            schedule: "0 0 * * *",
            type: "prompt",
          }),
        }),
      }),
    );

    expect(result).toContain("Task created successfully");
  });
});
