import { describe, expect, it, jest, beforeEach } from "@jest/globals";

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn(),
}));

jest.unstable_mockModule("../../storage/getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("../../storage/readGroupFile.js", () => ({
  readGroupFile: jest.fn(),
}));

const { parseDeclarativeTool, loadDeclarativeTools, findDeclarativeTool } =
  await import("./declarative.js");
const { getConfig } = await import("../../db/getConfig.js");
const { getGroupDir } = await import("../../storage/getGroupDir.js");
const { readGroupFile } = await import("../../storage/readGroupFile.js");

describe("declarative tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

    it("parses a bash tool definition", () => {
      const tool = parseDeclarativeTool(".agents/tools/main/run_sh.json", {
        name: "run_sh",
        description: "Run bash command.",
        input_schema: { type: "object" },
        execution: {
          type: "bash",
          command: "echo hello",
        },
      });

      expect(tool.execution).toEqual({
        type: "bash",
        command: "echo hello",
      });
    });

    it("parses a tool executor that delegates to an existing tool with inputs", () => {
      const tool = parseDeclarativeTool(".agents/tools/main/repo_status.json", {
        name: "repo_status",
        description: "Show repository status.",
        input_schema: { type: "object" },
        execution: {
          type: "tool",
          name: "git_status",
          input: { verbose: true },
        },
      });

      expect(tool.execution).toEqual({
        type: "tool",
        name: "git_status",
        input: { verbose: true },
      });
    });

    it("rejects invalid value shapes", () => {
      expect(() => parseDeclarativeTool("test.json", null)).toThrow(
        "must be a JSON object",
      );
      expect(() => parseDeclarativeTool("test.json", "string")).toThrow(
        "must be a JSON object",
      );
    });

    it("rejects invalid tool names", () => {
      expect(() =>
        parseDeclarativeTool("test.json", {
          name: "Invalid-Name!",
          description: "desc",
          input_schema: {},
          execution: {},
        }),
      ).toThrow("Tool name is invalid");

      expect(() =>
        parseDeclarativeTool("test.json", {
          name: "",
          description: "desc",
          input_schema: {},
          execution: {},
        }),
      ).toThrow("Tool name is invalid");
    });

    it("rejects missing description or input schema", () => {
      expect(() =>
        parseDeclarativeTool("test.json", {
          name: "valid_name",
          description: "",
          input_schema: {},
          execution: {},
        }),
      ).toThrow("requires a description");

      expect(() =>
        parseDeclarativeTool("test.json", {
          name: "valid_name",
          description: "desc",
          input_schema: null,
          execution: {},
        }),
      ).toThrow("requires input_schema");
    });

    it("rejects invalid execution specifications", () => {
      expect(() =>
        parseDeclarativeTool("test.json", {
          name: "valid_name",
          description: "desc",
          input_schema: { type: "object" },
          execution: null,
        }),
      ).toThrow("requires execution");

      expect(() =>
        parseDeclarativeTool("test.json", {
          name: "valid_name",
          description: "desc",
          input_schema: { type: "object" },
          execution: { type: "unsupported" },
        }),
      ).toThrow("execution type must be bash, javascript, or tool");

      expect(() =>
        parseDeclarativeTool("test.json", {
          name: "valid_name",
          description: "desc",
          input_schema: { type: "object" },
          execution: { type: "tool", name: "INVALID-DELEGATE!" },
        }),
      ).toThrow("execution requires a valid tool name");

      expect(() =>
        parseDeclarativeTool("test.json", {
          name: "valid_name",
          description: "desc",
          input_schema: { type: "object" },
          execution: { type: "bash", command: "   " },
        }),
      ).toThrow("execution requires command");
    });
  });

  describe("loadDeclarativeTools & findDeclarativeTool", () => {
    it("loads declarative tools from directory tree", async () => {
      const mockFileHandle = { kind: "file" };
      const mockToolsDir = {
        entries: async function* () {
          yield ["calc.json", mockFileHandle];
          yield ["invalid.json", mockFileHandle];
        },
      };
      const mockAgentsDir = {
        getDirectoryHandle: jest.fn().mockImplementation(async (name) => {
          if (name === "tools") return mockToolsDir;
          throw new Error("Not found");
        }),
      };
      const mockRoot = {
        getDirectoryHandle: jest.fn().mockImplementation(async (name) => {
          if (name === ".agents") return mockAgentsDir;
          throw new Error("Not found");
        }),
      };

      (getGroupDir as jest.Mock<any>).mockResolvedValue(mockRoot);
      (readGroupFile as jest.Mock<any>).mockImplementation(
        async (_db: any, _gid: any, path: any) => {
          if (path === ".agents/tools/calc.json") {
            return JSON.stringify({
              name: "calc",
              description: "Calculate value",
              input_schema: { type: "object" },
              execution: { type: "javascript", code: "return 1;" },
            });
          }
          return "{ invalid json }";
        },
      );

      const { tools, diagnostics } = await loadDeclarativeTools({} as any);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("calc");
      expect(diagnostics).toHaveLength(1);
    });

    it("returns empty tools when agents directory does not exist", async () => {
      (getGroupDir as jest.Mock<any>).mockResolvedValue({
        getDirectoryHandle: (jest.fn() as any).mockRejectedValue(
          new Error("No .agents dir"),
        ),
      });

      const { tools, diagnostics } = await loadDeclarativeTools({} as any);
      expect(tools).toEqual([]);
      expect(diagnostics).toEqual([]);
    });

    it("finds declarative tool by name when enabled", async () => {
      const mockFileHandle = { kind: "file" };
      const mockToolsDir = {
        entries: async function* () {
          yield ["my_tool.json", mockFileHandle];
        },
      };
      const mockAgentsDir = {
        getDirectoryHandle: (jest.fn() as any).mockResolvedValue(mockToolsDir),
      };
      const mockRoot = {
        getDirectoryHandle: (jest.fn() as any).mockResolvedValue(mockAgentsDir),
      };

      (getGroupDir as jest.Mock<any>).mockResolvedValue(mockRoot);
      (readGroupFile as jest.Mock<any>).mockResolvedValue(
        JSON.stringify({
          name: "my_tool",
          description: "My custom tool",
          input_schema: { type: "object" },
          execution: { type: "javascript", code: "return true;" },
        }),
      );
      (getConfig as jest.Mock<any>).mockResolvedValue(["my_tool"]);

      const tool = await findDeclarativeTool({} as any, "main", "my_tool");
      expect(tool?.name).toBe("my_tool");

      // When tool is not in enabled list
      (getConfig as jest.Mock<any>).mockResolvedValue(["other_tool"]);
      const disabledTool = await findDeclarativeTool(
        {} as any,
        "main",
        "my_tool",
      );
      expect(disabledTool).toBeNull();

      // When searching for non-existent tool
      const missing = await findDeclarativeTool(
        {} as any,
        "main",
        "non_existent",
      );
      expect(missing).toBeNull();
    });
  });
});
