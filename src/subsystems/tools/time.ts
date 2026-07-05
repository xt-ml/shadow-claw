import type { ToolDefinition } from "./types.js";

export const get_current_time: ToolDefinition = {
  name: "get_current_time",
  description:
    "Get the current date and time. " +
    "Returns an ISO 8601 string representing the current date and time. " +
    "Use this tool whenever you need to know the current time, instead of relying on shell tools which may be unavailable.",
  input_schema: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "Optional timezone to format the time in (e.g. 'America/New_York'). If omitted, returns UTC.",
      },
    },
  },
};
