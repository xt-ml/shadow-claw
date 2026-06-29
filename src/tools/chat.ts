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

export const ask_user: ToolDefinition = {
  name: "ask_user",
  description:
    "Pause execution to ask the user a question or request confirmation. " +
    "This halts the agent's work until the user provides an answer. " +
    "Use this for human-in-the-loop checkpoints before taking destructive actions " +
    "or when you need clarification to proceed.",
  input_schema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description:
          "The question or confirmation message to present to the user.",
      },
      options: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional list of predefined choices for the user to select from.",
      },
    },
    required: ["question"],
  },
};
