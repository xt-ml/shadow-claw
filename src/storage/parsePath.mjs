/**
 * Parse a path into directory segments and filename.
 *
 * @param {string} filePath
 *
 * @returns {{ dirs: string[]; filename: string }}
 */
export function parsePath(filePath) {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) {
    throw new Error("Empty file path");
  }

  const filename = parts.pop();
  return { dirs: parts, filename: filename || "" };
}
