export interface NormalizeWorkspacePathOptions {
  allowTraversal?: boolean;
}

export function hasPathTraversal(path: string): boolean {
  return path
    .split("/")
    .filter(Boolean)
    .some((part) => part === "..");
}

export function normalizeWorkspacePath(
  inputPath: string,
  options?: NormalizeWorkspacePathOptions,
): string {
  const normalized = inputPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");

  if (options?.allowTraversal === false && hasPathTraversal(normalized)) {
    throw new Error("Path traversal not allowed");
  }

  return normalized;
}
