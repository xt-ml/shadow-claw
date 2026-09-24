import { MCP_CLIENT_TOOL_PREFIX } from "../types.js";

export function formatClientToolName(
  name: string,
  target: "raw" | "exposed",
): string {
  if (typeof name !== "string") {
    return name;
  }

  if (target === "raw") {
    return name.startsWith(MCP_CLIENT_TOOL_PREFIX)
      ? name.slice(MCP_CLIENT_TOOL_PREFIX.length)
      : name;
  }

  return !name.startsWith(MCP_CLIENT_TOOL_PREFIX)
    ? `${MCP_CLIENT_TOOL_PREFIX}${name}`
    : name;
}

export function getClientRawToolName(name: string): string {
  return formatClientToolName(name, "raw");
}

export function toClientExposedToolName(name: string): string {
  return formatClientToolName(name, "exposed");
}
