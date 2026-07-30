/**
 * Coerce persisted config values into a boolean.
 * Accepts common true-ish values stored in IndexedDB/localStorage.
 *
 * @param {unknown} value
 * @param {boolean} [defaultValue=false]
 * @returns {boolean}
 */
export function isTruthyConfigValue(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  return value === true || value === "true" || value === 1 || value === "1";
}
