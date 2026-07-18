import { ShadowClawDatabase } from "../../../db/types.js";
import { readGroupFile } from "../../../storage/readGroupFile.js";
import { writeGroupFile } from "../../../storage/writeGroupFile.js";

export async function executePatchFile(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const content = await readGroupFile(db, groupId, input.path);
  const idx = content.indexOf(input.old_string);

  if (idx === -1) {
    return `patch_file failed: old_string not found in ${input.path}`;
  }

  if (content.indexOf(input.old_string, idx + 1) !== -1) {
    return `patch_file failed: old_string matches multiple locations in ${input.path}. Include more surrounding context to make the match unique.`;
  }

  const patched =
    content.slice(0, idx) +
    input.new_string +
    content.slice(idx + input.old_string.length);

  await writeGroupFile(db, groupId, input.path, patched);

  return `Patched ${input.path} (${input.old_string.length} chars replaced with ${input.new_string.length} chars)`;
}
