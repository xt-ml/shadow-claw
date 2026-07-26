/**
 * Minimal RFC 6901 JSON Pointer resolver (read).
 */
export function resolveJsonPointer(obj: unknown, pointer: string): unknown {
  if (!pointer || pointer === "/") {
    return obj;
  }

  const tokens = pointer
    .replace(/^\//, "")
    .split("/")
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));

  let current: unknown = obj;

  for (const token of tokens) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[token];
  }

  return current;
}
