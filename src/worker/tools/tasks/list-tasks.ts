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

  tasks.sort((a, b) => {
    const oA = a.order ?? 0;
    const oB = b.order ?? 0;
    if (oA !== oB) {
      return oA - oB;
    }
    return a.createdAt - b.createdAt;
  });

  return tasks
    .map(
      (t) =>
        `[ID: ${t.id}] Name: ${t.name || "(none)"}, Schedule: ${t.schedule}, Type: ${t.type || "prompt"}, Enabled: ${t.enabled}`,
    )
    .join("\n");
}
