import { getAllTasks } from "../../../db/getAllTasks.js";
import { ShadowClawDatabase, Task } from "../../../db/types.js";

export async function getGroupTasks(
  db: ShadowClawDatabase,
  groupId: string,
): Promise<Task[]> {
  const all = (await getAllTasks(db)) as Task[];

  return all.filter((task) => task.groupId === groupId);
}
