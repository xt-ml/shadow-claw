import { ShadowClawDatabase } from "../../../db/types.js";
import { moveGroupEntry } from "../../../storage/moveGroupEntry.js";

export async function executeMoveFile(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  if (!input.source_path || !input.target_path) {
    throw new Error("Missing source_path or target_path parameter");
  }

  const srcGroup = input.source_group_id || groupId;
  const tgtGroup = input.target_group_id || groupId;

  await moveGroupEntry(
    db,
    srcGroup,
    tgtGroup,
    input.source_path,
    input.target_path,
  );

  const groupInfo =
    srcGroup !== groupId || tgtGroup !== groupId
      ? ` (from ${srcGroup} to ${tgtGroup})`
      : "";

  return `Moved ${input.source_path} to ${input.target_path}${groupInfo}`;
}
