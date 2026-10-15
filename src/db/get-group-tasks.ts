import { getAllTasks } from "./get-all-tasks.js";
import type { ShadowClawDatabase, Task } from "./types.js";

/**
 * Retrieves all tasks belonging to a specific group ID.
 */
export async function getGroupTasks(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<Task[]> {
  const all = (await getAllTasks(db)) as Task[];

  return all.filter((task) => task.groupId === groupId);
}
