import type { ToolDefinition } from "../../subsystems/tools/types.js";

export const activate_skill: ToolDefinition = {
  name: "activate_skill",
  description:
    "Load the full instructions for a workspace skill when its description matches the current task.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The exact skill name from the available skills catalog.",
      },
    },
    required: ["name"],
  },
};
