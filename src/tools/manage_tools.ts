import type { ToolDefinition } from "./types.js";

/**
 * manage_tools — Agent-driven tool management.
 *
 * Allows the agent to enable/disable tools or activate predefined tool profiles.
 * Note: Changes take effect on the NEXT message turn.
 */
export const manage_tools: ToolDefinition = {
  name: "manage_tools",
  description:
    "Enable or disable specific tools, or activate a predefined tool profile. " +
    "Use list_tool_profiles to see available profiles before activating one. " +
    "This helps optimize the context window and focus capabilities. " +
    "Changes take effect on the NEXT turn, not immediately within the current tool-use loop.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["enable", "disable", "activate_profile"],
        description: "The management action to perform.",
      },
      tool_names: {
        type: "array",
        items: { type: "string" },
        description:
          "List of tool names to enable or disable. Required for 'enable' and 'disable' actions.",
      },
      profile_id: {
        type: "string",
        description:
          "The unique ID of the tool profile to activate. Required for 'activate_profile' action.",
      },
    },
    required: ["action"],
  },
};

/**
 * list_tool_profiles — List available tool profiles.
 *
 * Returns a list of tool profiles that the agent can activate.
 */
export const list_tool_profiles: ToolDefinition = {
  name: "list_tool_profiles",
  description:
    "List all available tool profiles that can be activated using manage_tools. " +
    "Returns a list of profiles with their IDs, names, and the tools they contain.",
  input_schema: {
    type: "object",
    properties: {},
  },
};
