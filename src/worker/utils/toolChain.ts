import type { ShadowClawDatabase } from "../../db/types.js";
import type { TaskToolCall } from "../../db/types.js";
import { executeTool } from "./executeTool.js";

export interface ToolChainOptions {
  isManual?: boolean;
  isTaskExecution?: boolean;
  onStep?: (tool: TaskToolCall) => void;
}

export interface ToolChainResult {
  rawOutputs: any[];
  results: string[];
}

export async function executeToolChain(
  db: ShadowClawDatabase,
  groupId: string,
  tools: TaskToolCall[],
  options: ToolChainOptions = {},
): Promise<ToolChainResult> {
  const results: string[] = [];
  const rawOutputs: any[] = [];

  for (const tool of tools) {
    try {
      options.onStep?.(tool);
      const resolvedInput = resolvePipeRefs(
        tool.input || {},
        rawOutputs,
        tools,
      );
      const output = await executeTool(db, tool.name, resolvedInput, groupId, {
        isScheduledTask: !options.isManual,
        isTaskExecution: options.isTaskExecution,
      });
      rawOutputs.push(output);
      if (!tool.suppressOutput) {
        results.push(`**Tool \`${tool.name}\`**: ${output}`);
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      rawOutputs.push(errMsg);
      if (!tool.suppressOutput) {
        results.push(`**Tool \`${tool.name}\` failed**: ${errMsg}`);
      }
    }
  }

  return { rawOutputs, results };
}

export function resolvePipeRefs(
  value: any,
  rawOutputs: any[],
  tools: TaskToolCall[],
): any {
  if (value && typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map((item) => resolvePipeRefs(item, rawOutputs, tools));
    }

    if ("$pipe" in value) {
      const ref = value.$pipe;
      let output: any = "";
      if (ref === "prev") {
        output = rawOutputs[rawOutputs.length - 1] ?? "";
      } else if (typeof ref === "number") {
        output = rawOutputs[ref] ?? "";
      } else if (typeof ref === "string") {
        for (let i = rawOutputs.length - 1; i >= 0; i--) {
          if (tools[i]?.name === ref) {
            output = rawOutputs[i];
            break;
          }
        }
      }
      return resultToValue(output);
    }

    const resolvedObj: Record<string, any> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      resolvedObj[key] = resolvePipeRefs(nestedValue, rawOutputs, tools);
    }
    return resolvedObj;
  }
  return value;
}

export function resultToValue(result: any): any {
  if (typeof result === "string") {
    return result;
  }
  if (Array.isArray(result)) {
    return result
      .map((block) => {
        if (block && typeof block === "object") {
          if ("text" in block) return String(block.text);
          if ("data" in block) return String(block.data);
          return JSON.stringify(block);
        }
        return String(block ?? "");
      })
      .join("\n");
  }
  if (result && typeof result === "object") return result;
  return result ?? "";
}
