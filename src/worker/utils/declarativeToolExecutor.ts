import type { ShadowClawDatabase } from "../../db/types.js";
import { findDeclarativeTool } from "../../subsystems/tools/declarative.js";
import { executeBash } from "../tools/bash/bash.js";
import { executeJavascript } from "../tools/ui/javascript.js";

import type { ToolResultContentBlock } from "../../content/types.js";

export type ToolResult = string | ToolResultContentBlock[];

export type ExecuteToolDelegate = (
  db: ShadowClawDatabase,
  name: string,
  input: Record<string, unknown>,
  groupId: string,
  options?: { declarativeDepth?: number; [key: string]: unknown },
) => Promise<ToolResult>;

export async function executeDeclarativeTool(
  db: ShadowClawDatabase,
  name: string,
  input: Record<string, unknown>,
  groupId: string,
  options: { declarativeDepth?: number; [key: string]: unknown } = {},
  delegateExecuteTool: ExecuteToolDelegate,
): Promise<ToolResult> {
  const declarativeTool = await findDeclarativeTool(db, groupId, name);
  if (!declarativeTool) {
    return `Unknown tool: ${name}`;
  }

  const declarativeDepth = options.declarativeDepth || 0;
  if (declarativeDepth >= 8) {
    return `Tool error (${name}): declarative tool nesting limit exceeded.`;
  }

  if (declarativeTool.execution.type === "tool") {
    const target = declarativeTool.execution.name;
    if (!target) {
      return `Tool error (${name}): declarative tool target is missing.`;
    }

    return await delegateExecuteTool(
      db,
      target,
      declarativeTool.execution.input
        ? { ...input, ...declarativeTool.execution.input }
        : input,
      groupId,
      { ...options, declarativeDepth: declarativeDepth + 1 },
    );
  }

  if (declarativeTool.execution.type === "bash") {
    return await executeBash(
      db,
      {
        command: declarativeTool.execution.command,
        stdin: JSON.stringify(input),
      },
      groupId,
    );
  }

  return await executeJavascript(db, {
    code: declarativeTool.execution.code,
    data: JSON.stringify(input),
  });
}
