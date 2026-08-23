import { getGroupDir } from "../../storage/getGroupDir.js";
import { readGroupFile } from "../../storage/readGroupFile.js";

import type { ShadowClawDatabase } from "../../db/types.js";
import type {
  DeclarativeToolDefinition,
  DeclarativeToolExecution,
  ToolDefinition,
} from "./types.js";

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
  groupId: string,
): Promise<{ tools: DeclarativeToolDefinition[]; diagnostics: string[] }> {
  const tools: DeclarativeToolDefinition[] = [];
  const diagnostics: string[] = [];
  const root = await getGroupDir(db, groupId);
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
        childPath.startsWith(".agents/tools/main/")
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
    return { tools, diagnostics };
  }

  for (const path of paths.sort()) {
    try {
      const parsed = JSON.parse(await readGroupFile(db, groupId, path));
      tools.push(parseDeclarativeTool(path, parsed));
    } catch (error) {
      diagnostics.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { tools, diagnostics };
}

export async function findDeclarativeTool(
  db: ShadowClawDatabase,
  groupId: string,
  name: string,
): Promise<DeclarativeToolDefinition | null> {
  try {
    const { tools } = await loadDeclarativeTools(db, groupId);
    return tools.find((tool) => tool.name === name) || null;
  } catch {
    return null;
  }
}
