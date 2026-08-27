import { CONFIG_KEYS, DEFAULT_GROUP_ID } from "../../config/config.js";
import { getConfig } from "../../db/getConfig.js";
import { getGroupDir } from "../../storage/getGroupDir.js";
import { readGroupFile } from "../../storage/readGroupFile.js";

import type { ShadowClawDatabase } from "../../db/types.js";
import type {
  DeclarativeToolDefinition,
  DeclarativeToolExecution,
  ToolDefinition,
} from "./types.js";

export type { DeclarativeToolDefinition };

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function parseDeclarativeTool(
  path: string,
  value: unknown,
): DeclarativeToolDefinition {
  if (!value || typeof value !== "object") {
    throw new Error(`Tool at ${path} must be a JSON object`);
  }

  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const description =
    typeof candidate.description === "string"
      ? candidate.description.trim()
      : "";
  const inputSchema = candidate.input_schema ?? candidate.parameters;
  const execution = candidate.execution ?? candidate.evaluation;

  if (!TOOL_NAME_PATTERN.test(name)) {
    throw new Error(`Tool name is invalid: ${name || "(missing)"}`);
  }
  if (!description) {
    throw new Error(`Tool ${name} requires a description`);
  }
  if (!inputSchema || typeof inputSchema !== "object") {
    throw new Error(`Tool ${name} requires input_schema`);
  }
  if (!execution || typeof execution !== "object") {
    throw new Error(`Tool ${name} requires execution`);
  }

  const parsedExecution = execution as Record<string, unknown>;
  const type = parsedExecution.type;
  if (type !== "bash" && type !== "javascript" && type !== "tool") {
    throw new Error(
      `Tool ${name} execution type must be bash, javascript, or tool`,
    );
  }
  if (type === "tool") {
    if (
      typeof parsedExecution.name !== "string" ||
      !TOOL_NAME_PATTERN.test(parsedExecution.name)
    ) {
      throw new Error(`Tool ${name} execution requires a valid tool name`);
    }

    return {
      name,
      description,
      input_schema: inputSchema as ToolDefinition["input_schema"],
      execution: {
        type,
        name: parsedExecution.name,
        ...(parsedExecution.input && typeof parsedExecution.input === "object"
          ? { input: parsedExecution.input as Record<string, unknown> }
          : {}),
      },
      path,
    };
  }
  const sourceKey = type === "bash" ? "command" : "code";
  const source = parsedExecution[sourceKey] ?? parsedExecution.expression;
  if (typeof source !== "string" || source.trim() === "") {
    throw new Error(`Tool ${name} execution requires ${sourceKey}`);
  }

  return {
    name,
    description,
    input_schema: inputSchema as ToolDefinition["input_schema"],
    execution: {
      type,
      [sourceKey]: source,
    } as DeclarativeToolExecution,
    path,
  };
}

export async function loadDeclarativeTools(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
): Promise<{ tools: DeclarativeToolDefinition[]; diagnostics: string[] }> {
  const tools: DeclarativeToolDefinition[] = [];
  const diagnostics: string[] = [];

  const groupIdsToScan =
    groupId === DEFAULT_GROUP_ID
      ? [DEFAULT_GROUP_ID]
      : [groupId, DEFAULT_GROUP_ID];

  for (const targetGroupId of groupIdsToScan) {
    try {
      const root = await getGroupDir(db, targetGroupId);
      const paths: string[] = [];

      async function visit(
        directory: FileSystemDirectoryHandle,
        relativePath: string,
      ) {
        for await (const [name, handle] of (directory as any).entries()) {
          const childPath = `${relativePath}/${name}`;
          if (handle.kind === "directory") {
            await visit(handle, childPath);
          } else if (
            name.endsWith(".json") &&
            childPath.startsWith(".agents/tools/")
          ) {
            paths.push(childPath);
          }
        }
      }

      try {
        const agentsDir = await root.getDirectoryHandle(".agents");
        const toolsDir = await agentsDir.getDirectoryHandle("tools");
        await visit(toolsDir, ".agents/tools");
      } catch {
        continue;
      }

      for (const path of paths.sort()) {
        try {
          const parsed = JSON.parse(
            await readGroupFile(db, targetGroupId, path),
          );
          const parsedTool = parseDeclarativeTool(path, parsed);
          if (!tools.some((t) => t.name === parsedTool.name)) {
            tools.push(parsedTool);
          }
        } catch (error) {
          diagnostics.push(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    } catch {
      // Continue to next group directory
    }
  }

  return { tools, diagnostics };
}

export async function findDeclarativeTool(
  db: ShadowClawDatabase,
  groupId: string = DEFAULT_GROUP_ID,
  name: string,
): Promise<DeclarativeToolDefinition | null> {
  try {
    const { tools } = await loadDeclarativeTools(db, groupId);
    const tool = tools.find((t) => t.name === name) || null;
    if (!tool) {
      return null;
    }

    const rawEnabled = await getConfig(
      db,
      CONFIG_KEYS.DECLARATIVE_TOOLS_ENABLED,
    );
    if (Array.isArray(rawEnabled) && !rawEnabled.includes(name)) {
      return null;
    }

    return tool;
  } catch {
    return null;
  }
}
