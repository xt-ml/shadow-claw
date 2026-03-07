/**
 * Escape special regex characters
 *
 * @param {string} s
 *
 * @returns {string}
 */
export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
