import type { ToolDefinition } from "./types.js";

export const create_task: ToolDefinition = {
  name: "create_task",
  description:
    "Create a scheduled recurring task. The task will run automatically " +
    "on the specified schedule and send the result back to this group. " +
    "Uses cron expressions (minute hour day-of-month month day-of-week).",
  input_schema: {
    type: "object",
    properties: {
      schedule: {
        type: "string",
        description: 'Cron expression, e.g. "0 9 * * 1-5" for 9am weekdays',
      },
      prompt: {
        type: "string",
        description: "The prompt/instruction to execute on each run",
      },
    },
    required: ["schedule", "prompt"],
  },
};

export const list_tasks: ToolDefinition = {
  name: "list_tasks",
  description:
    "List all scheduled recurring tasks for this group. " +
    "Returns a list of tasks with their IDs, schedules, and prompts.",
  input_schema: {
    type: "object",
    properties: {},
  },
};

export const update_task: ToolDefinition = {
  name: "update_task",
  description: "Update an existing scheduled task's schedule or prompt.",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The unique ID of the task to update",
      },
      schedule: {
        type: "string",
        description: "New cron expression (optional)",
      },
      prompt: {
        type: "string",
        description: "New prompt/instruction (optional)",
      },
      enabled: {
        type: "boolean",
        description: "Whether the task is enabled (optional)",
      },
    },
    required: ["id"],
  },
};

export const delete_task: ToolDefinition = {
  name: "delete_task",
  description: "Delete a scheduled task by its ID.",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The unique ID of the task to delete",
      },
    },
    required: ["id"],
  },
};

export const enable_task: ToolDefinition = {
  name: "enable_task",
  description: "Enable a scheduled task so it runs on its schedule.",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The unique ID of the task to enable",
      },
    },
    required: ["id"],
  },
};

export const disable_task: ToolDefinition = {
  name: "disable_task",
  description: "Disable a scheduled task so it stops running.",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The unique ID of the task to disable",
      },
    },
    required: ["id"],
  },
};
