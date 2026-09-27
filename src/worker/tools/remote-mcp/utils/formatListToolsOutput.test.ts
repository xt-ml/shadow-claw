import { describe, expect, it } from "@jest/globals";
import { formatListToolsOutput } from "./formatListToolsOutput.js";
import type { RemoteMcpTool } from "../remote-mcp.js";

describe("formatListToolsOutput", () => {
  it("returns message when tools list is empty", () => {
    const output = formatListToolsOutput("conn-1", []);
    expect(output).toBe("No tools exposed by remote MCP connection conn-1.");
  });

  it("formats tools with and without descriptions", () => {
    const tools: RemoteMcpTool[] = [
      { name: "read_file", description: "Reads file content" },
      { name: "no_desc_tool" },
    ];
    const output = formatListToolsOutput("conn-2", tools);
    expect(output).toBe("- read_file: Reads file content\n- no_desc_tool");
  });
});
