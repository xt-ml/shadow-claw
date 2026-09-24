/**
 * Host-filesystem skill discovery for the A2A server agent card.
 *
 * Reuses the existing parseSkill + NodeFsDirectoryHandle path that the CLI
 * headless agent uses — no new discovery logic needed.
 *
 * References:
 * - src/cli/commands/agent-bootstrap.ts (setStorageRootFromPath + setHeadlessMode pattern)
 * - src/subsystems/skills/discoverSkills.ts (OPFS-based discovery, works via Node shim)
 * - ADR: docs/decisions/server-a2a-http-binding.md
 */

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import type { AgentSkill } from "../../subsystems/channels/peer-protocol.js";
import { setStorageRootFromPath } from "../../storage/node-fs-handle.js";
import { setHeadlessMode } from "../../config/headless.js";
import { discoverSkills } from "../../subsystems/skills/discoverSkills.js";
import { DEFAULT_GROUP_ID } from "../../config/config.js";

const MAX_DIRECTORIES = 2000;

/**
 * Scan `rootPath/.agents/skills` for SKILL.md files and return them as
 * A2A AgentSkill objects suitable for the agent card.
 *
 * Invalid or unparseable skills are silently skipped (same behaviour as the
 * CLI agent and the browser-side skill discovery).
 *
 * Tags are read directly from gray-matter frontmatter since SkillRecord
 * does not carry them (they are an AgentSkill-only protocol concept).
 */
export async function discoverServerSkills(
  rootPath: string,
): Promise<AgentSkill[]> {
  const skillsDir = path.join(rootPath, ".agents", "skills");
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  // Mirror the CLI agent bootstrap: headless mode + filesystem storage root
  setHeadlessMode(true);
  setStorageRootFromPath(rootPath);

  // discoverSkills uses a dummy db — in headless mode getGroupDir returns the
  // storage root directly without touching the db, so an empty stub is safe.
  const db = {} as any;

  const { skills } = await discoverSkills(db, DEFAULT_GROUP_ID);

  // Collect raw tags from frontmatter — SkillRecord does not carry tags.
  const tagsMap = new Map<string, string[]>();
  let visited = 0;

  function scanDir(dir: string): void {
    if (visited >= MAX_DIRECTORIES) return;
    visited++;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (entry.name === "SKILL.md") {
        try {
          const src = fs.readFileSync(full, "utf8");
          const { data } = matter(src);
          const name = typeof data.name === "string" ? data.name.trim() : "";
          if (name) {
            const raw = data.tags;
            const tags = Array.isArray(raw)
              ? raw.filter((t): t is string => typeof t === "string")
              : typeof raw === "string"
                ? raw
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                : [];
            tagsMap.set(name, tags);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  scanDir(skillsDir);

  return skills.map(
    (skill): AgentSkill => ({
      id: skill.name,
      name: skill.name,
      description: skill.description,
      tags: tagsMap.get(skill.name) ?? [],
    }),
  );
}
