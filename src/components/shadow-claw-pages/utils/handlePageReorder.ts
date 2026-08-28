import type { ShadowClawDatabase, SavedPageRef } from "../../../db/types.js";
import { reorderPagesList } from "./reorderPagesList.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";

export interface HandlePageReorderOptions {
  db: ShadowClawDatabase | null;
  currentPages: SavedPageRef[];
  fromIndex: number;
  toIndex: number;
  reorderStoreFn?: (
    db: ShadowClawDatabase,
    pages: SavedPageRef[],
  ) => Promise<void>;
}

export interface HandlePageReorderResult {
  reordered: boolean;
  reorderedPages: SavedPageRef[];
  movedToFirst: SavedPageRef | null;
}

/**
 * Handles page reorder operation, persisting new ordering and returning reordered state details.
 */
export async function handlePageReorder({
  db,
  currentPages,
  fromIndex,
  toIndex,
  reorderStoreFn = (database, pages) =>
    orchestratorStore.reorderPages(database, pages),
}: HandlePageReorderOptions): Promise<HandlePageReorderResult> {
  if (!db || fromIndex === toIndex) {
    return {
      reordered: false,
      reorderedPages: currentPages,
      movedToFirst: null,
    };
  }

  const reorderedPages = reorderPagesList(currentPages, fromIndex, toIndex);
  if (reorderedPages === currentPages) {
    return {
      reordered: false,
      reorderedPages: currentPages,
      movedToFirst: null,
    };
  }

  await reorderStoreFn(db, reorderedPages);
  const moved = reorderedPages[toIndex] || null;

  return {
    reordered: true,
    reorderedPages,
    movedToFirst: toIndex === 0 ? moved : null,
  };
}
