import type { ToolDefinition } from "./types.js";

export const remote_mcp_list_tools: ToolDefinition = {
  name: "remote_mcp_list_tools",
  description:
    "List available tools from a configured Remote MCP connection by connection ID or label.",
  input_schema: {
    type: "object",
    properties: {
      connection_id: {
        type: "string",
        description: "Remote MCP connection ID or label",
      },
    },
    required: ["connection_id"],
  },
};

export const remote_mcp_call_tool: ToolDefinition = {
  name: "remote_mcp_call_tool",
  description: "Call a tool exposed by a configured Remote MCP connection.",
  input_schema: {
    type: "object",
    properties: {
      connection_id: {
        type: "string",
        description: "Remote MCP connection ID or label",
      },
      tool_name: {
        type: "string",
        description: "Remote MCP tool name",
      },
      arguments: {
        type: "object",
        description: "Arguments object passed to the remote MCP tool",
      },
    },
    required: ["connection_id", "tool_name"],
  },
};
