import { jest } from "@jest/globals";
import type {
  RemoteManifest,
  RemoteToolItem,
  RemoteScriptItem,
  RemoteSkillItem,
} from "./types.js";

const mockWriteGroupFile = jest.fn<any>().mockResolvedValue(undefined);
const mockGroupFileExists = jest.fn<any>().mockResolvedValue(false);
const mockGetConfig = jest.fn<any>().mockResolvedValue([]);
const mockSetConfig = jest.fn<any>().mockResolvedValue(undefined);

jest.unstable_mockModule("../../../storage/writeGroupFile.js", () => ({
  writeGroupFile: mockWriteGroupFile,
}));

jest.unstable_mockModule("../../../storage/groupFileExists.js", () => ({
  groupFileExists: mockGroupFileExists,
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

const {
  importRemoteTool,
  importRemoteScript,
  importRemoteSkill,
  importRemoteArtifacts,
} = await import("./importArtifacts.js");

describe("importArtifacts", () => {
  const fakeDb: any = {};
  const groupId = "br:main";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupFileExists.mockResolvedValue(false);
    mockGetConfig.mockResolvedValue([]);
  });

  describe("importRemoteTool", () => {
    it("imports a valid declarative tool and writes to OPFS", async () => {
      const validToolJson = JSON.stringify({
        name: "calc",
        description: "Evaluates simple math",
        input_schema: {
          type: "object",
          properties: { expr: { type: "string" } },
        },
        execution: { type: "javascript", code: "return eval(data.expr);" },
      });

      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => validToolJson,
      } as any) as unknown as typeof fetch;

      const toolItem: RemoteToolItem = {
        name: "calc",
        url: "https://example.com/tools/calc.json",
      };

      const result = await importRemoteTool(fakeDb, groupId, toolItem, {
        fetchFn: mockFetch,
        autoEnable: true,
      });

      expect(result.status).toBe("imported");
      expect(result.path).toBe(".agents/tools/main/calc.json");
      expect(mockWriteGroupFile).toHaveBeenCalledWith(
        fakeDb,
        groupId,
        ".agents/tools/main/calc.json",
        expect.stringContaining('"name": "calc"'),
      );
      expect(mockSetConfig).toHaveBeenCalledWith(
        fakeDb,
        "declarative_tools_enabled",
        ["calc"],
      );
    });

    it("rejects shadowing of built-in tool names", async () => {
      const toolItem: RemoteToolItem = {
        name: "bash",
        url: "https://example.com/tools/bash.json",
      };

      const result = await importRemoteTool(fakeDb, groupId, toolItem);
      expect(result.status).toBe("failed");
      expect(result.error).toContain("Cannot shadow built-in tool: bash");
      expect(mockWriteGroupFile).not.toHaveBeenCalled();
    });

    it("fails when integrity digest does not match", async () => {
      const validToolJson = JSON.stringify({
        name: "calc",
        description: "Math",
        input_schema: { type: "object" },
        execution: { type: "javascript", code: "return 42;" },
      });

      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => validToolJson,
      } as any) as unknown as typeof fetch;

      const toolItem: RemoteToolItem = {
        name: "calc",
        url: "https://example.com/tools/calc.json",
        digest:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      };

      const result = await importRemoteTool(fakeDb, groupId, toolItem, {
        fetchFn: mockFetch,
      });

      expect(result.status).toBe("failed");
      expect(result.error).toContain("Integrity verification failed");
      expect(mockWriteGroupFile).not.toHaveBeenCalled();
    });

    it("skips import when file exists and overwrite is false", async () => {
      mockGroupFileExists.mockResolvedValue(true);

      const toolItem: RemoteToolItem = {
        name: "existing_tool",
        url: "https://example.com/tools/existing_tool.json",
      };

      const result = await importRemoteTool(fakeDb, groupId, toolItem, {
        overwrite: false,
      });

      expect(result.status).toBe("skipped");
      expect(mockWriteGroupFile).not.toHaveBeenCalled();
    });
  });

  describe("importRemoteScript", () => {
    it("imports a script and writes to OPFS .agents/scripts/main/", async () => {
      const scriptCode = "export function hello() { return 'world'; }";
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => scriptCode,
      } as any) as unknown as typeof fetch;

      const scriptItem: RemoteScriptItem = {
        name: "my-script",
        url: "https://example.com/scripts/my-script.js",
      };

      const result = await importRemoteScript(fakeDb, groupId, scriptItem, {
        fetchFn: mockFetch,
      });

      expect(result.status).toBe("imported");
      expect(result.path).toBe(".agents/scripts/main/my-script.js");
      expect(mockWriteGroupFile).toHaveBeenCalledWith(
        fakeDb,
        groupId,
        ".agents/scripts/main/my-script.js",
        scriptCode,
      );
    });
  });

  describe("importRemoteSkill", () => {
    it("imports SKILL.md and companion files to .agents/skills/main/<name>/", async () => {
      const skillContent = `---
name: sample-skill
description: A sample skill
---
# Sample Skill Instructions
`;
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => skillContent,
      } as any) as unknown as typeof fetch;

      const skillItem: RemoteSkillItem = {
        name: "sample-skill",
        url: "https://example.com/skills/sample-skill/SKILL.md",
      };

      const result = await importRemoteSkill(fakeDb, groupId, skillItem, {
        fetchFn: mockFetch,
      });

      expect(result.status).toBe("imported");
      expect(result.path).toBe(".agents/skills/main/sample-skill/SKILL.md");
      expect(mockWriteGroupFile).toHaveBeenCalledWith(
        fakeDb,
        groupId,
        ".agents/skills/main/sample-skill/SKILL.md",
        skillContent,
      );
    });
  });

  describe("importRemoteArtifacts", () => {
    it("imports selected tools, scripts, and skills with dependency resolution", async () => {
      const manifest: RemoteManifest = {
        name: "pwgen Knowledge Hub",
        tools: [
          {
            name: "pwgen",
            url: "https://example.com/.agents/tools/main/pwgen.json",
          },
        ],
        scripts: [
          {
            name: "pwgen",
            url: "https://example.com/.agents/scripts/main/pwgen.js",
          },
        ],
        skills: [
          {
            name: "pwgen",
            url: "https://example.com/.agents/skills/main/pwgen/SKILL.md",
            tools: [
              {
                name: "pwgen",
                url: "https://example.com/.agents/tools/main/pwgen.json",
              },
            ],
            scripts: [
              {
                name: "pwgen",
                url: "https://example.com/.agents/scripts/main/pwgen.js",
              },
            ],
          },
        ],
      };

      const mockFetch = jest.fn<any>().mockImplementation((url: string) => {
        if (url.endsWith(".json")) {
          return Promise.resolve({
            ok: true,
            text: async () =>
              JSON.stringify({
                name: "pwgen",
                description: "Password generator",
                input_schema: { type: "object" },
                execution: { type: "javascript", code: "return 'pass';" },
              }),
          });
        }
        if (url.endsWith(".js")) {
          return Promise.resolve({
            ok: true,
            text: async () => "export function pw() { return '123'; }",
          });
        }
        if (url.endsWith("SKILL.md")) {
          return Promise.resolve({
            ok: true,
            text: async () => `---
name: pwgen
description: Pwgen skill
---
# Pwgen Skill
`,
          });
        }
        return Promise.reject(new Error(`Unknown url: ${url}`));
      }) as unknown as typeof fetch;

      // Select only the skill; tool and script should be imported automatically as dependencies!
      const result = await importRemoteArtifacts(
        fakeDb,
        groupId,
        manifest,
        { skillNames: ["pwgen"] },
        { fetchFn: mockFetch, autoEnable: true },
      );

      expect(
        result.skills.some(
          (s) => s.name === "pwgen" && s.status === "imported",
        ),
      ).toBe(true);
      expect(
        result.tools.some((t) => t.name === "pwgen" && t.status === "imported"),
      ).toBe(true);
      expect(
        result.scripts.some(
          (sc) => sc.name === "pwgen" && sc.status === "imported",
        ),
      ).toBe(true);
    });
  });
});
