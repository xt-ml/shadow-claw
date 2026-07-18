import { ShadowClawDatabase } from "../../../db/types.js";
import { writeGroupFile } from "../../../storage/writeGroupFile.js";

export async function executeUpdateMemory(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  await writeGroupFile(db, groupId, "MEMORY.md", input.content);

  return "Memory updated successfully.";
}
