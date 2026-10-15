import type { SkillRecord } from "./types.js";

export interface ParsedSkillCommand {
  skill: SkillRecord;
  arguments: string;
}

export function parseSkillCommand(
  content: string,
  skills: SkillRecord[],
): ParsedSkillCommand | null {
  const match = content
    .trim()
    .match(
      /^\/([a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]|[a-z0-9])(?:\s+([\s\S]+))?$/u,
    );
  if (!match) {
    return null;
  }

  const skill = skills.find(
    (candidate) =>
      candidate.name === match[1] && candidate.userInvocable !== false,
  );
  if (!skill) {
    return null;
  }

  return {
    skill,
    arguments: (match[2] || "").trim(),
  };
}
