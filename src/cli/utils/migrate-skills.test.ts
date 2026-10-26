import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  migrateLegacySkills,
  migrateLegacyWorkspaceLayout,
} from "./migrate-skills.js";

describe("migrateLegacySkills", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-migrate-skills-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("migrates skills from legacy .agents/skills/main/<name> to flat .agents/skills/<name> and removes main/", async () => {
    const legacySkillDir = path.join(
      tmpDir,
      ".agents",
      "skills",
      "main",
      "my-skill",
    );
    const referencesDir = path.join(legacySkillDir, "references");
    await mkdir(referencesDir, { recursive: true });
    await writeFile(
      path.join(legacySkillDir, "SKILL.md"),
      "---\nname: my-skill\ndescription: Legacy skill\n---\n# My Skill\n",
      "utf8",
    );
    await writeFile(path.join(referencesDir, "guide.md"), "# Guide\n", "utf8");

    const res = await migrateLegacySkills(tmpDir);

    expect(res.migratedSkills).toContain("my-skill");

    // Verify flat files now exist
    const destSkillMd = path.join(
      tmpDir,
      ".agents",
      "skills",
      "my-skill",
      "SKILL.md",
    );
    const destRefMd = path.join(
      tmpDir,
      ".agents",
      "skills",
      "my-skill",
      "references",
      "guide.md",
    );

    await expect(access(destSkillMd, constants.F_OK)).resolves.toBeUndefined();
    await expect(access(destRefMd, constants.F_OK)).resolves.toBeUndefined();

    const content = await readFile(destSkillMd, "utf8");
    expect(content).toContain("name: my-skill");

    // Verify legacy main directory was cleaned up
    const legacyMainSkills = path.join(tmpDir, ".agents", "skills", "main");
    await expect(access(legacyMainSkills, constants.F_OK)).rejects.toThrow();
  });

  it("is idempotent when workspace already has flat layout and no main/ exists", async () => {
    const flatSkillDir = path.join(tmpDir, ".agents", "skills", "flat-skill");
    await mkdir(flatSkillDir, { recursive: true });
    await writeFile(
      path.join(flatSkillDir, "SKILL.md"),
      "---\nname: flat-skill\n---\n",
      "utf8",
    );

    const res = await migrateLegacySkills(tmpDir);
    expect(res.migratedSkills).toEqual([]);

    const flatSkillMd = path.join(flatSkillDir, "SKILL.md");
    await expect(access(flatSkillMd, constants.F_OK)).resolves.toBeUndefined();
  });

  it("does not overwrite flat destination if it already exists unless overwrite is specified", async () => {
    const legacySkillDir = path.join(
      tmpDir,
      ".agents",
      "skills",
      "main",
      "conflict-skill",
    );
    await mkdir(legacySkillDir, { recursive: true });
    await writeFile(
      path.join(legacySkillDir, "SKILL.md"),
      "---\nname: conflict-skill\ndescription: Old Main\n---\n",
      "utf8",
    );

    const flatSkillDir = path.join(
      tmpDir,
      ".agents",
      "skills",
      "conflict-skill",
    );
    await mkdir(flatSkillDir, { recursive: true });
    await writeFile(
      path.join(flatSkillDir, "SKILL.md"),
      "---\nname: conflict-skill\ndescription: Modern Flat\n---\n",
      "utf8",
    );

    const res = await migrateLegacySkills(tmpDir, { overwrite: false });
    expect(res.migratedSkills).toEqual([]);

    const content = await readFile(path.join(flatSkillDir, "SKILL.md"), "utf8");
    expect(content).toContain("Modern Flat");

    // Legacy directory was cleaned up to avoid duplication
    await expect(access(legacySkillDir, constants.F_OK)).rejects.toThrow();
  });

  it("migrates tools and scripts from legacy main/ and cleans up main directories", async () => {
    const legacyToolsMain = path.join(tmpDir, ".agents", "tools", "main");
    await mkdir(legacyToolsMain, { recursive: true });
    await writeFile(
      path.join(legacyToolsMain, "custom_calc.json"),
      JSON.stringify({ name: "custom_calc" }),
      "utf8",
    );

    const legacyScriptsMain = path.join(tmpDir, ".agents", "scripts", "main");
    await mkdir(legacyScriptsMain, { recursive: true });
    await writeFile(
      path.join(legacyScriptsMain, "helper.js"),
      "export const x = 1;",
      "utf8",
    );

    const res = await migrateLegacyWorkspaceLayout(tmpDir);
    expect(res.migratedTools).toContain("custom_calc.json");
    expect(res.migratedScripts).toContain("helper.js");

    const flatTool = path.join(tmpDir, ".agents", "tools", "custom_calc.json");
    const flatScript = path.join(tmpDir, ".agents", "scripts", "helper.js");
    await expect(access(flatTool, constants.F_OK)).resolves.toBeUndefined();
    await expect(access(flatScript, constants.F_OK)).resolves.toBeUndefined();

    await expect(access(legacyToolsMain, constants.F_OK)).rejects.toThrow();
    await expect(access(legacyScriptsMain, constants.F_OK)).rejects.toThrow();
  });
});
