import matter from "gray-matter";

import type { TaskToolCall } from "../../db/types.js";
import type { SkillExecution, SkillRecord } from "./types.js";

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
  const rawMetadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : undefined;

  const metadataEntries = rawMetadata
    ? Object.entries(rawMetadata).filter(
        ([key, value]) =>
          key !== "execution" && value !== null && typeof value !== "object",
      )
    : [];

  const metadata =
    metadataEntries.length > 0
      ? Object.fromEntries(
          metadataEntries.map(([key, value]) => [key, String(value)]),
        )
      : undefined;

  const allowedToolsRaw =
    (rawMetadata &&
      (typeof rawMetadata["allowed-tools"] === "string"
        ? rawMetadata["allowed-tools"]
        : typeof rawMetadata["allowedTools"] === "string"
          ? rawMetadata["allowedTools"]
          : undefined)) ||
    (typeof data["allowed-tools"] === "string"
      ? data["allowed-tools"]
      : undefined);

  const execution = rawMetadata?.execution;

  let parsedExecution;
  if (execution !== undefined) {
    if (
      !execution ||
      typeof execution !== "object" ||
      (execution as Record<string, unknown>).type !== "tools" ||
      !Array.isArray((execution as Record<string, unknown>).tools)
    ) {
      throw new Error(`Skill ${name} has invalid tools execution`);
    }
    const rawExec = execution as Record<string, unknown>;
    const topSuppressToast =
      typeof rawExec.suppressToast === "boolean"
        ? rawExec.suppressToast
        : undefined;
    const topSuppressOutput =
      typeof rawExec.suppressOutput === "boolean"
        ? rawExec.suppressOutput
        : undefined;

    const rawTools = rawExec.tools as TaskToolCall[];
    const tools = rawTools.map((tool) => ({
      ...tool,
      ...(topSuppressToast !== undefined && tool.suppressToast === undefined
        ? { suppressToast: topSuppressToast }
        : {}),
      ...(topSuppressOutput !== undefined && tool.suppressOutput === undefined
        ? { suppressOutput: topSuppressOutput }
        : {}),
    }));

    parsedExecution = {
      type: "tools" as const,
      ...(topSuppressToast !== undefined
        ? { suppressToast: topSuppressToast }
        : {}),
      ...(topSuppressOutput !== undefined
        ? { suppressOutput: topSuppressOutput }
        : {}),
      tools,
    } satisfies SkillExecution;
  }

  return {
    name,
    description,
    ...(typeof data.license === "string" ? { license: data.license } : {}),
    ...(typeof data.compatibility === "string"
      ? { compatibility: data.compatibility }
      : {}),
    ...(metadata ? { metadata } : {}),
    ...(typeof allowedToolsRaw === "string"
      ? { allowedTools: allowedToolsRaw }
      : {}),
    ...(typeof data["user-invocable"] === "boolean"
      ? { userInvocable: data["user-invocable"] }
      : {}),
    ...(typeof data["disable-model-invocation"] === "boolean"
      ? { disableModelInvocation: data["disable-model-invocation"] }
      : {}),
    ...(parsedExecution ? { execution: parsedExecution } : {}),
    body: parsed.content.trim(),
    path,
    basePath,
  };
}
