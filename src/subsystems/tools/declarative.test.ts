import { describe, expect, it } from "@jest/globals";

import { parseDeclarativeTool } from "./declarative.js";

describe("parseDeclarativeTool", () => {
  it("parses a sandboxed javascript tool definition", () => {
    expect(
      parseDeclarativeTool(".agents/tools/main/echo.json", {
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
      path: ".agents/tools/main/echo.json",
    });
  });

  it("rejects tools without a sandbox execution recipe", () => {
    expect(() =>
      parseDeclarativeTool(".agents/tools/main/echo.json", {
        name: "echo",
        description: "Echo structured input.",
        input_schema: { type: "object" },
      }),
    ).toThrow("execution");
  });

  it("parses a tool executor that delegates to an existing tool", () => {
    expect(
      parseDeclarativeTool(".agents/tools/main/repo_status.json", {
        name: "repo_status",
        description: "Show repository status.",
        input_schema: { type: "object" },
        execution: { type: "tool", name: "git_status" },
      }).execution,
    ).toEqual({ type: "tool", name: "git_status" });
  });

  it("parses generate_random_number declarative tool definition", () => {
    const raw = {
      name: "generate_random_number",
      description:
        "Generate a random integer within a specified range (min through max, inclusive).",
      input_schema: {
        type: "object",
        properties: {
          min: { type: "number", description: "Minimum integer value" },
          max: { type: "number", description: "Maximum integer value" },
        },
      },
      execution: {
        type: "javascript",
        code: "const input = data ? JSON.parse(data) : {}; const min = typeof input.min === 'number' ? input.min : 1; const max = typeof input.max === 'number' ? input.max : 1000000; return Math.floor(Math.random() * (max - min + 1)) + min;",
      },
    };

    expect(
      parseDeclarativeTool(
        ".agents/tools/main/generate_random_number.json",
        raw,
      ),
    ).toEqual({
      ...raw,
      path: ".agents/tools/main/generate_random_number.json",
    });
  });

  it("parses tools using parameters and evaluation expression aliases", () => {
    const raw = {
      name: "calculate_ore_depth",
      description: "Calculates ore depth.",
      parameters: {
        type: "object",
        properties: { y: { type: "number" } },
      },
      evaluation: {
        type: "javascript",
        expression: "return { y: data ? JSON.parse(data).y : 0 };",
      },
    };

    expect(
      parseDeclarativeTool(".agents/tools/main/calculate_ore_depth.json", raw),
    ).toEqual({
      name: "calculate_ore_depth",
      description: "Calculates ore depth.",
      input_schema: {
        type: "object",
        properties: { y: { type: "number" } },
      },
      execution: {
        type: "javascript",
        code: "return { y: data ? JSON.parse(data).y : 0 };",
      },
      path: ".agents/tools/main/calculate_ore_depth.json",
    });
  });
});
