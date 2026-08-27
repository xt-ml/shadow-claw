import { DEFAULT_GROUP_ID } from "../../config/config.js";
import { getGroupDir } from "../../storage/getGroupDir.js";
import { readGroupFile } from "../../storage/readGroupFile.js";

import { parseSkill } from "./parseSkill.js";
import type { ShadowClawDatabase } from "../../db/types.js";
import type { SkillDiagnostic, SkillRecord } from "./types.js";

interface SkillDiscoveryResult {
  skills: SkillRecord[];
  diagnostics: SkillDiagnostic[];
}

const MAX_DIRECTORIES = 2000;

export async function discoverSkills(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
): Promise<SkillDiscoveryResult> {
  const skills: SkillRecord[] = [];
  const diagnostics: SkillDiagnostic[] = [];

  const groupIdsToScan =
    groupId === DEFAULT_GROUP_ID
      ? [DEFAULT_GROUP_ID]
      : [groupId, DEFAULT_GROUP_ID];

  for (const targetGroupId of groupIdsToScan) {
    try {
      const root = await getGroupDir(db, targetGroupId);
      const skillPaths: string[] = [];
      let visitedDirectories = 0;

      async function visit(
        directory: FileSystemDirectoryHandle,
        relativePath: string,
      ) {
        visitedDirectories += 1;
        if (visitedDirectories > MAX_DIRECTORIES) {
          diagnostics.push({
            path: ".agents/skills",
            message: `Skill discovery stopped after ${MAX_DIRECTORIES} directories`,
          });
          return;
        }

        for await (const [name, handle] of (directory as any).entries()) {
          const childPath = relativePath ? `${relativePath}/${name}` : name;
          if (handle.kind === "directory") {
            await visit(handle, childPath);
          } else if (
            name === "SKILL.md" &&
            childPath.startsWith(".agents/skills/")
          ) {
            skillPaths.push(childPath);
          }
        }
      }

      try {
        const agentsDir = await root.getDirectoryHandle(".agents");
        const skillsDir = await agentsDir.getDirectoryHandle("skills");
        await visit(skillsDir, ".agents/skills");
      } catch {
        continue;
      }

      for (const path of skillPaths.sort()) {
        try {
          const skill = parseSkill(
            path,
            await readGroupFile(db, targetGroupId, path),
          );
          if (skills.some((candidate) => candidate.name === skill.name)) {
            if (targetGroupId === groupId) {
              diagnostics.push({
                path,
                message: `Duplicate skill name: ${skill.name}`,
              });
            }
            continue;
          }
          skill.groupId = targetGroupId;
          skills.push(skill);
        } catch (error) {
          diagnostics.push({
            path,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch {
      // Continue scanning fallback group
    }
  }

  return { skills, diagnostics };
}

export async function loadSkill(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  name: string,
): Promise<SkillRecord | null> {
  const result = await discoverSkills(db, groupId);
  const skill = result.skills.find((candidate) => candidate.name === name);
  if (!skill) {
    return null;
  }

  const targetGroupId = skill.groupId || groupId;
  const refreshed = parseSkill(
    skill.path,
    await readGroupFile(db, targetGroupId, skill.path),
  );
  refreshed.groupId = targetGroupId;
  refreshed.resources = await listSkillResources(
    db,
    targetGroupId,
    refreshed.basePath,
  );
  return refreshed;
}

async function listSkillResources(
  db: ShadowClawDatabase,
  groupId: string,
  basePath: string,
): Promise<string[]> {
  const root = await getGroupDir(db, groupId);
  const parts = basePath.split("/").filter(Boolean);
  let directory = root;
  for (const part of parts) {
    directory = await directory.getDirectoryHandle(part);
  }

  const resources: string[] = [];
  async function visit(
    current: FileSystemDirectoryHandle,
    relativePath: string,
  ) {
    for await (const [name, handle] of (current as any).entries()) {
      const childPath = `${relativePath}/${name}`;
      if (handle.kind === "directory") {
        await visit(handle, childPath);
      } else if (childPath !== `${basePath}/SKILL.md`) {
        resources.push(childPath);
      }
    }
  }
  await visit(directory, basePath);
  return resources.sort();
}
