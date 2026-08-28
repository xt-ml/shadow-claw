import { describe, it, expect, jest } from "@jest/globals";
import { handlePageReorder } from "./handlePageReorder.js";
import type { SavedPageRef, ShadowClawDatabase } from "../../../db/types.js";

describe("handlePageReorder", () => {
  const pages: SavedPageRef[] = [
    { groupId: "main", path: "a.md" },
    { groupId: "main", path: "b.md" },
  ];

  it("does nothing when db is null or fromIndex === toIndex", async () => {
    const reorderStoreFn = jest
      .fn<(db: ShadowClawDatabase, pages: SavedPageRef[]) => Promise<void>>()
      .mockResolvedValue(undefined);
    const result1 = await handlePageReorder({
      db: null,
      currentPages: pages,
      fromIndex: 0,
      toIndex: 1,
      reorderStoreFn,
    });
    expect(result1.reordered).toBe(false);

    const result2 = await handlePageReorder({
      db: {} as any,
      currentPages: pages,
      fromIndex: 0,
      toIndex: 0,
      reorderStoreFn,
    });
    expect(result2.reordered).toBe(false);
  });

  it("reorders pages and identifies when first page moved", async () => {
    const mockDb = {} as any;
    const reorderStoreFn = jest
      .fn<(db: ShadowClawDatabase, pages: SavedPageRef[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const result = await handlePageReorder({
      db: mockDb,
      currentPages: pages,
      fromIndex: 1,
      toIndex: 0,
      reorderStoreFn,
    });

    expect(reorderStoreFn).toHaveBeenCalledWith(mockDb, [
      { groupId: "main", path: "b.md" },
      { groupId: "main", path: "a.md" },
    ]);
    expect(result.reordered).toBe(true);
    expect(result.movedToFirst).toEqual({ groupId: "main", path: "b.md" });
  });
});
