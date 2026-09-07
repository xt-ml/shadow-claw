import { discoverSkills, loadSkill } from "./discoverSkills.js";
import type { ShadowClawDatabase } from "../../db/types.js";

export async function executeActivateSkill(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const discovery = await discoverSkills(db, groupId);
  const availableSkillNames = discovery.skills.map((s) => s.name);
  const availableList =
    availableSkillNames.length > 0
      ? availableSkillNames.join(", ")
      : "(none)";

  if (!name) {
    let msg = `Error: activate_skill requires a skill name. Available skills: ${availableList}.`;
    if (discovery.diagnostics.length > 0) {
      msg += ` (Note: ${discovery.diagnostics.length} skill file(s) had errors: ${discovery.diagnostics.map((d) => `${d.path}: ${d.message}`).join("; ")})`;
    }
    return msg;
  }

  const skill = await loadSkill(db, groupId, name);
  if (!skill) {
    const matchedDiag = discovery.diagnostics.find(
      (d) =>
        d.path.toLowerCase().includes(name.toLowerCase()) ||
        d.message.toLowerCase().includes(name.toLowerCase()),
    );
    if (matchedDiag) {
      return `Error: skill "${name}" was found at "${matchedDiag.path}" but failed to load: ${matchedDiag.message}. Please fix the frontmatter in SKILL.md. Available skills: ${availableList}.`;
    }

    let msg = `Error: skill "${name}" was not found in this conversation workspace. Available skills: ${availableList}.`;
    if (discovery.diagnostics.length > 0) {
      msg += ` (Note: ${discovery.diagnostics.length} skill file(s) had errors: ${discovery.diagnostics.map((d) => `${d.path}: ${d.message}`).join("; ")})`;
    }
    return msg;
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
