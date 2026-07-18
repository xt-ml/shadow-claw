import { normalizeStringList } from "./normalizeStringList.js";

/**
 * Parses a stored string value into a normalized list of strings.
 * Attempts JSON array parse first, then falls back to comma-separated.
 */
export function parseStoredStringList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return normalizeStringList(parsed.map((entry) => String(entry)));
    }
  } catch {
    // Fall back to comma-separated input for forward compatibility.
  }

  return normalizeStringList(value.split(","));
}
