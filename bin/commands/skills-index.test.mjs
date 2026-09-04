import fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import {
  computeSha256,
  generateSkillsIndex,
  runSkillsIndexCommand,
} from "./skills-index.mjs";

describe("skills-index command and generator", () => {
  let tempDir;

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
    expect(res.skills.map((s) => s.name)).toEqual(
      expect.arrayContaining(["my-skill", "skill-creator"]),
    );
    const creatorSkill = res.skills.find((s) => s.name === "skill-creator");
    expect(creatorSkill.url).toBe(
      "../../.agents/skills/main/skill-creator/SKILL.md",
    );
  });
});
