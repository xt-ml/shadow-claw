/**
 * Deduplicates, trims, and filters empty strings from a list of strings.
 */
export function normalizeStringList(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}
