import { ShadowClawDatabase } from "../../../db/types.js";
import { createGroupDirectory } from "../../../storage/createGroupDirectory.js";

export async function executeCreateDirectory(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  if (!input.path) {
    throw new Error("Missing path parameter");
  }

  await createGroupDirectory(db, groupId, input.path);

  return `Created directory ${input.path}`;
}
