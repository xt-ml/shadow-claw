import { isHeadlessMode, BROWSER_ONLY_TOOLS } from "../../config/headless.js";

const SCHEDULED_TASK_BLOCKED_TOOLS = new Set([
  "create_task",
  "update_task",
  "delete_task",
  "enable_task",
  "disable_task",
  "send_notification",
  "create_room",
  "invite_to_room",
  "leave_room",
]);

export function toAllowedToolNameSet(
  allowedTools:
    | ReadonlyArray<string | { name?: unknown } | undefined>
    | undefined,
): Set<string> | null {
  if (!Array.isArray(allowedTools)) {
    return null;
  }

  const names = allowedTools
    .map((tool) =>
      typeof tool === "string"
        ? tool
        : typeof tool?.name === "string"
          ? tool.name
          : null,
    )
    .filter(Boolean);

  return new Set(names as string[]);
}

export function checkAllowedToolGuard(
  name: string,
  allowedTools?: ReadonlyArray<string | { name?: unknown } | undefined>,
): string | null {
  const allowedToolNames = toAllowedToolNameSet(allowedTools);
  if (allowedToolNames && !allowedToolNames.has(name)) {
    return `Tool "${name}" is not allowed in the current context. Do not call it again. Use one of the available tools or ask for help.`;
  }
  return null;
}

export function checkTaskExecutionGuard(
  name: string,
  isScheduledTask?: boolean,
  isTaskExecution?: boolean,
): string | null {
  if (isScheduledTask || isTaskExecution) {
    if (name === "run_task") {
      return `Tool "run_task" cannot be called from within a task execution to prevent infinite loops.`;
    }
  }
  return null;
}

export function checkScheduledTaskBlockedGuard(
  name: string,
  isScheduledTask?: boolean,
): string | null {
  if (isScheduledTask && SCHEDULED_TASK_BLOCKED_TOOLS.has(name)) {
    return `Tool "${name}" is not allowed during scheduled task execution to prevent recursion.`;
  }
  return null;
}

export function checkHeadlessCapabilityGuard(name: string): string | null {
  if (isHeadlessMode() && BROWSER_ONLY_TOOLS.has(name)) {
    return `Tool "${name}" is not available in headless CLI mode. It requires a browser UI.`;
  }
  return null;
}

export interface ToolGuardOptions {
  allowedTools?: ReadonlyArray<string | { name?: unknown } | undefined>;
  isScheduledTask?: boolean;
  isTaskExecution?: boolean;
}

export function runToolGuards(
  name: string,
  options: ToolGuardOptions = {},
): string | null {
  return (
    checkAllowedToolGuard(name, options.allowedTools) ||
    checkTaskExecutionGuard(
      name,
      options.isScheduledTask,
      options.isTaskExecution,
    ) ||
    checkScheduledTaskBlockedGuard(name, options.isScheduledTask) ||
    checkHeadlessCapabilityGuard(name) ||
    null
  );
}
