/**
 * Parse a path into directory segments and filename.
 */
export function parsePath(filePath: string): {
  dirs: string[];
  filename: string;
} {
  const normalized = filePath
    .replace(/\\/g, "/")
    .replace(/^\/home\/user\//, "/")
    .replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) {
    throw new Error("Empty file path");
  }

  const filename = parts.pop();

  return { dirs: parts, filename: filename || "" };
}
