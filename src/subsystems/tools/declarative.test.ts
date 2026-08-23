import { describe, expect, it } from "@jest/globals";

import { parseDeclarativeTool } from "./declarative.js";

describe("parseDeclarativeTool", () => {
  it("parses a sandboxed javascript tool definition", () => {
    expect(
      parseDeclarativeTool("tools/main/echo.json", {
        name: "echo",
        description: "Echo structured input.",
        input_schema: {
          type: "object",
          properties: { value: { type: "string" } },
          required: ["value"],
        },
        execution: {
          type: "javascript",
          code: "return JSON.parse(data).value;",
        },
      }),
    ).toEqual({
      name: "echo",
      description: "Echo structured input.",
      input_schema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
      },
      execution: {
        type: "javascript",
        code: "return JSON.parse(data).value;",
      },
      path: "tools/main/echo.json",
    });
  });

  it("rejects tools without a sandbox execution recipe", () => {
    expect(() =>
      parseDeclarativeTool("tools/main/echo.json", {
        name: "echo",
        description: "Echo structured input.",
        input_schema: { type: "object" },
      }),
    ).toThrow("execution");
  });

  it("parses a tool executor that delegates to an existing tool", () => {
    expect(
      parseDeclarativeTool("tools/main/repo_status.json", {
        name: "repo_status",
        description: "Show repository status.",
        input_schema: { type: "object" },
        execution: { type: "tool", name: "git_status" },
      }).execution,
    ).toEqual({ type: "tool", name: "git_status" });
  });
});
