import { getGroupTasks } from "./tasks-utils.js";
import { post } from "../../post.js";
import { ShadowClawDatabase } from "../../../db/types.js";

export async function executeUpdateTask(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const tasks = await getGroupTasks(db, groupId);
  const task = tasks.find((t: any) => t.id === input.id);

  if (!task) {
    return `Error: Task with ID ${input.id} not found.`;
  }

  if (input.schedule) {
    task.schedule = input.schedule;
  }

  if (input.type === "prompt" || input.type === "tools") {
    task.type = input.type;
  }

  if (input.prompt) {
    task.prompt = input.prompt;
  }

  if (Array.isArray(input.tools)) {
    task.tools = input.tools;
  }

  if (input.enabled !== undefined) {
    task.enabled = !!input.enabled;
  }

  post({ type: "update-task", payload: { task } });

  return `Task ${input.id} updated successfully.`;
}
