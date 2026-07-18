import { ShadowClawDatabase } from "../../../db/types.js";
import { listGroupFiles } from "../../../storage/listGroupFiles.js";
import { readGroupFile } from "../../../storage/readGroupFile.js";

export async function executeSearchFiles(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
): Promise<string> {
  const { pattern, path, file_glob, is_regex } = input;
  if (!pattern) {
    return "Error: pattern is required.";
  }

  const searchRegex = is_regex ? new RegExp(pattern) : null;

  const isMatch = (filename: string) => {
    if (!file_glob) {
      return true;
    }

    const glob = file_glob.replace(/\*/g, ".*").replace(/\?/g, ".");

    return new RegExp(`^${glob}$`).test(filename.split("/").pop() || "");
  };

  const results: string[] = [];

  async function walk(dir: string) {
    try {
      const entries = await listGroupFiles(db, groupId, dir);
      for (const entry of entries) {
        const fullPath =
          dir === "." || dir === ""
            ? entry
            : `${dir}${dir.endsWith("/") ? "" : "/"}${entry}`;

        if (entry.endsWith("/")) {
          await walk(fullPath.slice(0, -1));
        } else {
          if (!isMatch(entry)) {
            continue;
          }

          try {
            const content = await readGroupFile(db, groupId, fullPath);
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const matches = searchRegex
                ? searchRegex.test(line)
                : line.includes(pattern);
              if (matches) {
                results.push(`${fullPath}:${i + 1}: ${line}`);
                if (results.length > 500) {
                  results.push("... (results truncated at 500 matches)");

                  return;
                }
              }
            }
          } catch (err) {
            // Ignore read errors
          }
        }
      }
    } catch (e) {
      // Ignore list errors
    }
  }

  await walk(path || ".");
  if (results.length === 0) {
    return "No matches found.";
  }

  return results.join("\n");
}
