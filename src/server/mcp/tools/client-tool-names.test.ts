import {
  formatClientToolName,
  getClientRawToolName,
  toClientExposedToolName,
} from "./client-tool-names.js";

describe("client-tool-names", () => {
  it("formats client tool name with target mode raw or exposed", () => {
    expect(formatClientToolName("shadowclaw_client_read_file", "raw")).toBe(
      "read_file",
    );
    expect(formatClientToolName("read_file", "exposed")).toBe(
      "shadowclaw_client_read_file",
    );
    expect(formatClientToolName(123 as any, "raw")).toBe(123);
  });

  it("strips MCP_CLIENT_TOOL_PREFIX in getClientRawToolName", () => {
    expect(getClientRawToolName("shadowclaw_client_read_file")).toBe(
      "read_file",
    );
    expect(getClientRawToolName("shadowclaw_client_bash")).toBe("bash");
    expect(getClientRawToolName("read_file")).toBe("read_file");
    expect(getClientRawToolName("")).toBe("");
  });

  it("adds MCP_CLIENT_TOOL_PREFIX in toClientExposedToolName", () => {
    expect(toClientExposedToolName("read_file")).toBe(
      "shadowclaw_client_read_file",
    );
    expect(toClientExposedToolName("shadowclaw_client_read_file")).toBe(
      "shadowclaw_client_read_file",
    );
    expect(toClientExposedToolName("")).toBe("shadowclaw_client_");
  });
});
