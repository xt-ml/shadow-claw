import type { ToolDefinition } from "./types.js";

export const clear_chat: ToolDefinition = {
  name: "clear_chat",
  description:
    "Clear the current chat history and start a new session. " +
    "Useful for scheduled tasks to prevent context from growing indefinitely.",
  input_schema: {
    type: "object",
    properties: {},
  },
};
