export function asUidArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uids = value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.floor(item));

  return Array.from(new Set(uids));
}
