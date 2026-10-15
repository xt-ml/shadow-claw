import type { SavedPageRef } from "../../../db/types.js";

/**
 * Returns a unique composite key for a saved page reference.
 * Normalizes 'main' group ID to 'br:main'.
 */
export function pageRefKey(page: SavedPageRef | null): string {
  if (!page) {
    return "";
  }

  let normalizedGroupId = page.groupId;
  if (normalizedGroupId === "main") {
    normalizedGroupId = "br:main";
  }

  return `${normalizedGroupId}\u0000${page.path}`;
}
