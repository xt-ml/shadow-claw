import type { SavedPageRef } from "../../../db/types.js";
import { routeGroupMatches } from "./routeGroupMatches.js";

/**
 * Determines whether a file-saved event details block matches the actively selected preview page.
 */
export function shouldRefreshOnFileSaved(
  detail: { groupId?: string; path?: string } | null | undefined,
  selectedPage: SavedPageRef | null | undefined,
): boolean {
  if (!detail || !selectedPage || !detail.groupId || !detail.path) {
    return false;
  }

  if (detail.path !== selectedPage.path) {
    return false;
  }

  return (
    detail.groupId === selectedPage.groupId ||
    routeGroupMatches(detail.groupId, selectedPage.groupId)
  );
}
