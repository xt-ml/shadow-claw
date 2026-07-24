export function asNumber(
  value: unknown,
  fallback: number,
  options?: { min?: number; max?: number },
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  let result = parsed;
  if (typeof options?.min === "number") {
    result = Math.max(options.min, result);
  }

  if (typeof options?.max === "number") {
    result = Math.min(options.max, result);
  }

  return result;
}
