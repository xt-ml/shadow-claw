export interface NumberOptions {
  min?: number;
  max?: number;
}

/**
 * Coerces an unknown value into a finite number, applying fallback and optional min/max clamping.
 */
export function coerceNumber(
  value: unknown,
  fallback: number,
  options?: NumberOptions,
): number {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return fallback;
  }

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

/**
 * Coerces an unknown value into an array of non-empty trimmed strings.
 */
export function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Coerces an unknown value into an array of unique positive integer IDs (UIDs).
 */
export function coerceUidArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uids = value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.floor(item));

  return Array.from(new Set(uids));
}

/**
 * Unified array coercion supporting string, uid, number, or custom mapping.
 */
export function coerceArray<T = any>(
  value: unknown,
  modeOrMapper:
    | "string"
    | "uid"
    | "number"
    | ((item: unknown) => T | undefined) = "string",
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (modeOrMapper === "string") {
    return coerceStringArray(value) as unknown as T[];
  }

  if (modeOrMapper === "uid") {
    return coerceUidArray(value) as unknown as T[];
  }

  if (modeOrMapper === "number") {
    return value
      .map((item) => (typeof item === "number" ? item : Number(item)))
      .filter((item) => Number.isFinite(item)) as unknown as T[];
  }

  if (typeof modeOrMapper === "function") {
    const results: T[] = [];
    for (const item of value) {
      const mapped = modeOrMapper(item);
      if (mapped !== undefined) {
        results.push(mapped);
      }
    }
    return results;
  }

  return [];
}

/**
 * Dual-purpose unified coercion utility.
 */
export function coerce(
  value: unknown,
  targetType: "number",
  fallback?: number,
  options?: NumberOptions,
): number;
export function coerce(value: unknown, targetType: "string-array"): string[];
export function coerce(value: unknown, targetType: "uid-array"): number[];
export function coerce(
  value: unknown,
  targetType: "number" | "string-array" | "uid-array",
  fallback = 0,
  options?: NumberOptions,
): any {
  if (targetType === "number") {
    return coerceNumber(value, fallback, options);
  }

  if (targetType === "string-array") {
    return coerceStringArray(value);
  }

  if (targetType === "uid-array") {
    return coerceUidArray(value);
  }

  return value;
}

// Backward-compatible aliases
export const asNumber = coerceNumber;
export const asStringArray = coerceStringArray;
export const asUidArray = coerceUidArray;
