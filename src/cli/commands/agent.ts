/**
 * ShadowClaw CLI — `agent` command
 * Headless CLI agent participant supporting init, skills, tools, skill, and run.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import {
  migrateLegacySkills,
  migrateLegacyWorkspaceLayout,
} from "../utils/migrate-skills.js";
import { parseSkill } from "../../subsystems/skills/parse-skill.js";

async function readSkillsLock(workspaceDir: string): Promise<any> {
  try {
    const lockPath = path.join(path.resolve(workspaceDir), "skills-lock.json");
    const raw = await readFile(lockPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function removeFromSkillsLock(
  workspaceDir: string,
  skillName: string,
): Promise<boolean> {
  try {
    const lockPath = path.join(path.resolve(workspaceDir), "skills-lock.json");
    const raw = await readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.skills?.[skillName]) {
      delete parsed.skills[skillName];
      await writeFile(lockPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
      return true;
    }
  } catch {}
  return false;
}

async function initSkillTemplate(
  workspaceDir: string,
  skillName: string,
  options: { description?: string; flat?: boolean } = {},
): Promise<{ name: string; path: string }> {
  const cleanName = skillName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-");
  if (!cleanName) {
    throw new Error("Skill name is required");
  }
  const relSkillDir =
    options.flat === false
      ? path.join(".agents", "skills", "main", cleanName)
      : path.join(".agents", "skills", cleanName);
  const fullSkillDir = path.join(path.resolve(workspaceDir), relSkillDir);
  const fullSkillMd = path.join(fullSkillDir, "SKILL.md");

  await mkdir(fullSkillDir, { recursive: true });
  const description =
    options.description ||
    `Instructions and workflow for the ${cleanName} skill.`;
  const template = `---\nname: ${cleanName}\ndescription: ${description}\n---\n\n# ${cleanName}\n\nProvide step-by-step instructions for the agent when this skill is activated.\n`;
  await writeFile(fullSkillMd, template, "utf8");
  return {
    name: cleanName,
    path: path.posix.join(...relSkillDir.split(path.sep), "SKILL.md"),
  };
}

export function resolveNpxCommand(): { command: string; shell: boolean } {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? "npx.cmd" : "npx";

  try {
    const candidatePath = path.join(path.dirname(process.execPath), binaryName);
    if (existsSync(candidatePath)) {
      return { command: candidatePath, shell: isWindows };
    }
  } catch {}

  return { command: binaryName, shell: isWindows };
}

export function runNpxSkillsCommand(
  args: string[],
  options: { workspaceDir?: string; execFn?: any; timeoutMs?: number } = {},
): Promise<{
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  const cwd = path.resolve(options.workspaceDir || process.cwd());
  const { command, shell } = resolveNpxCommand();
  const fullArgs = ["--yes", "skills", ...args];
  if (options.execFn) {
    return options
      .execFn(command, fullArgs, {
        cwd,
        env: process.env,
        timeoutMs: options.timeoutMs,
        shell,
      })
      .then((res: any) => ({
        success: res.exitCode === 0,
        exitCode: res.exitCode ?? 0,
        stdout: res.stdout || "",
        stderr: res.stderr || "",
      }))
      .catch((err: any) => ({
        success: false,
        exitCode: 1,
        stdout: "",
        stderr: String(err),
        error: String(err),
      }));
  }
  return new Promise((resolve) => {
    const child = spawn(command, ["--yes", "skills", ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c) => (stdout += String(c)));
    child.stderr?.on("data", (c) => (stderr += String(c)));
    child.on("error", (err) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr,
        error: err.message,
      });
    });
    child.on("close", (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
        ...(code !== 0
          ? { error: stderr || `Process exited with code ${code}` }
          : {}),
      });
    });
  });
}

async function findSkillMdFiles(
  dir: string,
  results: string[] = [],
): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await findSkillMdFiles(fullPath, results);
      } else if (entry.name.toLowerCase() === "skill.md") {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

async function importLocalSkillsDirectory(
  sourceDir: string,
  workspaceDir: string,
  options: {
    skillNames?: string[];
    overwrite?: boolean;
    targetSubdir?: string;
  } = {},
): Promise<{ imported: string[]; skipped: string[]; failed: any[] }> {
  const resolvedSrc = path.resolve(sourceDir.replace(/^file:\/\//, ""));
  const resolvedWorkspace = path.resolve(workspaceDir);
  const imported: string[] = [];
  const skipped: string[] = [];
  const failed: any[] = [];

  const filterSet =
    options.skillNames && options.skillNames.length > 0
      ? new Set(options.skillNames)
      : null;

  const baseTargetSkillsDir = options.targetSubdir
    ? path.join(resolvedWorkspace, ".agents", "skills", options.targetSubdir)
    : path.join(resolvedWorkspace, ".agents", "skills");

  try {
    const skillMdFiles = await findSkillMdFiles(resolvedSrc);
    if (skillMdFiles.length === 0) {
      const directSkillMd = path.join(resolvedSrc, "SKILL.md");
      try {
        await stat(directSkillMd);
        skillMdFiles.push(directSkillMd);
      } catch {}
    }

    for (const skillMdPath of skillMdFiles.sort()) {
      const skillDir = path.dirname(skillMdPath);
      try {
        const raw = await readFile(skillMdPath, "utf8");
        const parsed = parseSkill(skillMdPath, raw);
        if (filterSet && !filterSet.has(parsed.name)) {
          continue;
        }

        const destSkillDir = path.join(baseTargetSkillsDir, parsed.name);
        const destSkillMd = path.join(destSkillDir, "SKILL.md");

        let exists = false;
        try {
          await stat(destSkillMd);
          exists = true;
        } catch {}

        if (exists && !options.overwrite) {
          skipped.push(parsed.name);
          continue;
        }

        await mkdir(destSkillDir, { recursive: true });
        await cp(skillDir, destSkillDir, { recursive: true, force: true });
        imported.push(parsed.name);
      } catch (err: any) {
        failed.push({
          name: path.basename(skillDir),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err: any) {
    failed.push({
      name: path.basename(resolvedSrc),
      error: err?.message || String(err),
    });
  }

  return { imported, skipped, failed };
}

async function findFilesByExt(
  dir: string,
  exts: string[],
  results: string[] = [],
): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await findFilesByExt(fullPath, exts, results);
      } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

// Imports declarative tools (.json) or scripts (.js/.mjs) into the flat layout;
// legacy `main/` subfolders in the source are scanned recursively.
async function importLocalFlatArtifacts(
  kind: "tools" | "scripts",
  sourceDir: string,
  workspaceDir: string,
  options: {
    names?: string[];
    overwrite?: boolean;
    targetSubdir?: string;
  } = {},
): Promise<{ imported: string[]; skipped: string[]; failed: any[] }> {
  const resolvedSrc = path.resolve(sourceDir.replace(/^file:\/\//, ""));
  const roots = [
    path.join(resolvedSrc, ".agents", kind),
    path.join(resolvedSrc, kind),
  ];
  if (path.basename(resolvedSrc) === kind) roots.push(resolvedSrc);

  const exts = kind === "tools" ? [".json"] : [".js", ".mjs"];
  const filterSet =
    options.names && options.names.length > 0 ? new Set(options.names) : null;
  const destDir = options.targetSubdir
    ? path.join(
        path.resolve(workspaceDir),
        ".agents",
        kind,
        options.targetSubdir,
      )
    : path.join(path.resolve(workspaceDir), ".agents", kind);

  const imported: string[] = [];
  const skipped: string[] = [];
  const failed: any[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    for (const file of (await findFilesByExt(root, exts)).sort()) {
      const base = path.basename(file);
      const name = base.replace(/\.[^.]+$/, "");
      if (seen.has(base)) continue;
      seen.add(base);
      if (filterSet && !filterSet.has(name) && !filterSet.has(base)) continue;
      try {
        if (kind === "tools" && !/^[a-z][a-z0-9_]{0,63}$/.test(name)) {
          throw new Error(`Invalid tool name: ${name}`);
        }
        const dest = path.join(destDir, base);
        let exists = false;
        try {
          await stat(dest);
          exists = true;
        } catch {}
        if (exists && !options.overwrite) {
          skipped.push(name);
          continue;
        }
        await mkdir(destDir, { recursive: true });
        await cp(file, dest, { force: true });
        imported.push(name);
      } catch (err: any) {
        failed.push({ name, error: err?.message || String(err) });
      }
    }
  }

  return { imported, skipped, failed };
}

function isNpxSkillsPackageSource(input: string): boolean {
  const trimmed = (input || "").trim();
  if (!trimmed) return false;
  if (/^(?:\.\/|\.\.\/|\/|[a-zA-Z]:[\\/]|file:\/\/)/.test(trimmed))
    return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return /github\.com|gitlab\.com/i.test(trimmed);
  }
  return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:@[a-zA-Z0-9_.-]+)?$/.test(trimmed);
}

export async function syncWorkspaceSkills(
  workspaceDir: string,
  options: { overwrite?: boolean } = {},
): Promise<{ syncedToFlat: string[]; syncedToMain: string[] }> {
  const mig = await migrateLegacySkills(workspaceDir, options);
  return { syncedToFlat: mig.migratedSkills, syncedToMain: [] };
}
import type {
  AgentInitOptions,
  AgentInitResult,
  AgentSkillsOptions,
  AgentToolsOptions,
  AgentToolOptions,
  AgentToolResult,
  AgentSkillOptions,
  AgentSkillResult,
  AgentRunOptions,
  AgentRunResult,
  AgentModelOptions,
  AgentModelResult,
  AgentImportOptions,
  AgentImportResult,
} from "../../worker/headless-types.js";

import { bootstrapHeadlessAgent } from "./agent-bootstrap.js";
import { handleNativeAiTaskMessage } from "./native-ai-task-handler.js";
import { readStdin, mapTextToToolInput } from "../utils/stdin.js";
import {
  loadCliAttachments,
  normalizeFileOption,
} from "../utils/load-cli-attachments.js";
import { persistMessageAttachments } from "../../content/message-attachments.js";
import { buildAttachmentContentBlocks } from "../../content/build-attachment-content-blocks.js";
import {
  getAttachmentCategory,
  getModelAttachmentCapabilities,
} from "../../content/attachment-capabilities.js";
import { readGroupFileBytes } from "../../storage/read-group-file-bytes.js";

const BROWSER_ONLY_TOOLS = new Set([
  "ask_user",
  "attach_file_to_chat",
  "clear_chat",
  "create_room",
  "invite_to_room",
  "leave_room",
  "list_components",
  "list_room_members",
  "open_file",
  "render_component",
  "send_file",
  "show_toast",
  "send_notification",
  "spawn_subagent",
]);

const DEFAULT_SERVER_GROUP_ID = "server:main";

import { loadWorkspaceConfig } from "../utils/load-workspace-config.js";
export { loadWorkspaceConfig };

/**
 * Initialize a headless agent workspace directory.
 * @param {import("../../src/worker/headless-types.js").AgentInitOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").AgentInitResult>}
 */
export async function runAgentInit(
  options: AgentInitOptions & Record<string, any> = {},
): Promise<AgentInitResult> {
  let workspace;
  if (options.workspace) {
    workspace = path.resolve(options.workspace);
  } else {
    const baseTmp = path.join(tmpdir(), "shadow-claw");
    await mkdir(baseTmp, { recursive: true });
    workspace = await mkdtemp(path.join(baseTmp, "workspace-"));
  }

  const skillsDir = path.join(workspace, ".agents", "skills");
  const toolsDir = path.join(workspace, ".agents", "tools");
  const dbDir = path.join(workspace, "database");

  await mkdir(workspace, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
  await mkdir(toolsDir, { recursive: true });
  await mkdir(dbDir, { recursive: true });

  let defaultProvider = options.provider;
  let defaultModel = options.model;

  const isDirectTTY = options.stdin
    ? Boolean(options.stdin.isTTY)
    : Boolean(process.stdin.isTTY);
  const hasAlternateTTY =
    !options.stdin &&
    !process.stdin.isTTY &&
    Boolean(process.stderr.isTTY || process.stdout.isTTY);
  const isTTY =
    options.isTTY !== undefined
      ? Boolean(options.isTTY)
      : isDirectTTY || hasAlternateTTY;
  const isCI =
    options.isCI !== undefined
      ? Boolean(options.isCI)
      : options.isTTY !== undefined
        ? false
        : Boolean(
            process.env.CI &&
            !["0", "false"].includes(process.env.CI.toLowerCase()),
          );
  const isInteractive =
    isTTY && !isCI && !options.quiet && !options.yes && !options.y;

  if (!defaultProvider && !defaultModel && isInteractive) {
    const { promptForAgentModel } = await import("../utils/local-models.js");
    const chosen = await promptForAgentModel({
      workspaceDir: workspace,
      contentRoot: process.cwd(),
      cacheDir: options.cacheDir,
      stdin: options.stdin,
      stdout: options.stdout,
      quiet: options.quiet,
      isTTY,
    });
    defaultProvider = chosen.providerId;
    defaultModel = chosen.model;
  }

  if (!defaultProvider) defaultProvider = "transformers_js_local";
  if (!defaultModel) {
    const { DEFAULT_LOCAL_MODEL } = await import("../utils/local-models.js");
    defaultModel =
      defaultProvider === "transformers_js_local"
        ? DEFAULT_LOCAL_MODEL
        : "openrouter/free";
  }

  const existingConfig = await loadWorkspaceConfig(workspace);
  if (!existingConfig) {
    const canonicalConfigPath = path.join(workspace, "shadow-claw.config.json");
    const defaultConfig = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      site: {
        title: "ShadowClaw Agent Workspace",
        description: "Headless CLI agent workspace",
      },
      settings: {
        defaultProvider: "openrouter",
        defaultModel: "openrouter/free",
      },
      agent: {
        defaultProvider,
        defaultModel,
      },
    };
    await writeFile(
      canonicalConfigPath,
      JSON.stringify(defaultConfig, null, 2) + "\n",
      "utf8",
    );
  }

  if (
    options.download &&
    (defaultProvider === "transformers_js_local" ||
      defaultProvider === "llamafile")
  ) {
    const { downloadLocalModel } = await import("../utils/local-models.js");
    await downloadLocalModel(defaultModel, {
      cacheDir: options.cacheDir,
      verbose: options.verbose,
      isTTY: options.isTTY,
    });
  }

  // Initialize SQLite database
  await bootstrapHeadlessAgent({ workspace, quiet: true });

  // Migrate any legacy workspace layout (.agents/skills/main/* -> .agents/skills/*)
  await migrateLegacyWorkspaceLayout(workspace);

  return { success: true, workspace };
}

/**
 * List available skills in the workspace.
 * @param {import("../../src/worker/headless-types.js").AgentSkillsOptions} [options]
 */
export async function runAgentSkills(
  options: AgentSkillsOptions & Record<string, any> = {},
): Promise<any> {
  const workspace = options.workspace || process.cwd();
  const { db, workspaceDir, core } = await bootstrapHeadlessAgent({
    ...options,
    workspace,
  });
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;
  await migrateLegacyWorkspaceLayout(workspaceDir);
  const discovery = await core.discoverSkills(db, groupId);
  const lock = await readSkillsLock(workspaceDir);

  const skills = discovery.skills.map((skill: any) => {
    const lockEntry = lock?.skills?.[skill.name];
    return lockEntry
      ? {
          ...skill,
          lockSource: lockEntry.source,
          lockSourceType: lockEntry.sourceType,
          lockHash: lockEntry.computedHash,
        }
      : skill;
  });

  return {
    skills,
    diagnostics: discovery.diagnostics,
    ...(lock ? { lockfile: lock } : {}),
  };
}

/**
 * Manage workspace skills via `npx skills` with graceful fallback to ShadowClaw's
 * built-in skill management and discovery pipeline.
 */
export async function runAgentSkillsManage(
  subaction: string = "list",
  subargs: string[] = [],
  options: Record<string, any> = {},
): Promise<any> {
  const workspace = options.workspace || process.cwd();
  const action = (subaction || "list").trim().toLowerCase();

  if (action === "list" || action === "ls") {
    const result = await runAgentSkills({ ...options, workspace });
    if (!options.quiet) {
      if (result.skills.length === 0) {
        console.log("No skills found in workspace (.agents/skills/).");
      } else {
        console.log(`Available skills (${result.skills.length}):\n`);
        for (const skill of result.skills) {
          const sourceBadge = skill.lockSource
            ? ` [source: ${skill.lockSource}]`
            : "";
          console.log(
            `  - ${skill.name}${sourceBadge}: ${skill.description || "No description"}`,
          );
        }
      }
    }
    return { success: true, ...result };
  }

  const { workspaceDir } = await bootstrapHeadlessAgent({
    ...options,
    workspace,
    quiet: true,
  });

  if (
    action === "add" ||
    action === "install" ||
    action === "i" ||
    action === "a"
  ) {
    const pkg = subargs[0];
    if (!pkg) {
      const errorMsg =
        "Error: Package or skill source required. Usage: shadow-claw agent skills add <package-or-url>";
      if (!options.quiet) console.error(errorMsg);
      process.exitCode = 1;
      return { success: false, error: errorMsg };
    }

    const extraArgs = subargs.slice(1);
    const shouldTryNpx =
      options.useNpxSkills !== false &&
      (Boolean(options.npxSkillsExecFn) || !options.fetchFn);

    if (shouldTryNpx) {
      const npxArgs = ["add", pkg, "-a", "universal"];
      if (options.yes !== false || options.quiet || !process.stdin.isTTY) {
        if (!extraArgs.includes("-y") && !extraArgs.includes("--yes")) {
          npxArgs.push("-y");
        }
      }
      if (options.skills) {
        const skillFilters = Array.isArray(options.skills)
          ? options.skills
          : String(options.skills)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        if (skillFilters.length > 0) {
          npxArgs.push("--skill", ...skillFilters);
        }
      }
      npxArgs.push(...extraArgs);

      const npxRes = await runNpxSkillsCommand(npxArgs, {
        workspaceDir,
        execFn: options.npxSkillsExecFn,
      });

      if (npxRes.success) {
        if (!options.quiet && npxRes.stdout.trim()) {
          console.log(npxRes.stdout.trim());
        }
        const updated = await runAgentSkills({
          ...options,
          workspace: workspaceDir,
          quiet: true,
        });
        return {
          success: true,
          delegatedToNpxSkills: true,
          skills: updated.skills,
          stdout: npxRes.stdout,
        };
      }
    }

    // Graceful degradation: fall back to ShadowClaw's built-in importer
    const fallbackRes = await runAgentImport(pkg, {
      ...options,
      workspace: workspaceDir,
      useNpxSkills: false,
    });
    const updated = await runAgentSkills({
      ...options,
      workspace: workspaceDir,
      quiet: true,
    });
    return {
      success: fallbackRes.success,
      delegatedToNpxSkills: false,
      fallbackUsed: true,
      skills: updated.skills,
      importResult: fallbackRes,
      ...(fallbackRes.error ? { error: fallbackRes.error } : {}),
    };
  }

  if (
    action === "remove" ||
    action === "rm" ||
    action === "r" ||
    action === "uninstall"
  ) {
    const names = subargs.filter((arg) => !arg.startsWith("-"));
    if (names.length === 0) {
      const errorMsg =
        "Error: Skill name(s) required. Usage: shadow-claw agent skills remove <name...>";
      if (!options.quiet) console.error(errorMsg);
      process.exitCode = 1;
      return { success: false, error: errorMsg };
    }

    if (options.useNpxSkills !== false) {
      await runNpxSkillsCommand(["remove", ...names, "-y"], {
        workspaceDir,
        execFn: options.npxSkillsExecFn,
      });
    }

    const removed: string[] = [];
    for (const name of names) {
      const candidates = [
        path.join(workspaceDir, ".agents", "skills", name),
        path.join(workspaceDir, ".agents", "skills", "main", name),
      ];
      let didRemove = false;
      for (const dir of candidates) {
        try {
          const st = await stat(dir);
          if (st.isDirectory()) {
            await rm(dir, { recursive: true, force: true });
            didRemove = true;
          }
        } catch {}
      }
      const removedLock = await removeFromSkillsLock(workspaceDir, name);
      if (didRemove || removedLock) {
        removed.push(name);
      }
    }

    if (!options.quiet) {
      if (removed.length > 0) {
        console.log(`Removed skill(s): ${removed.join(", ")}`);
      } else {
        console.log(`No matching skills found to remove.`);
      }
    }

    return {
      success: true,
      removed,
    };
  }

  if (action === "init") {
    const skillName = subargs[0] || "my-skill";
    if (options.useNpxSkills === true && options.npxSkillsExecFn) {
      const npxRes = await runNpxSkillsCommand(["init", skillName], {
        workspaceDir,
        execFn: options.npxSkillsExecFn,
      });
      if (npxRes.success) {
        return {
          success: true,
          name: skillName,
          delegatedToNpxSkills: true,
        };
      }
    }

    try {
      const created = await initSkillTemplate(workspaceDir, skillName, {
        description: options.description,
        flat: options.flat !== false,
      });
      if (!options.quiet) {
        console.log(`Initialized skill "${created.name}" at ${created.path}`);
      }
      return {
        success: true,
        ...created,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!options.quiet) console.error(`Error: ${errorMsg}`);
      process.exitCode = 1;
      return { success: false, error: errorMsg };
    }
  }

  if (action === "sync") {
    if (options.useNpxSkills !== false && options.npxSkillsExecFn) {
      await runNpxSkillsCommand(["experimental_sync", "-y"], {
        workspaceDir,
        execFn: options.npxSkillsExecFn,
      });
    }
    const migRes = await migrateLegacySkills(workspaceDir, {
      overwrite: Boolean(options.overwrite),
    });
    if (!options.quiet) {
      console.log(`Synced skills (migrated: ${migRes.migratedSkills.length}).`);
    }
    return {
      success: true,
      ...migRes,
      syncedToFlat: migRes.migratedSkills,
      syncedToMain: [],
    };
  }

  if (
    action === "find" ||
    action === "search" ||
    action === "f" ||
    action === "s"
  ) {
    const query = subargs.join(" ").trim() || options.query || "";
    const shouldTryNpx =
      options.useNpxSkills !== false &&
      (Boolean(options.npxSkillsExecFn) || !options.fetchFn);

    if (shouldTryNpx && query) {
      const npxRes = await runNpxSkillsCommand(["find", query], {
        workspaceDir,
        execFn: options.npxSkillsExecFn,
      });
      if (npxRes.success) {
        if (!options.quiet && npxRes.stdout.trim()) {
          console.log(npxRes.stdout.trim());
        }
        return {
          success: true,
          delegatedToNpxSkills: true,
          stdout: npxRes.stdout,
          results: [],
        };
      }
    }

    // Graceful degradation: search skills.sh HTTP API directly
    const fetchFn = options.fetchFn || globalThis.fetch;
    try {
      const searchUrl = `https://skills.sh/api/search?q=${encodeURIComponent(query)}&limit=10`;
      const res = await fetchFn(searchUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        skills?: Array<{
          id: string;
          name: string;
          source: string;
          installs?: number;
        }>;
      };
      const results = (data.skills || []).map((s) => ({
        name: s.name,
        package: `${s.source || s.id}@${s.name}`,
        source: s.source || s.id,
        installs: s.installs || 0,
      }));
      if (!options.quiet) {
        if (results.length === 0) {
          console.log(`No skills found for "${query}".`);
        } else {
          console.log(`Found ${results.length} skill(s):\n`);
          for (const item of results) {
            console.log(`  - ${item.package} (${item.installs} installs)`);
          }
        }
      }
      return {
        success: true,
        delegatedToNpxSkills: false,
        results,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!options.quiet) console.error(`Error searching skills: ${errorMsg}`);
      return { success: false, error: errorMsg, results: [] };
    }
  }

  if (
    action === "update" ||
    action === "up" ||
    action === "check" ||
    action === "restore" ||
    action === "experimental_install"
  ) {
    const npxSub =
      action === "restore"
        ? "experimental_install"
        : action === "up"
          ? "update"
          : action;
    const npxRes = await runNpxSkillsCommand([npxSub, ...subargs], {
      workspaceDir,
      execFn: options.npxSkillsExecFn,
    });
    if (npxRes.success) {
      if (!options.quiet && npxRes.stdout.trim()) {
        console.log(npxRes.stdout.trim());
      }
      return {
        success: true,
        delegatedToNpxSkills: true,
        stdout: npxRes.stdout,
      };
    }

    // Fallback for restore using skills-lock.json
    if (action === "restore" || action === "experimental_install") {
      const lock = await readSkillsLock(workspaceDir);
      if (lock && Object.keys(lock.skills).length > 0) {
        let importedCount = 0;
        for (const [skillName, rawEntry] of Object.entries(lock.skills)) {
          const entry = rawEntry as {
            sourceType?: string;
            source?: string;
            sourceUrl?: string;
          };
          const sourceSpec =
            entry?.sourceType === "github"
              ? `${entry.source}@${skillName}`
              : entry?.sourceUrl || entry?.source;
          if (!sourceSpec) continue;
          const imp = await runAgentImport(sourceSpec, {
            ...options,
            workspace: workspaceDir,
            useNpxSkills: false,
            quiet: true,
          });
          if (imp.success) importedCount += imp.importedCount || 0;
        }
        return {
          success: true,
          delegatedToNpxSkills: false,
          fallbackUsed: true,
          importedCount,
        };
      }
    }

    return {
      success: false,
      error: npxRes.error || `Failed to run npx skills ${npxSub}`,
    };
  }

  const errorMsg = `Unknown skills subcommand "${subaction}". Available: list, add, remove, find, init, sync, update, check, restore`;
  if (!options.quiet) console.error(errorMsg);
  process.exitCode = 1;
  return { success: false, error: errorMsg };
}

/**
 * List available tools and their headless capability status.
 * @param {import("../../src/worker/headless-types.js").AgentToolsOptions} [options]
 */
export async function runAgentTools(
  options: AgentToolsOptions & Record<string, any> = {},
): Promise<any> {
  const { db, core } = await bootstrapHeadlessAgent(options);
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;

  let profileToolNames: Set<string> | null = null;
  if (options.toolsProfile || options.profile) {
    const target = String(options.toolsProfile || options.profile)
      .trim()
      .toLowerCase();
    const defaultBuiltinProfile = core.DEFAULT_BUILTIN_PROFILE || null;
    let dbProfiles: any[] = [];
    if (typeof core.getConfig === "function") {
      try {
        const raw = await core.getConfig(
          db,
          core.CONFIG_KEYS?.TOOL_PROFILES || "tool_profiles",
        );
        if (typeof raw === "string") dbProfiles = JSON.parse(raw);
        else if (Array.isArray(raw)) dbProfiles = raw;
      } catch {}
    }
    const allProfiles = [defaultBuiltinProfile, ...dbProfiles].filter(Boolean);
    const matched = allProfiles.find(
      (p) =>
        (p.id && String(p.id).toLowerCase() === target) ||
        (p.name && String(p.name).toLowerCase() === target),
    );
    if (matched) {
      profileToolNames = new Set(matched.enabledToolNames || []);
    }
  }

  const allTools = [...(core.TOOL_DEFINITIONS || [])];
  if (typeof core.loadDeclarativeTools === "function") {
    try {
      const decl = await core.loadDeclarativeTools(db, groupId);
      if (decl && Array.isArray(decl.tools)) {
        for (const dt of decl.tools) {
          if (!allTools.some((t) => t.name === dt.name)) {
            allTools.push(dt);
          }
        }
      }
    } catch {}
  }

  const tools = allTools.map((def) => ({
    name: def.name,
    description: def.description,
    headlessSafe: !BROWSER_ONLY_TOOLS.has(def.name),
    ...(profileToolNames ? { enabled: profileToolNames.has(def.name) } : {}),
  }));

  return { tools };
}

/**
 * Inspect a tool definition or directly execute a tool in the workspace.
 * @param {string} toolName
 * @param {Record<string, any> | string} [inputArg]
 * @param {import("../../src/worker/headless-types.js").AgentToolOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").AgentToolResult>}
 */
export async function runAgentTool(
  toolName: string,
  inputArg?: any,
  options: AgentToolOptions & Record<string, any> = {},
): Promise<AgentToolResult> {
  const { db, workspaceDir, core } = await bootstrapHeadlessAgent(options);
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;

  // Find tool in built-in TOOL_DEFINITIONS or declarative tools
  let toolDef = (core.TOOL_DEFINITIONS || []).find(
    (t: any) => t.name === toolName,
  );

  if (!toolDef && typeof core.loadDeclarativeTools === "function") {
    try {
      const decl = await core.loadDeclarativeTools(db, groupId);
      toolDef = decl.tools.find((t: any) => t.name === toolName);
    } catch {}
  }

  if (!toolDef) {
    const errorMsg = `Error: Tool "${toolName}" not found.`;
    if (!options.quiet) {
      console.error(errorMsg);
    }
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }

  const headlessSafe = !BROWSER_ONLY_TOOLS.has(toolDef.name);

  // Resolve raw input: CLI arg → options.input → pre-read stdin → undefined (inspect mode)
  let rawInput = inputArg ?? options.input;

  // If the arg is "-" treat it as "read from stdin"
  if (rawInput === "-") rawInput = undefined;

  // If no input yet, check for pre-read stdin data (_stdinData is set by runAgentCommand)
  if (
    (rawInput === undefined || rawInput === null) &&
    options._stdinData != null
  ) {
    const piped = options._stdinData;
    // Try to parse as JSON; if not valid JSON, map as plain text
    let parsed;
    try {
      parsed = JSON.parse(piped);
    } catch {
      parsed = mapTextToToolInput(piped, toolDef.input_schema);
    }
    rawInput = parsed;
  }

  if (rawInput !== undefined && rawInput !== null) {
    let parsedInput = {};
    if (typeof rawInput === "string") {
      try {
        parsedInput = JSON.parse(rawInput);
      } catch (err: any) {
        const errorMsg = `Error: Failed to parse input JSON: ${err.message}`;
        if (!options.quiet) {
          console.error(errorMsg);
        }
        process.exitCode = 1;
        return { success: false, error: errorMsg };
      }
    } else if (typeof rawInput === "object") {
      parsedInput = rawInput;
    }

    let invokeContext: any = undefined;
    try {
      const resolved = await resolveAgentProvider(db, core, workspaceDir, {
        ...options,
        interactive: false,
      });
      invokeContext = {
        db,
        provider: resolved.providerId,
        model: resolved.model,
        apiKey: resolved.apiKey,
      };
    } catch {}

    try {
      const output = await core.executeTool(
        db,
        toolName,
        parsedInput,
        groupId,
        {
          invokeContext,
        },
      );
      const outputText =
        typeof output === "string" ? output : JSON.stringify(output, null, 2);

      if (options.output) {
        await writeFile(path.resolve(options.output), outputText, "utf8");
        if (!options.quiet) {
          process.stderr.write(`Output written to ${options.output}\n`);
        }
      } else if (!options.quiet) {
        process.stdout.write(outputText + "\n");
      }
      return {
        success: true,
        tool: toolDef,
        headlessSafe,
        output,
      };
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!options.quiet) {
        console.error(`Error executing tool "${toolName}": ${errorMsg}`);
      }
      process.exitCode = 1;
      return { success: false, error: errorMsg };
    }
  }

  // Otherwise, inspect and display the tool definition and schema
  if (!options.quiet) {
    const tag = headlessSafe ? "[headless-safe]" : "[browser-only]";
    console.log(`Tool: ${toolDef.name} ${tag}\n`);
    console.log(`Description:\n  ${toolDef.description}\n`);
    if (toolDef.input_schema) {
      console.log(`Parameters (JSON Schema):`);
      console.log(JSON.stringify(toolDef.input_schema, null, 2));
      console.log();
    }
    console.log(`Usage:`);
    console.log(
      `  Direct CLI:   npx shadow-claw agent tool ${toolDef.name} '<json-input>'`,
    );
    console.log(
      `  Pipe input:   echo '<text>' | npx shadow-claw agent tool ${toolDef.name}`,
    );
    console.log(`  Agent Prompt: npx shadow-claw agent run "<instruction>"\n`);
  }

  return {
    success: true,
    tool: toolDef,
    headlessSafe,
  };
}

/**
 * Delete all stored messages for a conversation group.
 */
export async function runAgentClear(
  options: Record<string, any> = {},
): Promise<{ success: boolean; groupId: string }> {
  const { db, core } = await bootstrapHeadlessAgent(options);
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;
  const { clearGroupMessages } =
    await import("../../db/clear-group-messages.js");

  await clearGroupMessages(db, groupId);

  if (!options.quiet) {
    console.log(`Cleared conversation history for group "${groupId}".`);
  }

  return { success: true, groupId };
}

/**
 * Execute a skill by name directly via its declarative tool chain.
 * @param {string} skillName
 * @param {import("../../src/worker/headless-types.js").AgentSkillOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").AgentSkillResult>}
 */
export async function runAgentSkill(
  skillName: string,
  options: AgentSkillOptions & Record<string, any> = {},
): Promise<AgentSkillResult> {
  const { db, core } = await bootstrapHeadlessAgent(options);
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;

  const skill = await core.loadSkill(db, groupId, skillName);
  if (!skill) {
    throw new Error(`Skill "${skillName}" not found in workspace.`);
  }

  if (
    skill.execution?.type === "tools" &&
    Array.isArray(skill.execution.tools)
  ) {
    const normalizedTools = skill.execution.tools.map((t: any) => ({
      name: t.name || t.tool,
      input: t.input || t.arguments || {},
      suppressOutput: t.suppressOutput,
    }));

    const chainResult = await core.executeToolChain(
      db,
      groupId,
      normalizedTools,
      {
        isManual: true,
      },
    );

    return {
      success: true,
      skill,
      results: chainResult.results,
      rawOutputs: chainResult.rawOutputs,
    };
  }

  return {
    success: true,
    skill,
    message: `Skill "${skillName}" loaded (no declarative tools defined).`,
  };
}

/**
 * Resolve active LLM provider, configuration, API key, and model for headless agent.
 * @param {any} db
 * @param {any} core
 * @param {string} workspaceDir
 * @param {Record<string, any>} [options]
 */
export async function resolveAgentProvider(
  db: any,
  core: any,
  workspaceDir: string,
  options: any = {},
): Promise<any> {
  // Headless runs use an isolated sandbox workspace, so fall back to cwd for config.
  const contentRoot = options.contentRoot ?? process.cwd();
  const workspaceConfigData = await loadWorkspaceConfig(
    workspaceDir,
    contentRoot,
  );
  const workspaceConfig = workspaceConfigData?.config || {};
  const workspaceSettings = workspaceConfig.settings || {};
  const workspaceAgent = workspaceConfig.agent || workspaceSettings.agent || {};

  // 1. Resolve Provider
  let providerId =
    options.provider ||
    process.env.SHADOW_CLAW_PROVIDER ||
    process.env.SHADOW_CLAW_DEFAULT_PROVIDER;

  if (!providerId && typeof core.getConfig === "function") {
    providerId = await core.getConfig(
      db,
      core.CONFIG_KEYS?.PROVIDER || "provider",
    );
  }

  if (!providerId && options.model) {
    const { isLlamafile, isAgentfile } =
      await import("../utils/local-models.js");
    if (isAgentfile(options.model)) {
      providerId = "agentfile";
    } else if (isLlamafile(options.model)) {
      providerId = "llamafile";
    } else if (/onnx/i.test(options.model)) {
      providerId = "transformers_js_local";
    }
  }

  if (!providerId) {
    providerId =
      workspaceAgent.defaultProvider ||
      workspaceAgent.provider ||
      workspaceSettings.defaultProvider ||
      workspaceSettings.provider ||
      workspaceConfig.defaultProvider;
  }

  const isDirectTTY = options.stdin
    ? Boolean(options.stdin.isTTY)
    : Boolean(process.stdin.isTTY);
  const hasAlternateTTY =
    !options.stdin &&
    !process.stdin.isTTY &&
    Boolean(process.stderr.isTTY || process.stdout.isTTY);
  const isTTY =
    options.isTTY !== undefined
      ? Boolean(options.isTTY)
      : isDirectTTY || hasAlternateTTY;
  const isCI =
    options.isCI !== undefined
      ? Boolean(options.isCI)
      : options.isTTY !== undefined
        ? false
        : Boolean(
            process.env.CI &&
            !["0", "false"].includes(process.env.CI.toLowerCase()),
          );
  const isInteractive =
    isTTY && !isCI && !options.quiet && options.interactive !== false;

  if (!providerId) {
    if (isInteractive) {
      const { promptForAgentModel } = await import("../utils/local-models.js");
      const chosen = await promptForAgentModel({
        workspaceDir,
        contentRoot,
        cacheDir: options.cacheDir,
        stdin: options.stdin,
        stdout: options.stdout,
        quiet: options.quiet,
        isTTY,
        service: options._transformersService,
      });
      providerId = chosen.providerId;
      options.model = chosen.model;
    } else {
      providerId = "openrouter";
    }
  }

  let providerConfig =
    typeof core.getProvider === "function"
      ? core.getProvider(providerId)
      : null;

  if (!providerConfig) {
    const errorMsg = `Error: Unknown provider "${providerId}".`;
    throw new Error(errorMsg);
  }

  // 2. Resolve API Key
  let apiKey;
  if (options.apiKey !== undefined) {
    apiKey = options.apiKey;
  } else {
    apiKey = process.env.SHADOW_CLAW_API_KEY;
    if (!apiKey) {
      switch (providerId) {
        case "openrouter":
          apiKey = process.env.OPENROUTER_API_KEY;
          break;
        case "huggingface":
          apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
          break;
        case "gemini_proxy":
          apiKey = process.env.GEMINI_API_KEY;
          break;
      }
    }

    if (!apiKey && typeof core.getConfig === "function") {
      apiKey =
        (await core.getConfig(db, `api_key:${providerId}`)) ||
        (await core.getConfig(db, "apiKey"));
    }
  }

  // 3. Resolve Model
  const model =
    options.model ||
    process.env.SHADOW_CLAW_MODEL ||
    process.env.SHADOW_CLAW_DEFAULT_MODEL ||
    (typeof core.getConfig === "function"
      ? await core.getConfig(db, core.CONFIG_KEYS?.MODEL || "model")
      : null) ||
    workspaceAgent.defaultModel ||
    workspaceAgent.model ||
    workspaceSettings.defaultModel ||
    workspaceSettings.model ||
    workspaceConfig.defaultModel ||
    providerConfig?.defaultModel ||
    (providerId === "transformers_js_local"
      ? (await import("../utils/local-models.js")).DEFAULT_LOCAL_MODEL
      : "default");

  // 4. Ensure model is downloaded if transformers_js_local, llamafile, or agentfile
  if (
    providerId === "transformers_js_local" ||
    providerId === "llamafile" ||
    providerId === "agentfile"
  ) {
    const { isModelLocallyCached, downloadLocalModel } =
      await import("../utils/local-models.js");
    const cacheDir =
      options.cacheDir ||
      workspaceAgent.cacheDir ||
      workspaceConfig.cacheDir ||
      workspaceSettings.cacheDir;
    const isCached =
      isModelLocallyCached(model, cacheDir) ||
      (workspaceDir && isModelLocallyCached(model, workspaceDir));
    if (!isCached) {
      const outStream = options.stdout || process.stderr;
      const shouldDownload = Boolean(
        options.download || options.yes || options.y,
      );
      if (shouldDownload) {
        if (!options.quiet) {
          outStream.write(`\nDownloading ${model} from Hugging Face...\n`);
        }
        await downloadLocalModel(model, {
          cacheDir: cacheDir || options.cacheDir,
          stream: outStream,
          isTTY,
          service: options._transformersService,
          progress: options.quiet
            ? false
            : options.progress !== false && !options.noProgress,
          quiet: options.quiet,
          verbose: options.verbose,
        });
      } else if (isInteractive) {
        const readline = await import("node:readline/promises");
        const tty = await import("node:tty");
        const fs = await import("node:fs");

        let input = options.stdin || process.stdin;
        let output = outStream;
        let closeInputOnFinish = false;
        let ttyFd: number | null = null;

        if (input === process.stdin && !process.stdin.isTTY) {
          if (
            !process.env.CI &&
            (process.stderr.isTTY || process.stdout.isTTY)
          ) {
            try {
              const ttyDevice =
                process.platform === "win32" ? "CONIN$" : "/dev/tty";
              ttyFd = fs.openSync(ttyDevice, "r");
              input = new tty.ReadStream(ttyFd);
              output = process.stderr.isTTY ? process.stderr : process.stdout;
              closeInputOnFinish = true;
            } catch (_) {
              try {
                const ttyDevice =
                  process.platform === "win32" ? "CONIN$" : "/dev/tty";
                input = fs.createReadStream(ttyDevice);
                output = process.stderr.isTTY ? process.stderr : process.stdout;
                closeInputOnFinish = true;
              } catch (_) {}
            }
          }
        }

        const rl = readline.createInterface({
          input,
          output,
        });

        let exited = false;
        const handleSigint = () => {
          if (exited) return;
          exited = true;
          output.write("\nOperation cancelled.\n");
          try {
            rl.close();
          } catch (_) {}
          if (typeof options.onExit === "function") {
            options.onExit(130);
          } else {
            process.exit(130);
          }
        };

        rl.on("SIGINT", handleSigint);
        if (
          input &&
          typeof input.on === "function" &&
          input !== process.stdin
        ) {
          input.on("SIGINT", handleSigint);
        }
        const processSigintListener = () => handleSigint();
        process.on("SIGINT", processSigintListener);

        const dataListener = (chunk: any) => {
          const str =
            typeof chunk === "string" ? chunk : chunk.toString("binary");
          if (str.includes("\x03") || str.includes("\x04")) {
            handleSigint();
          }
        };
        if (input && typeof input.on === "function") {
          input.on("data", dataListener);
        }

        let answer = "";
        try {
          answer = (
            await rl.question(
              `\nModel "${model}" is not yet downloaded to local disk.\nDownload model weights now? (Y/n) [default: Y]: `,
            )
          )
            .trim()
            .toLowerCase();
        } finally {
          process.removeListener("SIGINT", processSigintListener);
          if (input && typeof input.removeListener === "function") {
            if (input !== process.stdin) {
              input.removeListener("SIGINT", handleSigint);
            }
            input.removeListener("data", dataListener);
          }
          try {
            rl.close();
          } catch (_) {}
          if (closeInputOnFinish) {
            if (input && typeof input.destroy === "function") {
              try {
                input.destroy();
              } catch (_) {}
            }
            if (ttyFd != null) {
              try {
                fs.closeSync(ttyFd);
              } catch (_) {}
            }
          }
        }

        if (answer === "" || answer === "y" || answer === "yes") {
          if (!options.quiet) {
            outStream.write(`\nDownloading ${model} from Hugging Face...\n`);
          }
          await downloadLocalModel(model, {
            cacheDir: cacheDir || options.cacheDir,
            stream: outStream,
            isTTY,
            service: options._transformersService,
            progress: options.quiet
              ? false
              : options.progress !== false && !options.noProgress,
            quiet: options.quiet,
            verbose: options.verbose,
          });
        } else {
          throw new Error(
            `Model "${model}" is not downloaded. Download aborted.`,
          );
        }
      } else {
        throw new Error(
          `Model "${model}" is not downloaded. Run with --download or --yes to download model weights automatically.`,
        );
      }
    }
  }

  const customBaseUrl =
    options.baseUrl ||
    options.providerBaseUrl ||
    workspaceAgent?.baseUrl ||
    workspaceSettings?.baseUrl ||
    workspaceSettings?.providerBaseUrl;
  if (customBaseUrl && providerConfig) {
    providerConfig = { ...providerConfig, baseUrl: customBaseUrl };
  }

  return {
    providerId,
    providerConfig,
    apiKey: apiKey || "",
    model,
    workspaceConfigData,
    workspaceConfig,
    workspaceSettings,
    workspaceAgent,
  };
}

/**
 * Helper to resolve available tools and profiles for headless agent execution.
 */
async function resolveToolsAndProfile(
  db: any,
  core: any,
  groupId: string,
  workspaceConfig: any,
  workspaceSettings: any,
  workspaceAgent: any,
  options: any,
): Promise<{
  enabledTools: any[];
  profileSystemPromptOverride: string | null;
}> {
  // 1. Gather all available tools (built-in + declarative)
  const allTools = [...(core.TOOL_DEFINITIONS || [])];
  if (typeof core.loadDeclarativeTools === "function") {
    try {
      const decl = await core.loadDeclarativeTools(db, groupId);
      if (decl && Array.isArray(decl.tools)) {
        for (const dt of decl.tools) {
          if (!allTools.some((t) => t.name === dt.name)) {
            allTools.push(dt);
          }
        }
      }
    } catch {}
  }

  const allAvailableTools = allTools.filter(
    (t) => !BROWSER_ONLY_TOOLS.has(t.name),
  );

  let enabledTools = allAvailableTools;
  let profileSystemPromptOverride = null;

  async function getKnownProfiles() {
    const defaultBuiltinProfile = core.DEFAULT_BUILTIN_PROFILE || null;

    let dbProfiles: any[] = [];
    if (typeof core.getConfig === "function") {
      try {
        const raw = await core.getConfig(
          db,
          core.CONFIG_KEYS?.TOOL_PROFILES || "tool_profiles",
        );
        if (typeof raw === "string") {
          dbProfiles = JSON.parse(raw);
        } else if (Array.isArray(raw)) {
          dbProfiles = raw;
        }
      } catch {}
    }

    const configProfiles =
      workspaceConfig?.toolProfiles ||
      workspaceSettings?.toolProfiles ||
      workspaceConfig?.profiles ||
      [];

    return [defaultBuiltinProfile, ...dbProfiles, ...configProfiles].filter(
      Boolean,
    );
  }

  // 2. Check --no-tools / disabled tools
  const disableTools =
    options.noTools === true ||
    options.tools === false ||
    options.tools === "none" ||
    options.tools === "";

  if (disableTools) {
    enabledTools = [];
    return { enabledTools, profileSystemPromptOverride };
  }

  // 3. Check explicit tools list from CLI
  if (options.tools !== undefined && options.tools !== null) {
    const requestedNames = (
      Array.isArray(options.tools)
        ? options.tools
        : String(options.tools).split(",")
    )
      .map((t: unknown) => String(t).trim())
      .filter(Boolean);

    enabledTools = requestedNames
      .map((name: unknown) =>
        allAvailableTools.find((t) => t.name === String(name)),
      )
      .filter(Boolean);
    return { enabledTools, profileSystemPromptOverride };
  }

  // 4. Check explicit toolsProfile from CLI
  if (options.toolsProfile) {
    const profiles = await getKnownProfiles();
    const target = String(options.toolsProfile).trim().toLowerCase();
    const matched = profiles.find(
      (p) =>
        (p.id && String(p.id).toLowerCase() === target) ||
        (p.name && String(p.name).toLowerCase() === target),
    );

    if (!matched) {
      throw new Error(
        `Error: Tool profile "${options.toolsProfile}" not found.`,
      );
    }

    const enabledNames = new Set(matched.enabledToolNames || []);
    enabledTools = allAvailableTools.filter((t) => enabledNames.has(t.name));
    if (matched.customTools && Array.isArray(matched.customTools)) {
      for (const ct of matched.customTools) {
        if (
          !BROWSER_ONLY_TOOLS.has(ct.name) &&
          !enabledTools.some((t) => t.name === ct.name)
        ) {
          enabledTools.push(ct);
        }
      }
    }
    if (matched.systemPromptOverride) {
      profileSystemPromptOverride = matched.systemPromptOverride;
    }
    return { enabledTools, profileSystemPromptOverride };
  }

  // 5. Check workspace config (shadow-claw.config.json)
  const configTools = workspaceAgent?.tools ?? workspaceAgent?.enabledTools;
  if (configTools !== undefined && configTools !== null) {
    if (configTools === false || configTools === "none" || configTools === "") {
      enabledTools = [];
      return { enabledTools, profileSystemPromptOverride };
    }
    const requestedNames = (
      Array.isArray(configTools) ? configTools : String(configTools).split(",")
    )
      .map((t) => String(t).trim())
      .filter(Boolean);
    enabledTools = requestedNames
      .map((name) => allAvailableTools.find((t) => t.name === name))
      .filter(Boolean);
    return { enabledTools, profileSystemPromptOverride };
  }

  const configProfile =
    workspaceAgent?.toolsProfile || workspaceAgent?.defaultToolsProfile;
  if (configProfile) {
    const profiles = await getKnownProfiles();
    const target = String(configProfile).trim().toLowerCase();
    const matched = profiles.find(
      (p) =>
        (p.id && String(p.id).toLowerCase() === target) ||
        (p.name && String(p.name).toLowerCase() === target),
    );
    if (matched) {
      const enabledNames = new Set(matched.enabledToolNames || []);
      enabledTools = allAvailableTools.filter((t) => enabledNames.has(t.name));
      if (matched.systemPromptOverride) {
        profileSystemPromptOverride = matched.systemPromptOverride;
      }
      return { enabledTools, profileSystemPromptOverride };
    }
  }

  return { enabledTools, profileSystemPromptOverride };
}

/**
 * Execute a prompt in headless agent mode.
 * @param {string} [prompt]
 * @param {import("../../src/worker/headless-types.js").AgentRunOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").AgentRunResult>}
 */
export async function runAgentRun(
  prompt?: string,
  options: AgentRunOptions & Record<string, any> = {},
): Promise<AgentRunResult> {
  const { db, workspaceDir, core } = await bootstrapHeadlessAgent(options);
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;

  // Stdin support: use pre-read stdin data (_stdinData injected by runAgentCommand or caller)
  const piped = options._stdinData ?? null;
  if (prompt === "-") {
    // "-" means: use only stdin as the prompt
    prompt = piped || "";
  } else if (piped) {
    // Both CLI prompt and piped data: combine them
    prompt = prompt ? `${prompt}\n\n${piped}` : piped;
  }

  if (!prompt) {
    const errorMsg =
      "Error: Prompt required. Provide a prompt argument or pipe text to stdin.";
    if (!options.quiet) console.error(errorMsg);
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }

  let attachments: any[] = [];
  const attachmentByteMap = new Map<string, Uint8Array>();
  try {
    const loaded = await loadCliAttachments(normalizeFileOption(options.file));
    for (const item of loaded) {
      if (item.source?.kind === "local-file") {
        const arrayBuf = await item.source.file.arrayBuffer();
        attachmentByteMap.set(item.fileName, new Uint8Array(arrayBuf));
      }
    }
    attachments = await persistMessageAttachments(db, groupId, loaded);
    for (const att of attachments) {
      if (att.path && attachmentByteMap.has(att.fileName)) {
        attachmentByteMap.set(att.path, attachmentByteMap.get(att.fileName)!);
      }
    }
  } catch (err: any) {
    if (!options.quiet) console.error(err.message);
    process.exitCode = 1;
    return { success: false, error: err.message };
  }

  let providerId,
    providerConfig,
    apiKey,
    model,
    workspaceConfigData,
    workspaceConfig,
    workspaceSettings,
    workspaceAgent;
  try {
    const resolved = await resolveAgentProvider(
      db,
      core,
      workspaceDir,
      options,
    );
    providerId = resolved.providerId;
    providerConfig = resolved.providerConfig;
    apiKey = resolved.apiKey;
    model = resolved.model;
    workspaceConfigData = resolved.workspaceConfigData;
    workspaceConfig = resolved.workspaceConfig;
    workspaceSettings = resolved.workspaceSettings;
    workspaceAgent = resolved.workspaceAgent;
  } catch (err: any) {
    if (!options.quiet) {
      console.error(err.message);
    }
    process.exitCode = 1;
    return { success: false, error: err.message };
  }

  const declaredInternetAccess =
    options.internetAccess ??
    options.allowInternet ??
    workspaceSettings?.internetAccess ??
    workspaceSettings?.vm_bash_full_internet_access ??
    workspaceSettings?.fullInternetAccess ??
    workspaceConfig?.internetAccess;

  if (
    declaredInternetAccess !== undefined &&
    typeof core.setConfig === "function"
  ) {
    const internetAccessKey =
      core.CONFIG_KEYS?.VM_BASH_FULL_INTERNET_ACCESS ||
      "vm_bash_full_internet_access";
    await core.setConfig(
      db,
      internetAccessKey,
      declaredInternetAccess ? "true" : "false",
    );
  }

  const requiresApiKey = providerConfig.requiresApiKey !== false;
  if (requiresApiKey && !apiKey) {
    const envVar =
      providerId === "huggingface"
        ? "HUGGINGFACE_API_KEY"
        : `${providerId.toUpperCase()}_API_KEY`;
    const errorMsg =
      `Error: Provider "${providerId}" requires an API key, but none was provided.\n` +
      `Please provide an API key via --api-key <key> or export ${envVar}="...".`;
    if (!options.quiet) {
      console.error(errorMsg);
    }
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }

  // 4. Load recent message history
  let history: any[] = [];
  if (
    options.history !== false &&
    typeof core.getRecentMessages === "function"
  ) {
    try {
      const rawHistory = await core.getRecentMessages(db, groupId, 50);
      history = await Promise.all(
        rawHistory.map(async (msg: any) => {
          if (
            msg?.role === "user" &&
            Array.isArray(msg?.attachments) &&
            msg.attachments.length > 0
          ) {
            const blocks = await buildAttachmentContentBlocks(
              msg.attachments,
              async (att) => {
                if (att.path && db) {
                  try {
                    return await readGroupFileBytes(db, groupId, att.path);
                  } catch {}
                }
                return null;
              },
            );
            if (blocks.length > 0) {
              const text = typeof msg.content === "string" ? msg.content : "";
              return {
                ...msg,
                content: text ? [{ type: "text", text }, ...blocks] : blocks,
              };
            }
          }
          return msg;
        }),
      );
    } catch {}
  }

  const userMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    groupId,
    role: "user",
    sender: "user",
    channel: "chat",
    isFromMe: false,
    isTrigger: true,
    content: prompt,
    timestamp: Date.now(),
    ...(attachments.length > 0 ? { attachments } : {}),
  };

  if (typeof core.saveMessage === "function") {
    try {
      await core.saveMessage(db, userMessage);
    } catch {}
  }

  let invokeUserMessage: any = userMessage;
  if (attachments.length > 0) {
    const blocks = await buildAttachmentContentBlocks(
      attachments,
      async (att) => {
        if (att.path && attachmentByteMap.has(att.path)) {
          return attachmentByteMap.get(att.path)!;
        }
        if (attachmentByteMap.has(att.fileName)) {
          return attachmentByteMap.get(att.fileName)!;
        }
        if (att.path && db) {
          try {
            return await readGroupFileBytes(db, groupId, att.path);
          } catch {}
        }
        return null;
      },
    );
    if (blocks.length > 0) {
      invokeUserMessage = {
        ...userMessage,
        content: prompt ? [{ type: "text", text: prompt }, ...blocks] : blocks,
      };
    }
  }

  const supportsStreaming = providerConfig?.supportsStreaming === true;
  const allowStreaming =
    options.stream !== false &&
    options.streaming !== false &&
    !options.noStream;
  const isStreaming = supportsStreaming && allowStreaming;

  const maxTokens =
    Number(options.maxTokens) ||
    (typeof core.getModelMaxTokens === "function"
      ? core.getModelMaxTokens(model)
      : core.DEFAULT_MAX_TOKENS || 8192);

  if (options.verbose && !options.quiet) {
    const providerName = providerConfig?.name || providerId;
    const streamLabel = isStreaming ? "streaming" : "standard";
    process.stderr.write(
      `[Agent] Connecting to ${providerName} (${model}) [${streamLabel}]...\n`,
    );
    process.stderr.write(
      `[Agent] Workspace: ${workspaceDir}\n[Agent] Group: ${groupId}\n[Agent] Max tokens: ${maxTokens}\n`,
    );
  }

  // 5. Setup postHandler capture
  let capturedResponse: string | undefined = undefined;
  let capturedError: string | undefined = undefined;
  let hasStreamedChunks = false;
  let capturedStreamedText = "";
  const pendingWrites: Promise<void>[] = [];

  core.setPostHandler(async (message: any) => {
    const messageHandlers: Record<string, (msg: any) => void> = {
      "streaming-start": () => {
        hasStreamedChunks = true;
      },
      "streaming-chunk": (msg) => {
        if (msg.payload?.text) {
          hasStreamedChunks = true;
          capturedStreamedText += msg.payload.text;
          capturedResponse = (capturedResponse || "") + msg.payload.text;
          if (!options.quiet && !options.output) {
            process.stdout.write(msg.payload.text);
          }
        }
      },
      "streaming-done": () => {},
      "streaming-end": () => {
        hasStreamedChunks = false;
        capturedStreamedText = "";
      },
      response: (msg) => {
        if (msg.payload?.text) {
          capturedResponse = msg.payload.text;
          if (options.output) {
            const writePromise = writeFile(
              path.resolve(options.output),
              msg.payload.text,
              "utf8",
            )
              .then(() => {
                if (!options.quiet) {
                  process.stderr.write(`Output written to ${options.output}\n`);
                }
              })
              .catch(() => {});
            pendingWrites.push(writePromise);
          } else if (!options.quiet) {
            const streamedMatchesResponse =
              hasStreamedChunks &&
              typeof capturedStreamedText === "string" &&
              capturedStreamedText.trim() === msg.payload.text.trim();

            if (streamedMatchesResponse) {
              if (!msg.payload.text.endsWith("\n")) {
                process.stdout.write("\n");
              }
            } else {
              process.stdout.write(msg.payload.text + "\n");
            }
          }
        }
      },
      "intermediate-response": (msg) => {
        if (options.verbose && !options.quiet && msg.payload?.text) {
          process.stderr.write(`[Thought] ${msg.payload.text}\n`);
        }
      },
      error: (msg) => {
        if (msg.payload?.error) {
          capturedError = msg.payload.error;
          if (!options.quiet) {
            console.error(`Error: ${msg.payload.error}`);
          }
        }
      },
      "tool-activity": (msg) => {
        if (options.verbose && !options.quiet && msg.payload) {
          const toolName = msg.payload.tool || "tool";
          const status = msg.payload.status || "executing";
          process.stderr.write(`[Tool] ${toolName} (${status})\n`);
        }
      },
      "thinking-log": (msg) => {
        if (options.verbose && !options.quiet && msg.payload) {
          const label = msg.payload.label || msg.payload.level || "Log";
          process.stderr.write(`[${label}] ${msg.payload.message || ""}\n`);
        }
      },
      status: (msg) => {
        if (options.verbose && !options.quiet && msg.payload) {
          const label = msg.payload.label ? `[${msg.payload.label}] ` : "";
          process.stderr.write(`${label}${msg.payload.message || ""}\n`);
        }
      },
      log: (msg) => {
        if (options.verbose && !options.quiet && msg.payload) {
          const label = msg.payload.label || msg.payload.level || "Log";
          process.stderr.write(`[${label}] ${msg.payload.message || ""}\n`);
        }
      },
      "token-usage": (msg) => {
        if (options.verbose && !options.quiet && msg.payload?.usage) {
          const u = msg.payload.usage;
          const promptT = u.prompt_tokens ?? u.input_tokens ?? 0;
          const compT = u.completion_tokens ?? u.output_tokens ?? 0;
          const totalT = u.total_tokens ?? promptT + compT;
          process.stderr.write(
            `[Tokens] Prompt: ${promptT}, Completion: ${compT}, Total: ${totalT}\n`,
          );
        }
      },
      "request-native-ai-task": (msg) => {
        handleNativeAiTaskMessage(core, db, msg.payload);
      },
    };

    messageHandlers[message.type]?.(message);
  });

  let toolResolution;
  try {
    toolResolution = await resolveToolsAndProfile(
      db,
      core,
      groupId,
      workspaceConfig,
      workspaceSettings,
      workspaceAgent,
      options,
    );
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    if (!options.quiet) {
      console.error(errorMsg);
    }
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }
  const { enabledTools, profileSystemPromptOverride } = toolResolution;

  if (enabledTools.length > 0 && !options.quiet) {
    const { getCuratedModelToolSupport } =
      await import("../utils/local-models.js");
    if (getCuratedModelToolSupport(model) === false) {
      process.stderr.write(
        `[Agent] Warning: Model "${model}" does not support tool calling; tools will be ignored. Use --tools none or choose a tool-capable model (e.g. onnx-community/gemma-4-E2B-it-ONNX).\n`,
      );
    }
  }

  if (attachments.length > 0 && !options.quiet) {
    const capabilities = getModelAttachmentCapabilities(model);
    for (const att of attachments) {
      const category = getAttachmentCategory(att.mimeType, att.fileName);
      if (
        category === "image" &&
        !capabilities.images &&
        !capabilities.routerByFeatures
      ) {
        process.stderr.write(
          `[Agent] Warning: Model "${model}" does not accept image input; "${att.fileName}" will be passed as a reference only.\n`,
        );
      } else if (
        category === "audio" &&
        !capabilities.audio &&
        !capabilities.routerByFeatures
      ) {
        process.stderr.write(
          `[Agent] Warning: Model "${model}" does not accept audio input; "${att.fileName}" will be passed as a reference only.\n`,
        );
      } else if (
        category === "video" &&
        !capabilities.video &&
        !capabilities.routerByFeatures
      ) {
        process.stderr.write(
          `[Agent] Warning: Model "${model}" does not accept video input; "${att.fileName}" will be passed as a reference only.\n`,
        );
      } else if (
        category === "document" &&
        !capabilities.documents &&
        !capabilities.routerByFeatures
      ) {
        process.stderr.write(
          `[Agent] Warning: Model "${model}" does not accept PDF/document input; "${att.fileName}" will be passed as a reference only.\n`,
        );
      }
    }
  }

  const DEFAULT_SYSTEM_PROMPT =
    "You are ShadowClaw, a helpful AI assistant operating in a headless workspace. Answer concisely.";

  let systemPrompt: string | undefined;

  const isExplicitlyDisabled =
    options.systemPrompt === "none" ||
    options.systemPrompt === "" ||
    (options.systemPrompt as any) === false ||
    options.noSystemPrompt === true;

  if (isExplicitlyDisabled) {
    systemPrompt = "";
  } else {
    systemPrompt = options.systemPrompt;

    if (!systemPrompt && options.systemPromptFile) {
      try {
        const filePath = path.resolve(options.systemPromptFile);
        systemPrompt = await readFile(filePath, "utf8");
      } catch (err: any) {
        const errorMsg = `Error: Failed to read system prompt file "${options.systemPromptFile}": ${err.message}`;
        if (!options.quiet) console.error(errorMsg);
        process.exitCode = 1;
        return { success: false, error: errorMsg };
      }
    }

    if (!systemPrompt) {
      systemPrompt =
        process.env.SHADOW_CLAW_SYSTEM_PROMPT ||
        process.env.SHADOWCLAW_SYSTEM_PROMPT;
    }

    if (!systemPrompt && profileSystemPromptOverride) {
      systemPrompt = profileSystemPromptOverride;
    }

    if (!systemPrompt && workspaceAgent?.systemPromptFile) {
      try {
        const baseDir = workspaceConfigData?.configPath
          ? path.dirname(workspaceConfigData.configPath)
          : workspaceDir;
        const filePath = path.resolve(baseDir, workspaceAgent.systemPromptFile);
        systemPrompt = await readFile(filePath, "utf8");
      } catch (err: any) {
        if (options.verbose && !options.quiet) {
          console.error(
            `Warning: Failed to read systemPromptFile from config: ${err.message}`,
          );
        }
      }
    }

    if (!systemPrompt) {
      systemPrompt =
        workspaceAgent?.systemPrompt ||
        workspaceSettings?.systemPrompt ||
        workspaceSettings?.systemPromptOverride;
    }

    if (!systemPrompt && typeof core.getConfig === "function") {
      try {
        const dbOverride = await core.getConfig(
          db,
          core.CONFIG_KEYS?.SYSTEM_PROMPT_OVERRIDE || "system_prompt_override",
        );
        if (dbOverride && typeof dbOverride === "string") {
          systemPrompt = dbOverride;
        }
      } catch {}
    }

    if (!systemPrompt) {
      systemPrompt = DEFAULT_SYSTEM_PROMPT;
    }
  }

  const invokePayload = {
    apiKey: apiKey || "",
    assistantName: "ShadowClaw",
    enabledTools,
    groupId,
    maxTokens,
    messages: [...history, invokeUserMessage],
    model,
    provider: providerId,
    ...(providerConfig?.baseUrl ? { baseUrl: providerConfig.baseUrl } : {}),
    streaming: isStreaming,
    verbose: Boolean(options.verbose),
    systemPrompt,
  };

  const abortController = new AbortController();
  if (options.abortSignal) {
    if (options.abortSignal.aborted) {
      abortController.abort();
    } else {
      options.abortSignal.addEventListener(
        "abort",
        () => abortController.abort(),
        { once: true },
      );
    }
  }

  const exitWithCode = (code: number) => {
    if (typeof options.onExit === "function") {
      options.onExit(code);
    } else if (!process.env.JEST_WORKER_ID && process.env.NODE_ENV !== "test") {
      process.exit(code);
    }
  };

  let wasInterrupted = false;
  let forceExitTimer: ReturnType<typeof setTimeout> | null = null;
  const onSigint = () => {
    if (wasInterrupted) {
      if (forceExitTimer) {
        clearTimeout(forceExitTimer);
        forceExitTimer = null;
      }
      exitWithCode(130);
      return;
    }
    wasInterrupted = true;
    abortController.abort();
    try {
      if (typeof core.cleanupAllLlamafileProcesses === "function") {
        core.cleanupAllLlamafileProcesses();
      }
    } catch {}

    forceExitTimer = setTimeout(() => {
      exitWithCode(130);
    }, 1500);
    forceExitTimer.unref?.();
  };

  process.on("SIGINT", onSigint);

  const invoker = options.invokeHandler || core.handleInvoke;
  try {
    await invoker(db, invokePayload, abortController.signal);
  } catch (err: any) {
    capturedError = err instanceof Error ? err.message : String(err);
    if (!wasInterrupted && !options.quiet) {
      console.error(`Error: ${capturedError}`);
    }
  } finally {
    process.removeListener("SIGINT", onSigint);
    if (forceExitTimer) {
      clearTimeout(forceExitTimer);
      forceExitTimer = null;
    }
  }

  if (wasInterrupted) {
    if (!options.quiet) {
      process.stderr.write("\nOperation cancelled.\n");
    }
    process.exitCode = 130;
    if (typeof options.onExit === "function") {
      options.onExit(130);
    }
    return { success: false, error: "Operation cancelled." };
  }

  if (capturedError && hasStreamedChunks && !options.quiet && !options.output) {
    process.stdout.write("\n");
  }

  if (capturedError) {
    process.exitCode = 1;
    return { success: false, error: capturedError };
  }

  if (capturedResponse && typeof core.saveMessage === "function") {
    try {
      await core.saveMessage(db, {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        groupId,
        role: "assistant",
        content: capturedResponse,
        timestamp: Date.now(),
      });
    } catch {}
  }

  if (options.output && capturedResponse && pendingWrites.length === 0) {
    const writePromise = writeFile(
      path.resolve(options.output),
      capturedResponse,
      "utf8",
    )
      .then(() => {
        if (!options.quiet) {
          process.stderr.write(`Output written to ${options.output}\n`);
        }
      })
      .catch(() => {});
    pendingWrites.push(writePromise);
  }

  await Promise.all(pendingWrites);

  if (typeof core.setPostHandler === "function") {
    core.setPostHandler(null);
  }

  return {
    success: true,
    response: capturedResponse,
    model,
    provider: providerId,
  };
}

/**
 * Manage local models for Transformers.js.
 * @param {"list" | "download" | "set"} [subaction="list"]
 * @param {string} [modelId]
 * @param {Record<string, any>} [options]
 */
export async function runAgentModel(
  subaction: string = "list",
  modelId?: string,
  options: AgentModelOptions & Record<string, any> = {},
): Promise<AgentModelResult> {
  const {
    listLocalModels,
    listLlamafileModels,
    downloadLocalModel,
    fetchRemoteModels,
    DEFAULT_LOCAL_MODEL,
  } = await import("../utils/local-models.js");

  const workspaceDir = options.workspace
    ? path.resolve(options.workspace)
    : process.cwd();
  const action = subaction || "list";

  if (action === "list" || action === "remote") {
    const isRemote =
      action === "remote" ||
      Boolean(options.remote || options.all || options.huggingface);

    const configData = await loadWorkspaceConfig(workspaceDir);
    const configuredModel =
      configData?.config?.agent?.defaultModel ||
      configData?.config?.settings?.defaultModel ||
      DEFAULT_LOCAL_MODEL;

    if (isRemote) {
      if (!options.quiet) {
        process.stdout.write(
          "\nFetching available ONNX models from Hugging Face (onnx-community)...\n",
        );
      }
      const remoteModels = await fetchRemoteModels({
        cacheDir: options.cacheDir,
        query:
          options.query ||
          (action === "remote" && modelId ? modelId : undefined),
      });

      if (!options.quiet) {
        if (remoteModels.length === 0) {
          process.stdout.write(
            "No models found on Hugging Face or could not reach huggingface.co.\n\n",
          );
        } else {
          process.stdout.write(
            `\nHugging Face ONNX Models (${remoteModels.length} available):\n\n`,
          );
          for (const m of remoteModels) {
            const isDefault = m.id === configuredModel;
            const cachedStr = m.cached ? " [Cached]" : " [Not downloaded]";
            const defaultStr = isDefault ? " (Default)" : "";
            process.stdout.write(`  • ${m.id}${defaultStr}${cachedStr}\n`);
          }
          process.stdout.write(
            "\nTip: Run `shadow-claw agent model download <modelId>` to download any model,\n",
          );
          process.stdout.write(
            "     or `shadow-claw agent model set <modelId>` to set it as default.\n\n",
          );
        }
      }
      return {
        success: true,
        models: remoteModels,
        defaultModel: configuredModel,
      };
    }

    const models = listLocalModels(options.cacheDir);
    const llamafileModels = listLlamafileModels(options.cacheDir);

    if (!options.quiet) {
      process.stdout.write(
        "\nCurated Transformers.js Models (Local ONNX):\n\n",
      );
      for (const m of models) {
        const isDefault = m.id === configuredModel;
        const cachedStr = m.cached ? " [Cached]" : " [Not downloaded]";
        const defaultStr = isDefault ? " (Default)" : "";
        process.stdout.write(`  • ${m.id}${defaultStr}${cachedStr}\n`);
        process.stdout.write(`    Name: ${m.name}\n`);
        process.stdout.write(
          `    Context: ${m.contextLength.toLocaleString()} tokens | Tools: ${m.supportsTools ? "Yes" : "No"}\n`,
        );
        process.stdout.write(`    ${m.description}\n\n`);
      }

      process.stdout.write("Curated Llamafile Models (Local Executable):\n\n");
      for (const m of llamafileModels) {
        const isDefault =
          m.fileName === configuredModel ||
          m.id === configuredModel ||
          configuredModel.endsWith(m.fileName);
        const cachedStr = m.cached ? " [Cached]" : " [Not downloaded]";
        const defaultStr = isDefault ? " (Default)" : "";
        process.stdout.write(`  • ${m.fileName}${defaultStr}${cachedStr}\n`);
        process.stdout.write(`    Name: ${m.name}\n`);
        process.stdout.write(`    URL: ${m.url}\n`);
        process.stdout.write(`    ${m.description}\n\n`);
      }

      process.stdout.write(
        "Tip: Run `shadow-claw agent model list --remote` (or `shadow-claw agent model remote`) to browse all ONNX models from Hugging Face.\n\n",
      );
    }
    return {
      success: true,
      models,
      llamafileModels,
      defaultModel: configuredModel,
    };
  }

  if (action === "download") {
    const targetModel = modelId || options.model || DEFAULT_LOCAL_MODEL;
    if (options.verbose && !options.quiet) {
      process.stderr.write(`Preparing to download model: ${targetModel}\n`);
    }
    const result = await downloadLocalModel(targetModel, {
      cacheDir: options.cacheDir,
      verbose: options.verbose,
      isTTY: options.isTTY,
      progress: options.progress !== false && !options.noProgress,
    });
    if (!result.success) {
      process.exitCode = 1;
    }
    return result;
  }

  if (action === "set") {
    const targetModel = modelId || options.model;
    if (!targetModel) {
      const errorMsg = "Error: Please specify a model ID to set as default.";
      if (!options.quiet) console.error(errorMsg);
      process.exitCode = 1;
      return { success: false, error: errorMsg };
    }

    const configData = await loadWorkspaceConfig(workspaceDir);
    const configPath =
      configData?.configPath ||
      path.join(workspaceDir, "shadow-claw.config.json");
    const currentConfig = configData?.config || {};

    const updatedConfig = {
      ...currentConfig,
      agent: {
        ...(currentConfig.agent || {}),
        defaultModel: targetModel,
      },
    };

    await writeFile(
      configPath,
      JSON.stringify(updatedConfig, null, 2) + "\n",
      "utf8",
    );

    if (!options.quiet) {
      process.stdout.write(
        `Updated default CLI agent model to: ${targetModel}\n`,
      );
    }

    return { success: true, model: targetModel, configPath };
  }

  const errorMsg = `Unknown model action: "${action}". Available: list, download, set`;
  if (!options.quiet) console.error(errorMsg);
  process.exitCode = 1;
  return { success: false, error: errorMsg };
}

/**
 * Import tools, skills, and companion scripts from a remote discovery manifest or site URL.
 * @param {string} urlOrSite
 * @param {import("../../src/worker/headless-types.js").AgentImportOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").AgentImportResult>}
 */
export async function runAgentImport(
  urlOrSite: string,
  options: AgentImportOptions & Record<string, any> = {},
): Promise<AgentImportResult> {
  const trimmedUrl = (urlOrSite || "").trim();
  if (!trimmedUrl) {
    const errorMsg =
      "Error: Discovery URL or site URL required. Usage: shadow-claw agent import <url> [options]";
    if (!options.quiet) {
      console.error(errorMsg);
    }
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }

  const workspace = options.workspace || process.cwd();
  const { db, workspaceDir, core } = await bootstrapHeadlessAgent({
    ...options,
    workspace,
  });
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;

  const parseList = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val))
      return val.map((v) => String(v).trim()).filter(Boolean);
    return String(val)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  };

  // 1. Handle local filesystem path directly or via npx skills
  const isLocalPath =
    trimmedUrl.startsWith("./") ||
    trimmedUrl.startsWith("../") ||
    trimmedUrl.startsWith("/") ||
    trimmedUrl.startsWith("file://") ||
    /^[a-zA-Z]:[\\/]/.test(trimmedUrl);

  if (isLocalPath) {
    const hasFilter = Boolean(
      options.tools || options.skills || options.scripts,
    );
    const filtered = hasFilter && !options.all;
    const localOpts = {
      overwrite: Boolean(options.overwrite),
      targetSubdir: options.targetSubdir,
    };
    const empty: { imported: string[]; skipped: string[]; failed: any[] } = {
      imported: [],
      skipped: [],
      failed: [],
    };
    const localRes =
      filtered && !options.skills
        ? empty
        : await importLocalSkillsDirectory(trimmedUrl, workspaceDir, {
            ...localOpts,
            skillNames: options.skills ? parseList(options.skills) : undefined,
          });
    const toolsRes =
      filtered && !options.tools
        ? empty
        : await importLocalFlatArtifacts("tools", trimmedUrl, workspaceDir, {
            ...localOpts,
            names: parseList(options.tools),
          });
    const scriptsRes =
      filtered && !options.scripts
        ? empty
        : await importLocalFlatArtifacts("scripts", trimmedUrl, workspaceDir, {
            ...localOpts,
            names: parseList(options.scripts),
          });
    const toStatuses = (
      res: typeof empty,
      dir: string,
      suffix: (n: string) => string,
    ) => [
      ...res.imported.map((name: string) => ({
        name,
        path: `.agents/${dir}/${suffix(name)}`,
        status: "imported" as const,
      })),
      ...res.skipped.map((name: string) => ({
        name,
        path: `.agents/${dir}/${suffix(name)}`,
        status: "skipped" as const,
      })),
      ...res.failed.map((f: any) => ({
        name: f.name,
        path: "",
        status: "failed" as const,
        error: f.error,
      })),
    ];
    const importedCount =
      localRes.imported.length +
      toolsRes.imported.length +
      scriptsRes.imported.length;
    const skippedCount =
      localRes.skipped.length +
      toolsRes.skipped.length +
      scriptsRes.skipped.length;
    const allFailed = [
      ...localRes.failed.map((f: any) => ({ ...f, kind: "Skill" })),
      ...toolsRes.failed.map((f: any) => ({ ...f, kind: "Tool" })),
      ...scriptsRes.failed.map((f: any) => ({ ...f, kind: "Script" })),
    ];
    const failedCount = allFailed.length;
    const success = failedCount === 0 || importedCount > 0;
    if (!success) {
      process.exitCode = 1;
    }
    return {
      success,
      siteUrl: trimmedUrl,
      manifestUrl: trimmedUrl,
      result: {
        tools: toStatuses(toolsRes, "tools", (n) => `${n}.json`),
        scripts: toStatuses(scriptsRes, "scripts", (n) => `${n}.js`),
        skills: toStatuses(localRes, "skills", (n) => `${n}/SKILL.md`),
        diagnostics: allFailed.map((f) => `${f.kind} ${f.name}: ${f.error}`),
      },
      importedCount,
      skippedCount,
      failedCount,
      ...(failedCount > 0 && importedCount === 0
        ? { error: allFailed[0]?.error }
        : {}),
    };
  }

  // 2. For npx skills package sources (owner/repo, owner/repo@skill, GitHub URLs),
  // attempt npx skills delegation first when enabled, with graceful fallback to fetchDiscoveryManifest
  const shouldTryNpx =
    isNpxSkillsPackageSource(trimmedUrl) &&
    options.useNpxSkills !== false &&
    (Boolean(options.npxSkillsExecFn) || !options.fetchFn);

  if (shouldTryNpx) {
    const beforeDiscovery = await core.discoverSkills(db, groupId);
    const beforeNames = new Set(beforeDiscovery.skills.map((s: any) => s.name));
    const npxArgs = ["add", trimmedUrl, "-a", "universal", "-y"];
    if (options.skills) {
      const skillFilters = parseList(options.skills);
      if (skillFilters.length > 0) {
        npxArgs.push("--skill", ...skillFilters);
      }
    }
    const npxRes = await runNpxSkillsCommand(npxArgs, {
      workspaceDir,
      execFn: options.npxSkillsExecFn,
    });
    if (npxRes.success) {
      const afterDiscovery = await core.discoverSkills(db, groupId);
      const newlyAdded = afterDiscovery.skills.filter(
        (s: any) => !beforeNames.has(s.name),
      );
      const importedSkills =
        newlyAdded.length > 0 ? newlyAdded : afterDiscovery.skills;
      return {
        success: true,
        siteUrl: trimmedUrl,
        manifestUrl: trimmedUrl,
        result: {
          tools: [],
          scripts: [],
          skills: importedSkills.map((s: any) => ({
            name: s.name,
            path: s.path,
            status: "imported",
          })),
          diagnostics: [],
        },
        importedCount: importedSkills.length,
        skippedCount: 0,
        failedCount: 0,
      };
    }
    // If npx skills failed, fall through gracefully to fetchDiscoveryManifest!
  }

  const fetchDiscoveryManifest =
    core.fetchDiscoveryManifest ||
    (await import("../../subsystems/tools/remote/discovery.js"))
      .fetchDiscoveryManifest;
  const importRemoteArtifacts =
    core.importRemoteArtifacts ||
    (await import("../../subsystems/tools/remote/import-artifacts.js"))
      .importRemoteArtifacts;

  const fetchFn = options.fetchFn || globalThis.fetch;

  if (!options.quiet) {
    console.log(`Fetching discovery manifest from ${trimmedUrl}...`);
  }

  let resolvedManifest: any;
  try {
    resolvedManifest = await fetchDiscoveryManifest(trimmedUrl, fetchFn);
  } catch (err: any) {
    const errorMsg = `Failed to fetch discovery manifest: ${err instanceof Error ? err.message : String(err)}`;
    if (!options.quiet) {
      console.error(`Error: ${errorMsg}`);
    }
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }

  const { manifest, siteUrl, manifestUrl } = resolvedManifest;

  const manifestTools = manifest.tools || [];
  const manifestSkills = manifest.skills || [];
  const manifestScripts = manifest.scripts || [];

  if (!options.quiet) {
    console.log(
      `Discovered: ${manifest.name || "Remote Site"} (${manifestSkills.length} skill${manifestSkills.length === 1 ? "" : "s"}, ${manifestTools.length} tool${manifestTools.length === 1 ? "" : "s"}, ${manifestScripts.length} script${manifestScripts.length === 1 ? "" : "s"})`,
    );
  }

  const allToolNames = manifestTools.map((t: any) => t.name);
  const allSkillNames = manifestSkills.map((s: any) => s.name);
  const allScriptNames = manifestScripts.map((s: any) => s.name);

  let toolNames: string[];
  let skillNames: string[];
  let scriptNames: string[];

  const hasExplicitFilter = Boolean(
    options.tools || options.skills || options.scripts,
  );

  if (hasExplicitFilter && !options.all) {
    const parseList = (val: any) => {
      if (!val) return [];
      if (Array.isArray(val))
        return val.map((v) => String(v).trim()).filter(Boolean);
      return String(val)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    };
    toolNames = parseList(options.tools);
    skillNames = parseList(options.skills);
    scriptNames = parseList(options.scripts);
  } else {
    toolNames = allToolNames;
    skillNames = allSkillNames;
    scriptNames = allScriptNames;
  }

  const autoEnable = options.autoEnable !== false;
  const overwrite = Boolean(options.overwrite);

  let importResult: any;
  try {
    importResult = await importRemoteArtifacts(
      db,
      groupId,
      manifest,
      { toolNames, skillNames, scriptNames },
      {
        autoEnable,
        overwrite,
        fetchFn,
        siteSlug: options.siteSlug,
        targetSubdir: options.targetSubdir,
      },
    );
  } catch (err: any) {
    const errorMsg = `Import failed: ${err instanceof Error ? err.message : String(err)}`;
    if (!options.quiet) {
      console.error(`Error: ${errorMsg}`);
    }
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }

  const importedTools = importResult.tools.filter(
    (t: any) => t.status === "imported",
  );
  const importedSkills = importResult.skills.filter(
    (s: any) => s.status === "imported",
  );
  const importedScripts = importResult.scripts.filter(
    (sc: any) => sc.status === "imported",
  );

  const skippedTools = importResult.tools.filter(
    (t: any) => t.status === "skipped",
  );
  const skippedSkills = importResult.skills.filter(
    (s: any) => s.status === "skipped",
  );
  const skippedScripts = importResult.scripts.filter(
    (sc: any) => sc.status === "skipped",
  );

  const failedTools = importResult.tools.filter(
    (t: any) => t.status === "failed",
  );
  const failedSkills = importResult.skills.filter(
    (s: any) => s.status === "failed",
  );
  const failedScripts = importResult.scripts.filter(
    (sc: any) => sc.status === "failed",
  );

  const importedCount =
    importedTools.length + importedSkills.length + importedScripts.length;
  const skippedCount =
    skippedTools.length + skippedSkills.length + skippedScripts.length;
  const failedCount =
    failedTools.length + failedSkills.length + failedScripts.length;

  if (!options.quiet) {
    console.log("\nImporting artifacts:");
    for (const item of [
      ...importResult.tools,
      ...importResult.skills,
      ...importResult.scripts,
    ]) {
      const type = importResult.tools.includes(item)
        ? "tool"
        : importResult.skills.includes(item)
          ? "skill"
          : "script";
      if (item.status === "imported") {
        console.log(`  [${type}] ${item.name} -> ${item.path} (imported)`);
      } else if (item.status === "skipped") {
        console.log(
          `  [${type}] ${item.name} -> ${item.path} (skipped, already exists - use --overwrite to replace)`,
        );
      } else {
        console.log(
          `  [${type}] ${item.name} (failed: ${item.error || "unknown error"})`,
        );
      }
    }

    if (failedCount > 0) {
      console.log(
        `\nCompleted with ${failedCount} error${failedCount === 1 ? "" : "s"}. Successfully imported ${importedCount} items, ${skippedCount} skipped.`,
      );
    } else {
      console.log(
        `\nSuccessfully imported ${importedCount} item${importedCount === 1 ? "" : "s"} (${importedTools.length} tool${importedTools.length === 1 ? "" : "s"}, ${importedSkills.length} skill${importedSkills.length === 1 ? "" : "s"}, ${importedScripts.length} script${importedScripts.length === 1 ? "" : "s"}).`,
      );
    }
  }

  const success = failedCount === 0 || importedCount > 0;
  if (!success) {
    process.exitCode = 1;
  }

  return {
    success,
    manifest,
    siteUrl,
    manifestUrl,
    result: importResult,
    importedCount,
    skippedCount,
    failedCount,
  };
}

/**
 * Main dispatcher for the `agent` command group.
 */
export async function runAgentCommand(
  action?: string,
  args: string[] = [],
  options: any = {},
): Promise<any> {
  let actualArgs = args;
  let actualOptions = options;
  if (!Array.isArray(args) && typeof args === "object") {
    actualOptions = args;
    actualArgs = [];
  }

  // Read stdin once before dispatching so sub-functions never block on process.stdin.
  // Only attempt when stdin is not a TTY (i.e. data is actually piped in).
  // A 500ms safety timeout prevents hanging in environments where stdin never sends EOF.
  // Pass the result as _stdinData so callers in tests can also inject it directly.
  if (actualOptions._stdinData === undefined) {
    try {
      actualOptions = {
        ...actualOptions,
        _stdinData: process.stdin.isTTY
          ? null
          : await readStdin({ timeoutMs: 500 }),
      };
    } catch {
      actualOptions = { ...actualOptions, _stdinData: null };
    }
  }

  switch (action) {
    case "init": {
      const targetDir = actualArgs[0] || actualOptions.workspace;
      const result = await runAgentInit({
        ...actualOptions,
        workspace: targetDir,
      });
      console.log(
        `Headless agent workspace initialized at: ${result.workspace}`,
      );
      return result;
    }

    case "skills": {
      const subaction = actualArgs[0];
      const optsWithWorkspace = {
        ...actualOptions,
        workspace: actualOptions.workspace || process.cwd(),
      };
      if (subaction) {
        return await runAgentSkillsManage(
          subaction,
          actualArgs.slice(1),
          optsWithWorkspace,
        );
      }
      const result = await runAgentSkills(optsWithWorkspace);
      if (result.skills.length === 0) {
        console.log("No skills found in workspace (.agents/skills/).");
      } else {
        console.log(`Available skills (${result.skills.length}):\n`);
        for (const skill of result.skills) {
          const sourceBadge = skill.lockSource
            ? ` [source: ${skill.lockSource}]`
            : "";
          console.log(
            `  - ${skill.name}${sourceBadge}: ${skill.description || "No description"}`,
          );
        }
      }
      return result;
    }

    case "tools": {
      const toolName = actualArgs[0];
      if (toolName) {
        return await runAgentTool(toolName, actualArgs[1], actualOptions);
      }
      const result = await runAgentTools(actualOptions);
      console.log(`Available tools (${result.tools.length}):\n`);
      for (const tool of result.tools) {
        const tag = tool.headlessSafe ? "[headless-safe]" : "[browser-only]";
        console.log(
          `  - ${tool.name.padEnd(25)} ${tag} ${tool.description || ""}`,
        );
      }
      return result;
    }

    case "tool": {
      const toolName = actualArgs[0];
      if (!toolName) {
        console.error(
          "Error: Tool name required. Usage: shadow-claw agent tool <name> [input-json]",
        );
        process.exitCode = 1;
        return;
      }
      return await runAgentTool(toolName, actualArgs[1], actualOptions);
    }

    case "skill": {
      const skillName = actualArgs[0];
      if (!skillName) {
        console.error(
          "Error: Skill name required. Usage: shadow-claw agent skill <name>",
        );
        process.exitCode = 1;
        return;
      }
      return await runAgentSkill(skillName, actualOptions);
    }

    case "clear":
      return await runAgentClear(actualOptions);

    case "run": {
      // Prompt may be empty when data is piped via stdin
      const prompt = actualArgs.join(" ") || "";
      return await runAgentRun(prompt || "-", actualOptions);
    }

    case "models":
    case "model": {
      const subaction = actualArgs[0] || "list";
      const modelId = actualArgs[1];
      return await runAgentModel(subaction, modelId, actualOptions);
    }

    case "import": {
      const url = actualArgs[0];
      if (!url) {
        console.error(
          "Error: Discovery URL or site URL required. Usage: shadow-claw agent import <url> [options]",
        );
        process.exitCode = 1;
        return {
          success: false,
          error:
            "Discovery URL or site URL required. Usage: shadow-claw agent import <url> [options]",
        };
      }
      return await runAgentImport(url, {
        ...actualOptions,
        workspace: actualOptions.workspace || process.cwd(),
      });
    }

    case "listen": {
      const listenFn =
        actualOptions.listenFn ||
        (async (opts: any) => {
          const { runWebRtcListenCommand } = await import("./webrtc-listen.js");
          return runWebRtcListenCommand(opts);
        });
      return await listenFn({
        ...actualOptions,
        agent: true,
      });
    }

    default: {
      console.log(
        "Usage: shadow-claw agent <init|model|skills|tools|tool|skill|import|run|clear|listen> [args...]",
      );
    }
  }
}
