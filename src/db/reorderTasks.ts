import { getAllTasks } from "./getAllTasks.js";
import { saveTask } from "./saveTask.js";
import type { ShadowClawDatabase, Task } from "./types.js";

/**
 * Reorder tasks in a group by assigning sequential order values.
 */
export async function reorderTasks(
  db: ShadowClawDatabase,
  groupId: string,
  orderedIds: string[],
): Promise<Task[]> {
  const allTasks = await getAllTasks(db);
  const groupTasks = allTasks.filter((t) => t.groupId === groupId);
  const byId = new Map(groupTasks.map((t) => [t.id, t]));

  const updatedTasks: Task[] = [];
  let orderIndex = 0;

  // Process the ordered IDs first
  for (const id of orderedIds) {
    const task = byId.get(id);
    if (task) {
      task.order = orderIndex++;
      await saveTask(db, task);
      updatedTasks.push(task);
      byId.delete(id);
    }
  }

  // Process any remaining tasks in the group that were not explicitly ordered
  const remaining = Array.from(byId.values()).sort((a, b) => {
    const oA = a.order ?? 0;
    const oB = b.order ?? 0;
    if (oA !== oB) {
      return oA - oB;
    }
    return a.createdAt - b.createdAt;
  });

  for (const task of remaining) {
    task.order = orderIndex++;
    await saveTask(db, task);
    updatedTasks.push(task);
  }

  return updatedTasks;
}
