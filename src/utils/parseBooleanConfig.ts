export function parseBooleanConfig(
  value: string | null | undefined,
): boolean | null {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

/**
 * Coerces persisted config values into a boolean.
 * Accepts common true-ish values stored in IndexedDB/localStorage.
 */
export function isTruthyConfigValue(
  value: unknown,
  defaultValue = false,
): boolean {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  return value === true || value === "true" || value === 1 || value === "1";
}
