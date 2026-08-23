import matter from "gray-matter";

import type { SkillRecord } from "./types.js";

const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$|^[a-z0-9]$/;

export function parseSkill(path: string, source: string): SkillRecord {
  const parsed = matter(source);
  const data =
    parsed.data && typeof parsed.data === "object" ? parsed.data : {};
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const description =
    typeof data.description === "string" ? data.description.trim() : "";

  if (!name) {
    throw new Error(`Skill at ${path} requires a name`);
  }
  if (!description) {
    throw new Error(`Skill ${name} requires a description`);
  }
  if (name.length > 64 || !NAME_PATTERN.test(name)) {
    throw new Error(
      `Skill name must be 1-64 lowercase characters and hyphens: ${name}`,
    );
  }
  if (description.length > 1024) {
    throw new Error(
      `Skill ${name} description must be 1024 characters or fewer`,
    );
  }

  const basePath = path.replace(/\/SKILL\.md$/u, "");
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? Object.fromEntries(
          Object.entries(data.metadata).map(([key, value]) => [
            key,
            String(value),
          ]),
        )
      : undefined;

  return {
    name,
    description,
    ...(typeof data.license === "string" ? { license: data.license } : {}),
    ...(typeof data.compatibility === "string"
      ? { compatibility: data.compatibility }
      : {}),
    ...(metadata ? { metadata } : {}),
    ...(typeof data["allowed-tools"] === "string"
      ? { allowedTools: data["allowed-tools"] }
      : {}),
    ...(typeof data["user-invocable"] === "boolean"
      ? { userInvocable: data["user-invocable"] }
      : {}),
    ...(typeof data["disable-model-invocation"] === "boolean"
      ? { disableModelInvocation: data["disable-model-invocation"] }
      : {}),
    body: parsed.content.trim(),
    path,
    basePath,
  };
}
