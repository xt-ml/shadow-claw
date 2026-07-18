import { ShadowClawDatabase } from "../../../db/types.js";

import { getGroupTasks } from "./tasks-utils.js";

export async function executeListTasks(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<string> {
  const tasks = await getGroupTasks(db, groupId);
  if (tasks.length === 0) {
    return "No tasks found for this group.";
  }

  return tasks
    .map(
      (t) =>
        `[ID: ${t.id}] Schedule: ${t.schedule}, Type: ${t.type || "prompt"}, Enabled: ${t.enabled}`,
    )
    .join("\n");
}
