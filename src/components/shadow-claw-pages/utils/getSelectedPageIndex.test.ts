import { getSelectedPageIndex } from "./getSelectedPageIndex.js";
import type { SavedPageRef } from "../../../db/types.js";

describe("getSelectedPageIndex", () => {
  const pages: SavedPageRef[] = [
    { groupId: "br:main", path: "docs/index.md" },
    { groupId: "br:main", path: "docs/guide.md" },
    { groupId: "group-2", path: "readme.md" },
  ];

  it("returns -1 when selectedPage is null or undefined", () => {
    expect(getSelectedPageIndex(null, pages)).toBe(-1);
  });

  it("returns the 0-indexed position of matching page in list", () => {
    expect(
      getSelectedPageIndex(
        { groupId: "br:main", path: "docs/guide.md" },
        pages,
      ),
    ).toBe(1);
    expect(
      getSelectedPageIndex({ groupId: "group-2", path: "readme.md" }, pages),
    ).toBe(2);
  });

  it("normalizes 'main' group ID when matching against 'br:main'", () => {
    expect(
      getSelectedPageIndex({ groupId: "main", path: "docs/index.md" }, pages),
    ).toBe(0);
  });

  it("returns -1 if page is not found in pages array", () => {
    expect(
      getSelectedPageIndex({ groupId: "br:main", path: "unknown.md" }, pages),
    ).toBe(-1);
  });
});
