import { loadSkill } from "./discoverSkills.js";
import type { ShadowClawDatabase } from "../../db/types.js";

export async function executeActivateSkill(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    return "Error: activate_skill requires a skill name.";
  }

  const skill = await loadSkill(db, groupId, name);
  if (!skill) {
    return `Error: skill "${name}" was not found in this conversation workspace.`;
  }
  if (skill.disableModelInvocation) {
    return `Error: skill "${name}" is not available for model-driven activation.`;
  }

  return [
    `<skill_content name="${skill.name}">`,
    skill.body || "(This skill has no instructions.)",
    `Skill directory: ${skill.basePath}`,
    "Resolve all relative paths against the skill directory.",
    skill.resources && skill.resources.length > 0
      ? [
          "<skill_resources>",
          ...skill.resources.map((path) => `  <file>${path}</file>`),
          "</skill_resources>",
        ].join("\n")
      : "",
    "</skill_content>",
  ]
    .filter(Boolean)
    .join("\n");
}
