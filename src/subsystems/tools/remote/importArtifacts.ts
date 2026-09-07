import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../../../config/config.js";
import { getConfig } from "../../../db/getConfig.js";
import { setConfig } from "../../../db/setConfig.js";
import { writeGroupFile } from "../../../storage/writeGroupFile.js";
import { groupFileExists } from "../../../storage/groupFileExists.js";
import { parseDeclarativeTool } from "../declarative.js";
import { TOOL_DEFINITIONS } from "../tools.js";
import { parseSkill } from "../../skills/parseSkill.js";
import { verifySha256Digest } from "./discovery.js";
import type { ShadowClawDatabase } from "../../../db/types.js";
import type {
  ImportArtifactStatus,
  ImportOptions,
  ImportResult,
  RemoteManifest,
  RemoteScriptItem,
  RemoteSkillItem,
  RemoteToolItem,
} from "./types.js";

const BUILTIN_TOOL_NAMES = new Set(TOOL_DEFINITIONS.map((t) => t.name));
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function getSubdir(options?: ImportOptions): string {
  if (options?.targetSubdir) {
    return options.targetSubdir;
  }
  if (options?.siteSlug) {
    return `imported/${options.siteSlug}`;
  }
  return "main";
}

/**
 * Imports a declarative tool definition from a remote URL and saves it into OPFS.
 */
export async function importRemoteTool(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  toolItem: RemoteToolItem,
  options?: ImportOptions,
): Promise<ImportArtifactStatus> {
  const name = (toolItem.name || "").trim();

  if (BUILTIN_TOOL_NAMES.has(name)) {
    return {
      name,
      path: "",
      status: "failed",
      error: `Cannot shadow built-in tool: ${name}`,
    };
  }

  if (!TOOL_NAME_PATTERN.test(name)) {
    return {
      name,
      path: "",
      status: "failed",
      error: `Invalid tool name: ${name}`,
    };
  }

  const subdir = getSubdir(options);
  const targetPath = `.agents/tools/${subdir}/${name}.json`;

  try {
    const exists = await groupFileExists(db, groupId, targetPath);
    if (exists && !options?.overwrite) {
      return {
        name,
        path: targetPath,
        status: "skipped",
      };
    }

    const fetcher = options?.fetchFn || globalThis.fetch;
    const response = await fetcher(toolItem.url);
    if (!response.ok) {
      return {
        name,
        path: targetPath,
        status: "failed",
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const text = await response.text();

    if (toolItem.digest) {
      const isValid = await verifySha256Digest(text, toolItem.digest);
      if (!isValid) {
        return {
          name,
          path: targetPath,
          status: "failed",
          error: "Integrity verification failed for tool definition",
        };
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        name,
        path: targetPath,
        status: "failed",
        error: "Downloaded tool definition is not valid JSON",
      };
    }

    // Validate schema
    parseDeclarativeTool(targetPath, parsed);

    await writeGroupFile(
      db,
      groupId,
      targetPath,
      JSON.stringify(parsed, null, 2),
    );

    if (options?.autoEnable) {
      const current = (await getConfig(
        db,
        CONFIG_KEYS.DECLARATIVE_TOOLS_ENABLED,
      )) as string[] | undefined;
      const set = new Set(Array.isArray(current) ? current : []);
      set.add(name);
      await setConfig(
        db,
        CONFIG_KEYS.DECLARATIVE_TOOLS_ENABLED,
        Array.from(set),
      );
    }

    return {
      name,
      path: targetPath,
      status: "imported",
    };
  } catch (error) {
    return {
      name,
      path: targetPath,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Imports a companion script (.js/.mjs) from a remote URL and saves it into OPFS.
 */
export async function importRemoteScript(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  scriptItem: RemoteScriptItem,
  options?: ImportOptions,
): Promise<ImportArtifactStatus> {
  const name = (scriptItem.name || "").trim();
  const subdir = getSubdir(options);
  const filename =
    name.endsWith(".js") || name.endsWith(".mjs") ? name : `${name}.js`;
  const targetPath = `.agents/scripts/${subdir}/${filename}`;

  try {
    const exists = await groupFileExists(db, groupId, targetPath);
    if (exists && !options?.overwrite) {
      return {
        name,
        path: targetPath,
        status: "skipped",
      };
    }

    const fetcher = options?.fetchFn || globalThis.fetch;
    const response = await fetcher(scriptItem.url);
    if (!response.ok) {
      return {
        name,
        path: targetPath,
        status: "failed",
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const text = await response.text();

    if (scriptItem.digest) {
      const isValid = await verifySha256Digest(text, scriptItem.digest);
      if (!isValid) {
        return {
          name,
          path: targetPath,
          status: "failed",
          error: "Integrity verification failed for script",
        };
      }
    }

    await writeGroupFile(db, groupId, targetPath, text);

    return {
      name,
      path: targetPath,
      status: "imported",
    };
  } catch (error) {
    return {
      name,
      path: targetPath,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Imports an Agent Skill (SKILL.md) from a remote URL and saves it into OPFS.
 */
export async function importRemoteSkill(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  skillItem: RemoteSkillItem,
  options?: ImportOptions,
): Promise<ImportArtifactStatus> {
  const name = (skillItem.name || "").trim();
  const subdir = getSubdir(options);
  const targetPath = `.agents/skills/${subdir}/${name}/SKILL.md`;

  try {
    const exists = await groupFileExists(db, groupId, targetPath);
    if (exists && !options?.overwrite) {
      return {
        name,
        path: targetPath,
        status: "skipped",
      };
    }

    const fetcher = options?.fetchFn || globalThis.fetch;
    const response = await fetcher(skillItem.url);
    if (!response.ok) {
      return {
        name,
        path: targetPath,
        status: "failed",
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const text = await response.text();

    if (skillItem.digest) {
      const isValid = await verifySha256Digest(text, skillItem.digest);
      if (!isValid) {
        return {
          name,
          path: targetPath,
          status: "failed",
          error: "Integrity verification failed for skill",
        };
      }
    }

    // Validate skill frontmatter
    parseSkill(targetPath, text);

    await writeGroupFile(db, groupId, targetPath, text);

    return {
      name,
      path: targetPath,
      status: "imported",
    };
  } catch (error) {
    return {
      name,
      path: targetPath,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Imports a batch of selected tools, skills, and scripts from a remote site with dependency resolution.
 */
export async function importRemoteArtifacts(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  manifest: RemoteManifest,
  selection: {
    toolNames?: string[];
    skillNames?: string[];
    scriptNames?: string[];
  },
  options?: ImportOptions,
): Promise<ImportResult> {
  const result: ImportResult = {
    tools: [],
    skills: [],
    scripts: [],
    diagnostics: [],
  };

  const selectedToolNames = new Set(selection.toolNames || []);
  const selectedSkillNames = new Set(selection.skillNames || []);
  const selectedScriptNames = new Set(selection.scriptNames || []);

  const manifestTools = manifest.tools || [];
  const manifestSkills = manifest.skills || [];
  const manifestScripts = manifest.scripts || [];

  // Resolve dependencies from selected skills
  for (const skillItem of manifestSkills) {
    if (selectedSkillNames.has(skillItem.name)) {
      if (Array.isArray(skillItem.tools)) {
        for (const t of skillItem.tools) {
          selectedToolNames.add(t.name);
        }
      }
      if (Array.isArray(skillItem.scripts)) {
        for (const s of skillItem.scripts) {
          selectedScriptNames.add(s.name);
        }
      }
    }
  }

  // Import Scripts
  for (const scriptItem of manifestScripts) {
    if (selectedScriptNames.has(scriptItem.name)) {
      const status = await importRemoteScript(db, groupId, scriptItem, options);
      result.scripts.push(status);
      if (status.status === "failed" && status.error) {
        result.diagnostics.push(`Script ${scriptItem.name}: ${status.error}`);
      }
    }
  }

  // Import Tools
  for (const toolItem of manifestTools) {
    if (selectedToolNames.has(toolItem.name)) {
      const status = await importRemoteTool(db, groupId, toolItem, options);
      result.tools.push(status);
      if (status.status === "failed" && status.error) {
        result.diagnostics.push(`Tool ${toolItem.name}: ${status.error}`);
      }
    }
  }

  // Import Skills
  for (const skillItem of manifestSkills) {
    if (selectedSkillNames.has(skillItem.name)) {
      const status = await importRemoteSkill(db, groupId, skillItem, options);
      result.skills.push(status);
      if (status.status === "failed" && status.error) {
        result.diagnostics.push(`Skill ${skillItem.name}: ${status.error}`);
      }
    }
  }

  return result;
}
