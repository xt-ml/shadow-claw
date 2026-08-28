import type { SavedPageRef } from "../../../db/types.js";
import { pageRefKey } from "./pageRefKey.js";

/**
 * Returns the index of the active page reference within a list of saved page references.
 * Returns -1 if the page is null or not found.
 */
export function getSelectedPageIndex(
  selectedPage: SavedPageRef | null,
  pages: SavedPageRef[] = [],
): number {
  if (!selectedPage) {
    return -1;
  }

  const targetKey = pageRefKey(selectedPage);
  return pages.findIndex((p) => pageRefKey(p) === targetKey);
}
