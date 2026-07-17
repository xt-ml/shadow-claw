import { readGroupFile } from "../../../storage/readGroupFile.js";
import { ShadowClawDatabase } from "../../../db/types.js";

export async function executeDiffFiles(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const { path_a, path_b } = input;
  if (!path_a || !path_b) {
    return "Error: path_a and path_b are required.";
  }

  let contentA = "";
  let contentB = "";
  try {
    contentA = await readGroupFile(db, groupId, path_a);
  } catch (e) {
    return `Error reading ${path_a}: ${e}`;
  }

  try {
    contentB = await readGroupFile(db, groupId, path_b);
  } catch (e) {
    return `Error reading ${path_b}: ${e}`;
  }

  if (contentA === contentB) {
    return "Files are identical.";
  }

  const linesA = contentA.split("\n");
  const linesB = contentB.split("\n");

  const diffLines: string[] = [];
  const maxLines = Math.max(linesA.length, linesB.length);
  let differences = 0;

  for (let i = 0; i < maxLines; i++) {
    const a = linesA[i];
    const b = linesB[i];
    if (a !== b) {
      if (a !== undefined) {
        diffLines.push(`- [Line ${i + 1}] ${a}`);
      }

      if (b !== undefined) {
        diffLines.push(`+ [Line ${i + 1}] ${b}`);
      }

      differences++;
      if (differences > 100) {
        diffLines.push("... (diff truncated at 100 differences)");

        break;
      }
    }
  }

  return diffLines.join("\n");
}
