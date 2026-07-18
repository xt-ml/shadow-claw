import type { RemoteMcpTool } from "../remote-mcp.js";

export function formatListToolsOutput(
  connectionId: string,
  tools: RemoteMcpTool[],
): string {
  if (!tools.length) {
    return `No tools exposed by remote MCP connection ${connectionId}.`;
  }

  return tools
    .map(
      (tool) =>
        `- ${tool.name}${tool.description ? `: ${tool.description}` : ""}`,
    )
    .join("\n");
}
