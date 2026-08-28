import { groupPagesByGroup } from "./groupPagesByGroup.js";
import type { SavedPageRef } from "../../../db/types.js";

describe("groupPagesByGroup", () => {
  it("groups pages by groupId preserving item order", () => {
    const pages: SavedPageRef[] = [
      { groupId: "br:main", path: "docs/index.md" },
      { groupId: "group-2", path: "readme.md" },
      { groupId: "br:main", path: "docs/guide.md" },
    ];

    const result = groupPagesByGroup(pages);

    expect(result.size).toBe(2);
    expect(result.get("br:main")).toEqual([
      { groupId: "br:main", path: "docs/index.md" },
      { groupId: "br:main", path: "docs/guide.md" },
    ]);
    expect(result.get("group-2")).toEqual([
      { groupId: "group-2", path: "readme.md" },
    ]);
  });

  it("returns empty map for empty pages array", () => {
    const result = groupPagesByGroup([]);
    expect(result.size).toBe(0);
  });
});
