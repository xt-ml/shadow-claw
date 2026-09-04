/**
 * ShadowClaw CLI — `skills:index` command
 * Generates and updates .well-known/agent-skills/index.json per the
 * Cloudflare Agent Skills Discovery RFC (v0.2.0).
 */

import crypto from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";

/**
 * Computes a standardized sha256:{hex} digest from Buffer or string.
 */
export function computeSha256(content) {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  return `sha256:${hash.toLowerCase()}`;
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively find all files matching a filter under a root directory.
 */
async function findFilesRecursively(dir, filterFn) {
  const results = [];
  if (!(await pathExists(dir))) return results;

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (
        entry.isFile() &&
        (!filterFn || filterFn(entry.name, fullPath))
      ) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results.sort();
}

/**
 * Generates the Agent Skills Discovery index object.
 */
export async function generateSkillsIndex(
  contentRoot = process.cwd(),
  options = {},
) {
  const resolvedRoot = path.resolve(contentRoot);
  const wellKnownDirRel = options.outDir || ".well-known/agent-skills";

  // 1. Read metadata from shadow-claw.config.json or package.json
  let siteName = path.basename(resolvedRoot);
  let siteDescription =
    "Agent skills and tools collection, powered by ShadowClaw.";

  const configPath = path.join(resolvedRoot, "shadow-claw.config.json");
  if (await pathExists(configPath)) {
    try {
      const configStr = await readFile(configPath, "utf8");
      const config = JSON.parse(configStr);
      if (config.site?.title) siteName = config.site.title;
      if (config.site?.description) siteDescription = config.site.description;
    } catch {}
  } else {
    const pkgPath = path.join(resolvedRoot, "package.json");
    if (await pathExists(pkgPath)) {
      try {
        const pkgStr = await readFile(pkgPath, "utf8");
        const pkg = JSON.parse(pkgStr);
        if (pkg.name) siteName = pkg.name;
        if (pkg.description) siteDescription = pkg.description;
      } catch {}
    }
  }

  // 2. Discover Tools (.agents/tools/**/*.json)
  const toolsDir = path.join(resolvedRoot, ".agents", "tools");
  const toolFiles = await findFilesRecursively(toolsDir, (name) =>
    name.endsWith(".json"),
  );
  const discoveredTools = [];

  for (const fullToolPath of toolFiles) {
    const relFromRoot = path.relative(resolvedRoot, fullToolPath);
    const relUrl = path.posix.normalize(
      path.posix.relative(
        wellKnownDirRel,
        relFromRoot.split(path.sep).join(path.posix.sep),
      ),
    );
    const content = await readFile(fullToolPath);
    const digest = computeSha256(content);

    let name = path.basename(fullToolPath, ".json");
    let description = "";

    try {
      const parsed = JSON.parse(content.toString("utf8"));
      if (parsed.name) name = parsed.name;
      if (parsed.description) description = parsed.description;
    } catch {}

    discoveredTools.push({
      name,
      description,
      url: relUrl,
      digest,
      relFromRoot,
    });
  }

  // 3. Discover Scripts (.agents/scripts/**/*.{js,mjs})
  const scriptsDir = path.join(resolvedRoot, ".agents", "scripts");
  const scriptFiles = await findFilesRecursively(
    scriptsDir,
    (name) => name.endsWith(".js") || name.endsWith(".mjs"),
  );
  const discoveredScripts = [];

  for (const fullScriptPath of scriptFiles) {
    const relFromRoot = path.relative(resolvedRoot, fullScriptPath);
    const relUrl = path.posix.normalize(
      path.posix.relative(
        wellKnownDirRel,
        relFromRoot.split(path.sep).join(path.posix.sep),
      ),
    );
    const content = await readFile(fullScriptPath);
    const digest = computeSha256(content);
    const baseName = path.basename(
      fullScriptPath,
      path.extname(fullScriptPath),
    );

    discoveredScripts.push({
      name: baseName,
      description: `Portable ESM engine logic and tool execution handler for ${baseName}.`,
      url: relUrl,
      digest,
      relFromRoot,
    });
  }

  // 4. Discover Skills (.agents/skills/**/SKILL.md)
  const skillsDir = path.join(resolvedRoot, ".agents", "skills");
  const skillFiles = await findFilesRecursively(
    skillsDir,
    (name) => name === "SKILL.md",
  );
  const discoveredSkills = [];

  for (const fullSkillPath of skillFiles) {
    const relFromRoot = path.relative(resolvedRoot, fullSkillPath);
    const relUrl = path.posix.normalize(
      path.posix.relative(
        wellKnownDirRel,
        relFromRoot.split(path.sep).join(path.posix.sep),
      ),
    );
    const rawContent = await readFile(fullSkillPath);
    const digest = computeSha256(rawContent);

    let frontmatter = {};
    try {
      const parsed = matter(rawContent.toString("utf8"));
      frontmatter = parsed.data || {};
    } catch {}

    const parentDirName = path.basename(path.dirname(fullSkillPath));
    const skillName = frontmatter.name || parentDirName;
    const skillDesc = frontmatter.description || "";

    // Identify associated tools
    const associatedToolNames = new Set();
    let hasExplicitTools = false;
    if (Array.isArray(frontmatter.metadata?.execution?.tools)) {
      for (const t of frontmatter.metadata.execution.tools) {
        if (t?.name) {
          associatedToolNames.add(t.name);
          hasExplicitTools = true;
        }
      }
    }
    const allowedToolsRaw =
      frontmatter.metadata?.["allowed-tools"] ||
      frontmatter.metadata?.allowedTools ||
      frontmatter["allowed-tools"];
    if (typeof allowedToolsRaw === "string") {
      allowedToolsRaw
        .split(/[,\s]+/)
        .filter(Boolean)
        .forEach((t) => {
          associatedToolNames.add(t);
          hasExplicitTools = true;
        });
    }
    // Only fallback if no explicit tools were declared in frontmatter
    if (!hasExplicitTools) {
      for (const tool of discoveredTools) {
        const normTool = tool.name.replace(/[-_]/g, "");
        const normSkill = skillName.replace(/[-_]/g, "");
        if (normTool === normSkill) {
          associatedToolNames.add(tool.name);
        }
      }
    }

    const matchingTools = discoveredTools
      .filter((t) => associatedToolNames.has(t.name))
      .map(({ name, url, digest }) => ({ name, url, digest }));

    // Identify associated scripts
    // Match by base name or if script base is a prefix/contains skill name base
    const matchingScripts = discoveredScripts
      .filter((s) => {
        const normScript = s.name.toLowerCase().replace(/[-_]/g, "");
        const normSkill = skillName.toLowerCase().replace(/[-_]/g, "");
        return (
          normSkill.startsWith(normScript) ||
          normScript.startsWith(normSkill) ||
          associatedToolNames.has(s.name)
        );
      })
      .map(({ name, url, digest }) => ({ name, url, digest }));

    discoveredSkills.push({
      name: skillName,
      type: "skill-md",
      description: skillDesc,
      url: relUrl,
      digest,
      ...(matchingTools.length ? { tools: matchingTools } : {}),
      ...(matchingScripts.length ? { scripts: matchingScripts } : {}),
    });
  }

  // 5. Construct Index Document
  const indexDoc = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    name: siteName,
    description: siteDescription,
    skills: discoveredSkills,
    ...(discoveredTools.length
      ? {
          tools: discoveredTools.map(({ name, description, url, digest }) => ({
            name,
            ...(description ? { description } : {}),
            url,
            digest,
          })),
        }
      : {}),
    ...(discoveredScripts.length
      ? {
          scripts: discoveredScripts.map(
            ({ name, description, url, digest }) => ({
              name,
              ...(description ? { description } : {}),
              url,
              digest,
            }),
          ),
        }
      : {}),
    ...(discoveredTools.length || discoveredScripts.length
      ? {
          dependencies: {
            ...(discoveredTools.length
              ? { tools: discoveredTools.map((t) => t.url) }
              : {}),
            ...(discoveredScripts.length
              ? { scripts: discoveredScripts.map((s) => s.url) }
              : {}),
          },
        }
      : {}),
  };

  // 6. Output Handling
  if (options.stdout) {
    console.log(JSON.stringify(indexDoc, null, 2));
  }

  if (options.write !== false) {
    const targetFile = options.outFile
      ? path.resolve(options.outFile)
      : path.join(resolvedRoot, wellKnownDirRel, "index.json");

    await mkdir(path.dirname(targetFile), { recursive: true });
    await writeFile(
      targetFile,
      JSON.stringify(indexDoc, null, 2) + "\n",
      "utf8",
    );
  }

  return indexDoc;
}

/**
 * CLI command runner for `shadow-claw skills:index [dir]`.
 */
export async function runSkillsIndexCommand(dir, options = {}) {
  const targetDir = dir ? path.resolve(dir) : process.cwd();
  console.log(`Generating Agent Skills Discovery index for ${targetDir}...`);

  const result = await generateSkillsIndex(targetDir, options);
  const count = result.skills ? result.skills.length : 0;
  console.log(
    `Indexed ${count} skill(s) into .well-known/agent-skills/index.json`,
  );
  return result;
}
