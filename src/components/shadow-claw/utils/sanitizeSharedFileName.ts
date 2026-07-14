export function sanitizeSharedFileName(
  name: string,
  fallbackBase: string,
): string {
  const normalized =
    name.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";

  const collapsed = normalized
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (collapsed) {
    return collapsed;
  }

  return `${fallbackBase}.txt`;
}
