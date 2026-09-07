import matter from "gray-matter";

import type { TaskToolCall } from "../../db/types.js";
import type { SkillExecution, SkillRecord } from "./types.js";

const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$|^[a-z0-9]$/;

interface FrontmatterParseResult {
  data: Record<string, unknown>;
  content: string;
}

function parseFrontmatterResiliently(source: string): FrontmatterParseResult {
  try {
    const parsed = matter(source);
    return {
      data: parsed.data && typeof parsed.data === "object" ? parsed.data : {},
      content: parsed.content || "",
    };
  } catch {
    // Attempt 1: Sanitize unquoted scalar lines in the frontmatter block
    const fmMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (fmMatch) {
      const rawFm = fmMatch[1];
      const rest = fmMatch[2] || "";
      const lines = rawFm.split(/\r?\n/);
      const sanitizedLines = lines.map((line) => {
        const fieldMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
        if (fieldMatch) {
          const [, key, val] = fieldMatch;
          const trimmed = val.trim();
          // If value is not already quoted and not a YAML block indicator/collection opening or boolean/number
          if (
            trimmed &&
            trimmed !== "true" &&
            trimmed !== "false" &&
            trimmed !== "null" &&
            !trimmed.startsWith('"') &&
            !trimmed.startsWith("'") &&
            !trimmed.startsWith("[") &&
            !trimmed.startsWith("{") &&
            trimmed !== ">" &&
            trimmed !== "|" &&
            trimmed !== ">-" &&
            trimmed !== "|-" &&
            !/^-?\d+(?:\.\d+)?$/.test(trimmed)
          ) {
            return `${key}: ${JSON.stringify(trimmed)}`;
          }
        }
        return line;
      });

      try {
        const sanitizedSource = `---\n${sanitizedLines.join("\n")}\n---\n${rest}`;
        const parsed = matter(sanitizedSource);
        return {
          data:
            parsed.data && typeof parsed.data === "object" ? parsed.data : {},
          content: parsed.content || "",
        };
      } catch {
        // Continue to fallback
      }

      // Attempt 2: Line-by-line fallback extraction for essential frontmatter fields
      const fallbackData: Record<string, unknown> = {};
      const nameMatch = rawFm.match(/^name:\s*["']?([^"'\r\n]+)["']?/m);
      if (nameMatch) {
        fallbackData.name = nameMatch[1].trim();
      }

      const descMatch = rawFm.match(/^description:\s*(.+)$/m);
      if (descMatch) {
        let desc = descMatch[1].trim();
        if (
          (desc.startsWith('"') && desc.endsWith('"')) ||
          (desc.startsWith("'") && desc.endsWith("'"))
        ) {
          desc = desc.slice(1, -1);
        }
        fallbackData.description = desc;
      }

      const userInvocableMatch = rawFm.match(/^user-invocable:\s*(true|false)/mi);
      if (userInvocableMatch) {
        fallbackData["user-invocable"] =
          userInvocableMatch[1].toLowerCase() === "true";
      }

      const disableModelMatch = rawFm.match(
        /^disable-model-invocation:\s*(true|false)/mi,
      );
      if (disableModelMatch) {
        fallbackData["disable-model-invocation"] =
          disableModelMatch[1].toLowerCase() === "true";
      }

      const toolsMatch = rawFm.match(/^allowed-tools:\s*["']?([^"'\r\n]+)["']?/m);
      if (toolsMatch) {
        fallbackData["allowed-tools"] = toolsMatch[1].trim();
      }

      // Check for bullet list allowed-tools
      const toolListMatch = rawFm.match(/allowed-tools:\s*\n((?:\s*-\s*[^\r\n]+\r?\n?)+)/m);
      if (toolListMatch) {
        const tools = toolListMatch[1]
          .split(/\r?\n/)
          .map((l) => l.replace(/^\s*-\s*/, "").trim())
          .filter(Boolean);
        if (tools.length > 0) {
          fallbackData["allowed-tools"] = tools;
        }
      }

      return { data: fallbackData, content: rest };
    }

    return { data: {}, content: source };
  }
}

function extractAllowedTools(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(raw)) {
    const tools = raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return tools.length > 0 ? tools.join(" ") : undefined;
  }
  return undefined;
}

export function parseSkill(path: string, source: string): SkillRecord {
  const parsed = parseFrontmatterResiliently(source);
  const data = parsed.data;
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

  const allowedToolsRaw =
    extractAllowedTools(rawMetadata?.["allowed-tools"]) ||
    extractAllowedTools(rawMetadata?.["allowedTools"]) ||
    extractAllowedTools(data["allowed-tools"]) ||
    extractAllowedTools(data["allowedTools"]);

  const metadataEntries: [string, string][] = [];
  if (rawMetadata) {
    for (const [key, value] of Object.entries(rawMetadata)) {
      if (key === "execution" || value === null || value === undefined) {
        continue;
      }
      if (
        key === "allowed-tools" ||
        key === "allowedTools"
      ) {
        if (allowedToolsRaw) {
          metadataEntries.push([key, allowedToolsRaw]);
        }
      } else if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        metadataEntries.push([key, String(value)]);
      } else if (Array.isArray(value)) {
        const stringItems = value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean);
        if (stringItems.length > 0) {
          metadataEntries.push([key, stringItems.join(" ")]);
        }
      }
    }
  }

  const metadata =
    metadataEntries.length > 0
      ? Object.fromEntries(metadataEntries)
      : undefined;

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
      : typeof data["user-invocable"] === "string" &&
          (data["user-invocable"].toLowerCase() === "true" ||
            data["user-invocable"].toLowerCase() === "false")
        ? { userInvocable: data["user-invocable"].toLowerCase() === "true" }
        : {}),
    ...(typeof data["disable-model-invocation"] === "boolean"
      ? { disableModelInvocation: data["disable-model-invocation"] }
      : typeof data["disable-model-invocation"] === "string" &&
          (data["disable-model-invocation"].toLowerCase() === "true" ||
            data["disable-model-invocation"].toLowerCase() === "false")
        ? {
            disableModelInvocation:
              data["disable-model-invocation"].toLowerCase() === "true",
          }
        : {}),
    ...(parsedExecution ? { execution: parsedExecution } : {}),
    body: parsed.content.trim(),
    path,
    basePath,
  };
}
