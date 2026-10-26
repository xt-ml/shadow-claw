import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export interface MigrateSkillsResult {
  migratedSkills: string[];
  migratedTools: string[];
  migratedScripts: string[];
}

/**
 * Migrates older ShadowClaw workspace templates and existing projects
 * nested under legacy `main/` subfolders:
 * - `.agents/skills/main/<name>/` -> `.agents/skills/<name>/`
 * - `.agents/tools/main/<name>.json` -> `.agents/tools/<name>.json`
 * - `.agents/scripts/main/<name>.js` -> `.agents/scripts/<name>.js`
 *
 * This ensures 100% compatibility with standard agent tools (`npx skills`, Claude,
 * Copilot, Codex) without introducing any direct dependency on external packages.
 * Automatically cleans up empty legacy `main/` directories once files are moved.
 */
export async function migrateLegacySkills(
  workspaceDir: string,
  options: { overwrite?: boolean } = {},
): Promise<MigrateSkillsResult> {
  const resolvedWorkspace = path.resolve(workspaceDir);
  const migratedSkills: string[] = [];
  const migratedTools: string[] = [];
  const migratedScripts: string[] = [];

  // 1. Migrate Skills (.agents/skills/main/<name>/ -> .agents/skills/<name>/)
  const skillsRoot = path.join(resolvedWorkspace, ".agents", "skills");
  const legacySkillsMain = path.join(skillsRoot, "main");
  if (await pathExists(legacySkillsMain)) {
    try {
      const entries = await readdir(legacySkillsMain, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const srcSkillDir = path.join(legacySkillsMain, entry.name);
        const srcSkillMd = path.join(srcSkillDir, "SKILL.md");
        if (!(await pathExists(srcSkillMd))) continue;

        const destSkillDir = path.join(skillsRoot, entry.name);
        const destSkillMd = path.join(destSkillDir, "SKILL.md");

        if (!(await pathExists(destSkillMd)) || options.overwrite) {
          await mkdir(destSkillDir, { recursive: true });
          await cp(srcSkillDir, destSkillDir, { recursive: true, force: true });
          migratedSkills.push(entry.name);
        }
        await rm(srcSkillDir, { recursive: true, force: true });
      }

      const remaining = await readdir(legacySkillsMain);
      if (remaining.length === 0) {
        await rm(legacySkillsMain, { recursive: true, force: true });
      }
    } catch {}
  }

  // 2. Migrate Tools (.agents/tools/main/* -> .agents/tools/*)
  const toolsRoot = path.join(resolvedWorkspace, ".agents", "tools");
  const legacyToolsMain = path.join(toolsRoot, "main");
  if (await pathExists(legacyToolsMain)) {
    try {
      const entries = await readdir(legacyToolsMain, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(legacyToolsMain, entry.name);
        const destPath = path.join(toolsRoot, entry.name);

        if (!(await pathExists(destPath)) || options.overwrite) {
          await mkdir(path.dirname(destPath), { recursive: true });
          await cp(srcPath, destPath, { recursive: true, force: true });
          migratedTools.push(entry.name);
        }
        await rm(srcPath, { recursive: true, force: true });
      }

      const remaining = await readdir(legacyToolsMain);
      if (remaining.length === 0) {
        await rm(legacyToolsMain, { recursive: true, force: true });
      }
    } catch {}
  }

  // 3. Migrate Scripts (.agents/scripts/main/* -> .agents/scripts/*)
  const scriptsRoot = path.join(resolvedWorkspace, ".agents", "scripts");
  const legacyScriptsMain = path.join(scriptsRoot, "main");
  if (await pathExists(legacyScriptsMain)) {
    try {
      const entries = await readdir(legacyScriptsMain, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(legacyScriptsMain, entry.name);
        const destPath = path.join(scriptsRoot, entry.name);

        if (!(await pathExists(destPath)) || options.overwrite) {
          await mkdir(path.dirname(destPath), { recursive: true });
          await cp(srcPath, destPath, { recursive: true, force: true });
          migratedScripts.push(entry.name);
        }
        await rm(srcPath, { recursive: true, force: true });
      }

      const remaining = await readdir(legacyScriptsMain);
      if (remaining.length === 0) {
        await rm(legacyScriptsMain, { recursive: true, force: true });
      }
    } catch {}
  }

  return { migratedSkills, migratedTools, migratedScripts };
}

export const migrateLegacyWorkspaceLayout = migrateLegacySkills;
