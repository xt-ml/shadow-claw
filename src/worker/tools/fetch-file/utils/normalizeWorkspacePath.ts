export function normalizeWorkspacePath(inputPath: string): string {
  return inputPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}