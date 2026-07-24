export function hasPathTraversal(path: string): boolean {
  return path
    .split("/")
    .filter(Boolean)
    .some((part) => part === "..");
}
