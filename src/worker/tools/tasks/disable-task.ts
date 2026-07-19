import { ShadowClawDatabase } from "../../../db/types.js";

import { post } from "../../utils/post.js";
import { getGroupTasks } from "./tasks-utils.js";

export async function executeDisableTask(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const tasks = await getGroupTasks(db, groupId);

  const task = tasks.find((t: any) => t.id === input.id);
  if (!task) {
    return `Error: Task with ID ${input.id} not found.`;
  }

  task.enabled = false;

  post({ type: "update-task", payload: { task } });

  return `Task ${input.id} disabled successfully.`;
}
