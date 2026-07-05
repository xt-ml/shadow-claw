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
        description:
          "The prompt/instruction to execute on each run (used if type is 'prompt')",
      },
      type: {
        type: "string",
        enum: ["prompt", "tools"],
        description: "The type of task to create. Defaults to 'prompt'.",
      },
      tools: {
        type: "array",
        description:
          "A list of tools to execute sequentially (used if type is 'tools')",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            input: { type: "object" },
          },
          required: ["name", "input"],
        },
      },
    },
    required: ["prompt", "type"],
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
        description:
          "Standard cron expression (e.g. '0 9 * * *'). Leave empty for an unscheduled task.",
      },
      prompt: {
        type: "string",
        description: "New prompt/instruction (optional)",
      },
      type: {
        type: "string",
        enum: ["prompt", "tools"],
        description: "New task type (optional)",
      },
      tools: {
        type: "array",
        description: "New list of tools (optional)",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            input: { type: "object" },
          },
          required: ["name", "input"],
        },
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

export const run_task: ToolDefinition = {
  name: "run_task",
  description:
    "Immediately trigger a scheduled task by its ID, outside of its normal cron schedule. " +
    "Use this to manually fire a task on demand. " +
    "Use list_tasks to find the task ID first.",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The unique ID of the task to run immediately",
      },
    },
    required: ["id"],
  },
};
