import { ShadowClawDatabase } from "../../../db/types.js";
import { deleteGroupDirectory } from "../../../storage/deleteGroupDirectory.js";
import { deleteGroupFile } from "../../../storage/deleteGroupFile.js";

export async function executeDeleteFile(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  if (!input.path) {
    throw new Error("Missing path parameter");
  }

  try {
    await deleteGroupFile(db, groupId, input.path);

    return `Deleted file: ${input.path}`;
  } catch (fileErr) {
    try {
      await deleteGroupDirectory(db, groupId, input.path);

      return `Deleted directory: ${input.path}`;
    } catch {
      throw fileErr;
    }
  }
}
