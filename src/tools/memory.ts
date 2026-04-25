import type { ToolDefinition } from "./types.js";

export const update_memory: ToolDefinition = {
  name: "update_memory",
  description:
    "Update the MEMORY.md memory file for this group. " +
    "Use this to persist important context, user preferences, project state, " +
    "and anything the agent should remember across conversations. " +
    "This file is loaded as system context on every invocation.",
  input_schema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "New content for the MEMORY.md memory file",
      },
    },
    required: ["content"],
  },
};
