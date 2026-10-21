import fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  computeSha256,
  generateSkillsIndex,
  isTestFileOrDir,
  runSkillsIndexCommand,
} from "./skills-index.js";

describe("skills-index command and generator", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "sc-skills-index-test-"));
  });

  afterEach(async () => {
    if (tempDir && fs.existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("computes standard sha256 format", () => {
    const hash = computeSha256("hello world");
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hash).toBe(
      "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("indexes skills, tools, and scripts into .well-known/agent-skills/index.json", async () => {
    // 1. Setup mock repo layout
    const skillDir = path.join(
      tempDir,
      ".agents",
      "skills",
      "main",
      "test-skill",
    );
    const toolDir = path.join(tempDir, ".agents", "tools", "main");
    const scriptDir = path.join(tempDir, ".agents", "scripts", "main");

    await mkdir(skillDir, { recursive: true });
    await mkdir(toolDir, { recursive: true });
    await mkdir(scriptDir, { recursive: true });

    const skillContent = `---
name: test-skill
description: A test skill for discovery index.
metadata:
  allowed-tools: test_tool
  execution:
    type: tools
    tools:
      - name: test_tool
---
# Test Skill Body
`;
    await writeFile(path.join(skillDir, "SKILL.md"), skillContent, "utf8");

    const toolContent = JSON.stringify({
      name: "test_tool",
      description: "A test tool description.",
      input_schema: { type: "object" },
    });
    await writeFile(path.join(toolDir, "test_tool.json"), toolContent, "utf8");

    const scriptContent = `export function run() { return 42; }`;
    await writeFile(
      path.join(scriptDir, "test-skill.js"),
      scriptContent,
      "utf8",
    );

    // 2. Run generator
    const indexDoc = await generateSkillsIndex(tempDir);

    expect(indexDoc.$schema).toBe(
      "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    );
    expect(indexDoc.skills).toHaveLength(1);

    const skill = indexDoc.skills[0];
    expect(skill.name).toBe("test-skill");
    expect(skill.type).toBe("skill-md");
    expect(skill.description).toBe("A test skill for discovery index.");
    expect(skill.url).toBe("../../.agents/skills/main/test-skill/SKILL.md");
    expect(skill.digest).toBe(computeSha256(skillContent));

    // Check associated tools & scripts on skill
    expect(skill.tools).toHaveLength(1);
    expect(skill.tools[0].name).toBe("test_tool");
    expect(skill.tools[0].url).toBe("../../.agents/tools/main/test_tool.json");
    expect(skill.tools[0].digest).toBe(computeSha256(toolContent));

    expect(skill.scripts).toHaveLength(1);
    expect(skill.scripts[0].name).toBe("test-skill");
    expect(skill.scripts[0].url).toBe(
      "../../.agents/scripts/main/test-skill.js",
    );
    expect(skill.scripts[0].digest).toBe(computeSha256(scriptContent));

    // Check top-level arrays
    expect(indexDoc.tools).toHaveLength(1);
    expect(indexDoc.scripts).toHaveLength(1);
    expect(indexDoc.dependencies.tools).toContain(
      "../../.agents/tools/main/test_tool.json",
    );
    expect(indexDoc.dependencies.scripts).toContain(
      "../../.agents/scripts/main/test-skill.js",
    );

    // Verify written file on disk
    const targetFile = path.join(
      tempDir,
      ".well-known",
      "agent-skills",
      "index.json",
    );
    expect(fs.existsSync(targetFile)).toBe(true);

    const writtenJson = JSON.parse(
      await fs.promises.readFile(targetFile, "utf8"),
    );
    expect(writtenJson.skills[0].name).toBe("test-skill");
  });

  it("respects write: false and custom output file options", async () => {
    const skillDir = path.join(tempDir, ".agents", "skills", "main", "minimal");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: minimal\ndescription: Minimal.\n---\n",
      "utf8",
    );

    const res = await generateSkillsIndex(tempDir, { write: false });
    expect(res.skills).toHaveLength(1);

    const standardPath = path.join(
      tempDir,
      ".well-known",
      "agent-skills",
      "index.json",
    );
    expect(fs.existsSync(standardPath)).toBe(false);

    const customOut = path.join(tempDir, "custom", "index.json");
    await generateSkillsIndex(tempDir, { outFile: customOut });
    expect(fs.existsSync(customOut)).toBe(true);
  });

  it("resolves site metadata from parent directory when indexing a subfolder like dist/public", async () => {
    await writeFile(
      path.join(tempDir, "shadow-claw.config.json"),
      JSON.stringify({
        site: {
          title: "My Custom Knowledge Hub",
          description: "A custom description for testing metadata resolution.",
        },
      }),
      "utf8",
    );

    const distPublicDir = path.join(tempDir, "dist", "public");
    const skillDir = path.join(
      distPublicDir,
      ".agents",
      "skills",
      "main",
      "custom",
    );
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: custom\ndescription: Custom skill.\n---\n",
      "utf8",
    );

    const res = await generateSkillsIndex(distPublicDir, { write: false });
    expect(res.name).toBe("My Custom Knowledge Hub");
    expect(res.description).toBe(
      "A custom description for testing metadata resolution.",
    );
    expect(res.skills).toHaveLength(1);
    expect(res.skills[0].name).toBe("custom");
    expect(res.skills[0].url).toBe("../../.agents/skills/main/custom/SKILL.md");
  });

  it("discovers bundled skills when toolchainRoot is provided and merges them without duplicates", async () => {
    const mockToolchain = path.join(tempDir, "toolchain");
    const bundledSkillDir = path.join(
      mockToolchain,
      ".agents",
      "skills",
      "main",
      "skill-creator",
    );
    await mkdir(bundledSkillDir, { recursive: true });
    await writeFile(
      path.join(bundledSkillDir, "SKILL.md"),
      "---\nname: skill-creator\ndescription: Bundled skill creator.\n---\n",
      "utf8",
    );

    const mockContent = path.join(tempDir, "content");
    const contentSkillDir = path.join(
      mockContent,
      ".agents",
      "skills",
      "main",
      "my-skill",
    );
    await mkdir(contentSkillDir, { recursive: true });
    await writeFile(
      path.join(contentSkillDir, "SKILL.md"),
      "---\nname: my-skill\ndescription: Custom skill.\n---\n",
      "utf8",
    );

    const res = await generateSkillsIndex(mockContent, {
      toolchainRoot: mockToolchain,
      write: false,
    });
    expect(res.skills).toHaveLength(2);
    expect(res.skills.map((s: any) => s.name)).toEqual(
      expect.arrayContaining(["my-skill", "skill-creator"]),
    );
    const creatorSkill = res.skills.find(
      (s: any) => s.name === "skill-creator",
    );
    expect(creatorSkill.url).toBe(
      "../../.agents/skills/main/skill-creator/SKILL.md",
    );
  });

  it("does not include bundled skills by default in runSkillsIndexCommand for an external directory", async () => {
    const mockProject = path.join(tempDir, "external-project");
    const toolDir = path.join(mockProject, ".agents", "tools", "main");
    await mkdir(toolDir, { recursive: true });
    await writeFile(
      path.join(toolDir, "get_weather.json"),
      JSON.stringify({ name: "get_weather", description: "Get weather" }),
      "utf8",
    );

    const res = await runSkillsIndexCommand(mockProject, { write: true });
    expect(res.tools).toHaveLength(1);
    expect(res.tools[0].name).toBe("get_weather");
    expect(res.skills).toHaveLength(0);

    // Verify .agents/skills was not created with phantom skill-creator
    const phantomSkillPath = path.join(
      mockProject,
      ".agents",
      "skills",
      "main",
      "skill-creator",
    );
    expect(fs.existsSync(phantomSkillPath)).toBe(false);

    // Verify written index.json matches
    const written = JSON.parse(
      await fs.promises.readFile(
        path.join(mockProject, ".well-known", "agent-skills", "index.json"),
        "utf8",
      ),
    );
    expect(written.skills).toHaveLength(0);
    expect(written.tools).toHaveLength(1);
  });

  it("materializes bundled skill files onto disk when bundled: true is passed to runSkillsIndexCommand", async () => {
    const mockToolchain = path.join(tempDir, "custom-toolchain");
    const bundledSkillDir = path.join(
      mockToolchain,
      ".agents",
      "skills",
      "main",
      "skill-creator",
    );
    await mkdir(bundledSkillDir, { recursive: true });
    await writeFile(
      path.join(bundledSkillDir, "SKILL.md"),
      "---\nname: skill-creator\ndescription: Bundled skill creator.\n---\n",
      "utf8",
    );

    const mockProject = path.join(tempDir, "bundled-project");
    const res = await runSkillsIndexCommand(mockProject, {
      bundled: true,
      toolchainRoot: mockToolchain,
      write: true,
    });

    expect(res.skills).toHaveLength(1);
    expect(res.skills[0].name).toBe("skill-creator");
    expect(res.skills[0].url).toBe(
      "../../.agents/skills/main/skill-creator/SKILL.md",
    );

    // Verify the file was actually materialized onto disk so the relative URL is not a 404
    const materializedSkill = path.join(
      mockProject,
      ".agents",
      "skills",
      "main",
      "skill-creator",
      "SKILL.md",
    );
    expect(fs.existsSync(materializedSkill)).toBe(true);
    const content = await fs.promises.readFile(materializedSkill, "utf8");
    expect(content).toContain("skill-creator");
  });

  it("accurately identifies test files and test directories via isTestFileOrDir", () => {
    // Test filenames
    expect(isTestFileOrDir("pwgen-adapter.test.mjs")).toBe(true);
    expect(isTestFileOrDir("pwgen-adapter.test.js")).toBe(true);
    expect(isTestFileOrDir("pwgen-adapter.spec.js")).toBe(true);
    expect(isTestFileOrDir("pwgen-adapter.test.ts")).toBe(true);
    expect(isTestFileOrDir("pwgen-tool.test.json")).toBe(true);

    // Test directory names
    expect(isTestFileOrDir("__tests__")).toBe(true);
    expect(isTestFileOrDir("test")).toBe(true);
    expect(isTestFileOrDir("tests")).toBe(true);

    // Full path checks
    expect(
      isTestFileOrDir(
        "helper.js",
        path.join(tempDir, ".agents", "scripts", "__tests__", "helper.js"),
      ),
    ).toBe(true);
    expect(
      isTestFileOrDir(
        "util.js",
        path.join(tempDir, ".agents", "scripts", "test", "util.js"),
      ),
    ).toBe(true);

    // Legitimate non-test files and skills
    expect(isTestFileOrDir("pwgen-adapter.js")).toBe(false);
    expect(isTestFileOrDir("pwgen.js")).toBe(false);
    expect(isTestFileOrDir("test-skill.js")).toBe(false);
    expect(isTestFileOrDir("test-skill")).toBe(false);
    expect(isTestFileOrDir("contest.js")).toBe(false);
    expect(isTestFileOrDir("latest.js")).toBe(false);
  });

  it("excludes test files and test directories from skill, tool, and script discovery", async () => {
    const skillDir = path.join(tempDir, ".agents", "skills", "main", "pwgen");
    const scriptDir = path.join(tempDir, ".agents", "scripts", "main");
    const testDir = path.join(
      tempDir,
      ".agents",
      "scripts",
      "main",
      "__tests__",
    );
    const toolDir = path.join(tempDir, ".agents", "tools", "main");

    await mkdir(skillDir, { recursive: true });
    await mkdir(scriptDir, { recursive: true });
    await mkdir(testDir, { recursive: true });
    await mkdir(toolDir, { recursive: true });

    // Main skill
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: pwgen
description: Password generator.
---
# pwgen
`,
      "utf8",
    );

    // Main script
    await writeFile(
      path.join(scriptDir, "pwgen-adapter.js"),
      `export function init() {}`,
      "utf8",
    );

    // Test file co-located next to script (must be ignored)
    await writeFile(
      path.join(scriptDir, "pwgen-adapter.test.mjs"),
      `import test from "node:test";`,
      "utf8",
    );

    // Test file in nested __tests__ directory (must be ignored)
    await writeFile(
      path.join(testDir, "pwgen-helper.js"),
      `// test helper`,
      "utf8",
    );

    // Tool file and test tool file
    await writeFile(
      path.join(toolDir, "pwgen.json"),
      JSON.stringify({ name: "pwgen", description: "Generate password" }),
      "utf8",
    );
    await writeFile(
      path.join(toolDir, "pwgen.test.json"),
      JSON.stringify({ name: "pwgen.test", description: "Mock tool" }),
      "utf8",
    );

    const indexDoc = await generateSkillsIndex(tempDir, { write: false });

    // Verify only the real script is indexed, not the test files
    const scriptNames = indexDoc.scripts.map((s: any) => s.name);
    expect(scriptNames).toContain("pwgen-adapter");
    expect(scriptNames).not.toContain("pwgen-adapter.test");
    expect(scriptNames).not.toContain("pwgen-helper");
    expect(indexDoc.scripts).toHaveLength(1);

    // Verify pwgen skill does not have pwgen-adapter.test in its scripts
    const pwgenSkill = indexDoc.skills.find((s: any) => s.name === "pwgen");
    expect(pwgenSkill).toBeDefined();
    if (pwgenSkill.scripts) {
      const skillScriptNames = pwgenSkill.scripts.map((s: any) => s.name);
      expect(skillScriptNames).toContain("pwgen-adapter");
      expect(skillScriptNames).not.toContain("pwgen-adapter.test");
    }

    // Verify tool list does not include pwgen.test.json
    const toolNames = indexDoc.tools.map((t: any) => t.name);
    expect(toolNames).toContain("pwgen");
    expect(toolNames).not.toContain("pwgen.test");
    expect(indexDoc.tools).toHaveLength(1);
  });
});
