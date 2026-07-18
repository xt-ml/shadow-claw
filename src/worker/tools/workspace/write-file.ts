import { ShadowClawDatabase } from "../../../db/types.js";
import { writeGroupFile } from "../../../storage/writeGroupFile.js";

export async function executeWriteFile(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  await writeGroupFile(db, groupId, input.path, input.content);

  return `Written ${input.content.length} bytes to ${input.path}`;
}
