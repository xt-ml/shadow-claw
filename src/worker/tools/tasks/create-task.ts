import { ulid } from "../../../utils/ulid.js";
import { post } from "../../utils/post.js";

export function executeCreateTask(
  input: Record<string, any>,
  groupId: string,
): string {
  if (!input.schedule || typeof input.schedule !== "string") {
    return "Error: Missing or invalid 'schedule' (cron expression) for create_task.";
  }

  const taskType = input.type === "tools" ? "tools" : "prompt";
  if (
    taskType === "prompt" &&
    (!input.prompt || typeof input.prompt !== "string")
  ) {
    return "Error: Missing or invalid 'prompt' for create_task with type 'prompt'.";
  }

  const taskData = {
    createdAt: Date.now(),
    enabled: true,
    groupId,
    id: ulid(),
    lastRun: null,
    prompt: input.prompt ? input.prompt.trim() : "",
    schedule: input.schedule.trim(),
    tools: Array.isArray(input.tools) ? input.tools : [],
    type: taskType,
  };

  post({ type: "task-created", payload: { task: taskData } });

  return `Task created successfully.\nID: ${taskData.id}\nSchedule: ${taskData.schedule}\nType: ${taskData.type}`;
}
