import { ShadowClawDatabase } from "../../../db/types.js";
import { listGroupFiles } from "../../../storage/listGroupFiles.js";

export async function executeListFiles(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const entries = (await listGroupFiles(
    db,
    groupId,
    input.path || ".",
  )) as string[];

  return entries.length > 0 ? entries.join("\n") : "(empty directory)";
}
