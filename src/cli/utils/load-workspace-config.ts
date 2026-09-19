import { access, constants, readFile } from "node:fs/promises";
import path from "node:path";
import type { ShadowClawWorkspaceConfig } from "../../worker/headless-types.js";

const CONFIG_CANDIDATES = [
  "shadow-claw.config.json",
  "shadow-claw-config.json",
  "shadowclaw.config.json",
  "site-config.json",
];

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load and parse workspace configuration if present.
 * @param {string} [workspace]
 * @param {string} [contentRoot]
 * @returns {Promise<{ configPath: string, config: ShadowClawWorkspaceConfig } | null>}
 */
export async function loadWorkspaceConfig(
  workspace?: string,
  contentRoot?: string,
): Promise<{ configPath: string; config: ShadowClawWorkspaceConfig } | null> {
  const dirs: string[] = [];
  if (workspace) dirs.push(path.resolve(workspace));
  if (contentRoot) {
    const resolvedRoot = path.resolve(contentRoot);
    if (!dirs.includes(resolvedRoot)) dirs.push(resolvedRoot);
  }
  if (workspace && path.basename(path.resolve(workspace)) === ".cache") {
    const parent = path.dirname(path.resolve(workspace));
    if (!dirs.includes(parent)) dirs.push(parent);
  }

  for (const dir of dirs) {
    for (const candidate of CONFIG_CANDIDATES) {
      const p = path.join(dir, candidate);
      if (await fileExists(p)) {
        try {
          const raw = await readFile(p, "utf8");
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            return { configPath: p, config: parsed };
          }
        } catch {}
      }
    }
  }
  return null;
}
