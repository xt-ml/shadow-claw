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

jest.unstable_mockModule("../../../storage/write-group-file.js", () => ({
  writeGroupFile: mockWriteGroupFile,
}));

jest.unstable_mockModule("../../../storage/group-file-exists.js", () => ({
  groupFileExists: mockGroupFileExists,
}));

jest.unstable_mockModule("../../../db/get-config.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../db/set-config.js", () => ({
  setConfig: mockSetConfig,
}));

const {
  importRemoteTool,
  importRemoteScript,
  importRemoteSkill,
  importRemoteArtifacts,
} = await import("./import-artifacts.js");

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

    it("overwrites file when file exists and overwrite is true", async () => {
      mockGroupFileExists.mockResolvedValue(true);
      const toolJson = JSON.stringify({
        name: "existing_tool",
        description: "Updated tool",
        input_schema: { type: "object" },
        execution: { type: "javascript", code: "return true;" },
      });
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => toolJson,
      } as any) as unknown as typeof fetch;

      const result = await importRemoteTool(
        fakeDb,
        groupId,
        { name: "existing_tool", url: "https://example.com/tool.json" },
        { overwrite: true, fetchFn: mockFetch },
      );

      expect(result.status).toBe("imported");
      expect(mockWriteGroupFile).toHaveBeenCalled();
    });

    it("uses siteSlug or targetSubdir when provided in options", async () => {
      const toolJson = JSON.stringify({
        name: "slug_tool",
        description: "Tool in slug",
        input_schema: { type: "object" },
        execution: { type: "javascript", code: "return true;" },
      });
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => toolJson,
      } as any) as unknown as typeof fetch;

      const resSlug = await importRemoteTool(
        fakeDb,
        undefined,
        { name: "slug_tool", url: "https://example.com/tool.json" },
        { siteSlug: "cool-hub", fetchFn: mockFetch },
      );
      expect(resSlug.path).toBe(
        ".agents/tools/imported/cool-hub/slug_tool.json",
      );

      const resSubdir = await importRemoteTool(
        fakeDb,
        groupId,
        { name: "slug_tool", url: "https://example.com/tool.json" },
        { targetSubdir: "custom_dir", fetchFn: mockFetch },
      );
      expect(resSubdir.path).toBe(".agents/tools/custom_dir/slug_tool.json");
    });

    it("rejects invalid tool names", async () => {
      const resEmpty = await importRemoteTool(fakeDb, groupId, {
        name: "",
        url: "https://example.com/tool.json",
      });
      expect(resEmpty.status).toBe("failed");
      expect(resEmpty.error).toContain("Invalid tool name");

      const resBad = await importRemoteTool(fakeDb, groupId, {
        name: "123_invalid-name!",
        url: "https://example.com/tool.json",
      });
      expect(resBad.status).toBe("failed");
      expect(resBad.error).toContain("Invalid tool name");
    });

    it("fails when fetch response is not ok", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
      } as any) as unknown as typeof fetch;

      const result = await importRemoteTool(
        fakeDb,
        groupId,
        { name: "failing_tool", url: "https://example.com/tool.json" },
        { fetchFn: mockFetch },
      );

      expect(result.status).toBe("failed");
      expect(result.error).toBe("HTTP 500 Server Error");
    });

    it("fails when tool definition is invalid JSON", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => "not-valid-json{{{",
      } as any) as unknown as typeof fetch;

      const result = await importRemoteTool(
        fakeDb,
        groupId,
        { name: "bad_json_tool", url: "https://example.com/tool.json" },
        { fetchFn: mockFetch },
      );

      expect(result.status).toBe("failed");
      expect(result.error).toContain("not valid JSON");
    });

    it("appends to existing declarative_tools_enabled config when autoEnable is set", async () => {
      mockGetConfig.mockResolvedValue(["existing_one"]);
      const toolJson = JSON.stringify({
        name: "another_tool",
        description: "Another tool",
        input_schema: { type: "object" },
        execution: { type: "javascript", code: "return true;" },
      });
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => toolJson,
      } as any) as unknown as typeof fetch;

      const result = await importRemoteTool(
        fakeDb,
        groupId,
        { name: "another_tool", url: "https://example.com/tool.json" },
        { autoEnable: true, fetchFn: mockFetch },
      );

      expect(result.status).toBe("imported");
      expect(mockSetConfig).toHaveBeenCalledWith(
        fakeDb,
        "declarative_tools_enabled",
        ["existing_one", "another_tool"],
      );
    });

    it("catches non-Error exceptions and formats them as strings", async () => {
      mockGroupFileExists.mockRejectedValueOnce("Disk failure string");
      const result = await importRemoteTool(fakeDb, groupId, {
        name: "test_tool",
        url: "https://example.com/tool.json",
      });
      expect(result.status).toBe("failed");
      expect(result.error).toBe("Disk failure string");
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

    it("preserves script extension if already ending in .js or .mjs", async () => {
      const scriptCode = "console.log('hi');";
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => scriptCode,
      } as any) as unknown as typeof fetch;

      const resJs = await importRemoteScript(
        fakeDb,
        undefined,
        { name: "run.js", url: "https://example.com/run.js" },
        { fetchFn: mockFetch },
      );
      expect(resJs.path).toBe(".agents/scripts/main/run.js");

      const resMjs = await importRemoteScript(
        fakeDb,
        groupId,
        { name: "run.mjs", url: "https://example.com/run.mjs" },
        { fetchFn: mockFetch },
      );
      expect(resMjs.path).toBe(".agents/scripts/main/run.mjs");
    });

    it("skips script import when file exists and overwrite is false", async () => {
      mockGroupFileExists.mockResolvedValue(true);
      const res = await importRemoteScript(
        fakeDb,
        groupId,
        { name: "existing.js", url: "https://example.com/existing.js" },
        { overwrite: false },
      );
      expect(res.status).toBe("skipped");
    });

    it("fails when script fetch is not ok", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any) as unknown as typeof fetch;

      const res = await importRemoteScript(
        fakeDb,
        groupId,
        { name: "missing.js", url: "https://example.com/missing.js" },
        { fetchFn: mockFetch },
      );
      expect(res.status).toBe("failed");
      expect(res.error).toBe("HTTP 404 Not Found");
    });

    it("fails when script digest verification fails", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => "console.log('mismatch');",
      } as any) as unknown as typeof fetch;

      const res = await importRemoteScript(
        fakeDb,
        groupId,
        {
          name: "digest.js",
          url: "https://example.com/digest.js",
          digest:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        },
        { fetchFn: mockFetch },
      );
      expect(res.status).toBe("failed");
      expect(res.error).toContain("Integrity verification failed for script");
    });

    it("catches non-Error exceptions in script import", async () => {
      mockGroupFileExists.mockRejectedValueOnce("Script FS failure");
      const res = await importRemoteScript(fakeDb, groupId, {
        name: "fail.js",
        url: "https://example.com/fail.js",
      });
      expect(res.status).toBe("failed");
      expect(res.error).toBe("Script FS failure");
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

    it("skips skill import when file exists and overwrite is false", async () => {
      mockGroupFileExists.mockResolvedValue(true);
      const res = await importRemoteSkill(
        fakeDb,
        undefined,
        { name: "existing-skill", url: "https://example.com/skill.md" },
        { overwrite: false },
      );
      expect(res.status).toBe("skipped");
    });

    it("fails when skill fetch is not ok", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as any) as unknown as typeof fetch;

      const res = await importRemoteSkill(
        fakeDb,
        groupId,
        { name: "denied-skill", url: "https://example.com/skill.md" },
        { fetchFn: mockFetch },
      );
      expect(res.status).toBe("failed");
      expect(res.error).toBe("HTTP 403 Forbidden");
    });

    it("fails when skill digest verification fails", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        text: async () => "---\nname: digest-fail\n---\n",
      } as any) as unknown as typeof fetch;

      const res = await importRemoteSkill(
        fakeDb,
        groupId,
        {
          name: "digest-fail",
          url: "https://example.com/skill.md",
          digest:
            "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        },
        { fetchFn: mockFetch },
      );
      expect(res.status).toBe("failed");
      expect(res.error).toContain("Integrity verification failed for skill");
    });

    it("catches non-Error exceptions in skill import", async () => {
      mockGroupFileExists.mockRejectedValueOnce("Skill FS failure");
      const res = await importRemoteSkill(fakeDb, groupId, {
        name: "fail-skill",
        url: "https://example.com/skill.md",
      });
      expect(res.status).toBe("failed");
      expect(res.error).toBe("Skill FS failure");
    });
  });

  describe("importRemoteArtifacts", () => {
    it("handles empty selections and empty manifests cleanly", async () => {
      const res = await importRemoteArtifacts(
        fakeDb,
        groupId,
        { name: "empty" } as any,
        {},
      );
      expect(res.tools).toEqual([]);
      expect(res.skills).toEqual([]);
      expect(res.scripts).toEqual([]);
      expect(res.diagnostics).toEqual([]);
    });

    it("imports directly selected tools and scripts and accumulates diagnostics on failure", async () => {
      const manifest: RemoteManifest = {
        name: "Direct Hub",
        tools: [{ name: "bad_tool", url: "https://example.com/tool.json" }],
        scripts: [{ name: "bad_script", url: "https://example.com/script.js" }],
        skills: [{ name: "bad_skill", url: "https://example.com/skill.md" }],
      };

      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Crash",
      } as any) as unknown as typeof fetch;

      const res = await importRemoteArtifacts(
        fakeDb,
        groupId,
        manifest,
        {
          toolNames: ["bad_tool"],
          scriptNames: ["bad_script"],
          skillNames: ["bad_skill"],
        },
        { fetchFn: mockFetch },
      );

      expect(res.tools[0].status).toBe("failed");
      expect(res.scripts[0].status).toBe("failed");
      expect(res.skills[0].status).toBe("failed");
      expect(res.diagnostics).toEqual([
        "Script bad_script: HTTP 500 Crash",
        "Tool bad_tool: HTTP 500 Crash",
        "Skill bad_skill: HTTP 500 Crash",
      ]);
    });

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
