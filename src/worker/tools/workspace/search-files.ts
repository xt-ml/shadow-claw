import { ShadowClawDatabase } from "../../../db/types.js";
import { listGroupFiles } from "../../../storage/listGroupFiles.js";
import { readGroupFileBytes } from "../../../storage/readGroupFileBytes.js";
import { isBinaryContent } from "./utils/isBinaryContent.js";

/** Maximum number of result lines returned. */
const MAX_RESULTS = 500;

/** Maximum length of a matched line stored in results (characters). */
const MAX_LINE_LENGTH = 500;

/** Maximum length of a line fed to regex `.test()` to mitigate ReDoS. */
const MAX_REGEX_INPUT_LENGTH = 2000;

export interface SearchFilesOptions {
  /** Maximum bytes to read from a single file. Files larger than this are skipped. */
  maxFileBytes?: number;
  /** Maximum total files visited (read) during a walk, to bound memory/time. */
  maxFilesVisited?: number;
  /** Set of directory names to skip unconditionally (e.g. `node_modules`). */
  skipDirs?: Set<string>;
}

/** Default directory names to skip when no overrides are provided. */
const DEFAULT_SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-electron",
  ".cache",
  ".nx",
  ".turbo",
  "__pycache__",
  ".venv",
  "venv",
]);

export async function executeSearchFiles(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
  options: SearchFilesOptions = {},
): Promise<string> {
  const { pattern, path, file_glob, is_regex } = input;
  if (!pattern) {
    return "Error: pattern is required.";
  }

  const maxFileBytes = options.maxFileBytes ?? 512 * 1024;
  const maxFilesVisited = options.maxFilesVisited ?? 1000;
  const skipDirs = options.skipDirs ?? DEFAULT_SKIP_DIRS;

  // Validate regex eagerly so we can return a clear error instead of crashing.
  let searchRegex: RegExp | null = null;
  if (is_regex) {
    try {
      searchRegex = new RegExp(pattern);
    } catch (err) {
      return `Error: invalid regex pattern — ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const isMatch = (filename: string): boolean => {
    if (!file_glob) {
      return true;
    }
    const glob = file_glob.replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${glob}$`).test(filename.split("/").pop() || "");
  };

  const results: string[] = [];
  let filesVisited = 0;
  let hitVisitCap = false;
  let hitResultCap = false;

  async function walk(dir: string): Promise<void> {
    if (hitVisitCap || hitResultCap) return;

    let entries: string[];
    try {
      entries = await listGroupFiles(db, groupId, dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (hitVisitCap || hitResultCap) return;

      const fullPath =
        dir === "." || dir === ""
          ? entry
          : `${dir}${dir.endsWith("/") ? "" : "/"}${entry}`;

      if (entry.endsWith("/")) {
        const dirName = entry.slice(0, -1).split("/").pop() || "";
        if (skipDirs.has(dirName)) {
          continue;
        }
        await walk(fullPath.slice(0, -1));
      } else {
        if (!isMatch(entry)) {
          continue;
        }

        filesVisited++;
        if (filesVisited > maxFilesVisited) {
          hitVisitCap = true;
          return;
        }

        let bytes: Uint8Array;
        try {
          bytes = await readGroupFileBytes(db, groupId, fullPath);
        } catch {
          continue;
        }

        // Skip oversized files.
        if (bytes.length > maxFileBytes) {
          continue;
        }

        // Skip binary files — avoids OOM from decoding + splitting large blobs.
        if (isBinaryContent(bytes)) {
          continue;
        }

        const content = new TextDecoder("utf-8").decode(bytes);
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          let matched: boolean;
          if (searchRegex) {
            // Clamp line length before regex testing to prevent ReDoS.
            const safeLine =
              line.length > MAX_REGEX_INPUT_LENGTH
                ? line.slice(0, MAX_REGEX_INPUT_LENGTH)
                : line;
            matched = searchRegex.test(safeLine);
          } else {
            matched = line.includes(pattern);
          }

          if (matched) {
            const displayLine =
              line.length > MAX_LINE_LENGTH
                ? line.slice(0, MAX_LINE_LENGTH) + "…"
                : line;
            results.push(`${fullPath}:${i + 1}: ${displayLine}`);

            if (results.length >= MAX_RESULTS) {
              results.push("... (results truncated at 500 matches)");
              hitResultCap = true;
              return;
            }
          }
        }
      }
    }
  }

  await walk(path || ".");

  if (hitVisitCap) {
    results.push(
      `... (file visit limit of ${maxFilesVisited} reached; narrow your search with path or file_glob)`,
    );
  }

  if (results.length === 0) {
    return "No matches found.";
  }

  return results.join("\n");
}
