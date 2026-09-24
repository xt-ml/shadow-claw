import { jest } from "@jest/globals";

jest.unstable_mockModule("../../subsystems/tools/declarative.js", () => ({
  findDeclarativeTool: jest.fn(),
}));

jest.unstable_mockModule("../tools/bash/bash.js", () => ({
  executeBash: jest.fn(),
}));

jest.unstable_mockModule("../tools/ui/javascript.js", () => ({
  executeJavascript: jest.fn(),
}));

import type { ExecuteToolDelegate } from "./declarativeToolExecutor.js";

const { executeDeclarativeTool } = await import("./declarativeToolExecutor.js");
const { findDeclarativeTool } =
  await import("../../subsystems/tools/declarative.js");
const { executeBash } = await import("../tools/bash/bash.js");
const { executeJavascript } = await import("../tools/ui/javascript.js");

describe("declarativeToolExecutor", () => {
  const mockDb = {} as any;
  const mockGroupId = "grp-1";
  const mockDelegate = jest.fn<ExecuteToolDelegate>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns unknown tool error when tool is not found", async () => {
    (findDeclarativeTool as jest.Mock<any>).mockResolvedValue(null);
    const result = await executeDeclarativeTool(
      mockDb,
      "unknown_tool",
      {},
      mockGroupId,
      {},
      mockDelegate as any,
    );
    expect(result).toBe("Unknown tool: unknown_tool");
  });

  it("returns error when declarativeDepth >= 8", async () => {
    (findDeclarativeTool as jest.Mock<any>).mockResolvedValue({
      execution: { type: "tool", name: "other" },
    });
    const result = await executeDeclarativeTool(
      mockDb,
      "my_tool",
      {},
      mockGroupId,
      { declarativeDepth: 8 },
      mockDelegate as any,
    );
    expect(result).toBe(
      "Tool error (my_tool): declarative tool nesting limit exceeded.",
    );
  });

  it("delegates to delegate function when execution.type is tool", async () => {
    (findDeclarativeTool as jest.Mock<any>).mockResolvedValue({
      execution: { type: "tool", name: "target_tool", input: { extra: 123 } },
    });
    mockDelegate.mockResolvedValue("tool result");

    const result = await executeDeclarativeTool(
      mockDb,
      "my_tool",
      { a: "b" },
      mockGroupId,
      { declarativeDepth: 2 },
      mockDelegate as any,
    );
    expect(result).toBe("tool result");
    expect(mockDelegate).toHaveBeenCalledWith(
      mockDb,
      "target_tool",
      { a: "b", extra: 123 },
      mockGroupId,
      { declarativeDepth: 3 },
    );
  });

  it("returns error if declarative tool target name is missing", async () => {
    (findDeclarativeTool as jest.Mock<any>).mockResolvedValue({
      execution: { type: "tool" },
    });
    const result = await executeDeclarativeTool(
      mockDb,
      "my_tool",
      {},
      mockGroupId,
      {},
      mockDelegate as any,
    );
    expect(result).toBe(
      "Tool error (my_tool): declarative tool target is missing.",
    );
  });

  it("executes bash when execution.type is bash", async () => {
    (findDeclarativeTool as jest.Mock<any>).mockResolvedValue({
      execution: { type: "bash", command: "echo hi" },
    });
    (executeBash as jest.Mock<any>).mockResolvedValue("hi\n");

    const result = await executeDeclarativeTool(
      mockDb,
      "my_tool",
      { foo: "bar" },
      mockGroupId,
      {},
      mockDelegate as any,
    );
    expect(result).toBe("hi\n");
    expect(executeBash).toHaveBeenCalledWith(
      mockDb,
      { command: "echo hi", stdin: JSON.stringify({ foo: "bar" }) },
      mockGroupId,
    );
  });

  it("executes javascript when execution.type is javascript", async () => {
    (findDeclarativeTool as jest.Mock<any>).mockResolvedValue({
      execution: { type: "javascript", code: "return 42;" },
    });
    (executeJavascript as jest.Mock<any>).mockResolvedValue("42");

    const result = await executeDeclarativeTool(
      mockDb,
      "my_tool",
      { foo: "bar" },
      mockGroupId,
      {},
      mockDelegate as any,
    );
    expect(result).toBe("42");
    expect(executeJavascript).toHaveBeenCalledWith(mockDb, {
      code: "return 42;",
      data: JSON.stringify({ foo: "bar" }),
    });
  });
});
