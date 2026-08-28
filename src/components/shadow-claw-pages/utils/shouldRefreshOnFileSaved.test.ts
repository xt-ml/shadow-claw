import { shouldRefreshOnFileSaved } from "./shouldRefreshOnFileSaved.js";
import type { SavedPageRef } from "../../../db/types.js";

describe("shouldRefreshOnFileSaved", () => {
  const selectedPage: SavedPageRef = {
    groupId: "br:main",
    path: "docs/index.md",
  };

  it("returns true when event detail matches current selected page groupId and path", () => {
    const detail = { groupId: "br:main", path: "docs/index.md" };
    expect(shouldRefreshOnFileSaved(detail, selectedPage)).toBe(true);
  });

  it("normalizes 'main' group alias when comparing against 'br:main'", () => {
    const detail = { groupId: "main", path: "docs/index.md" };
    expect(shouldRefreshOnFileSaved(detail, selectedPage)).toBe(true);
  });

  it("returns false when detail is null or missing path/groupId", () => {
    expect(shouldRefreshOnFileSaved(null, selectedPage)).toBe(false);
    expect(shouldRefreshOnFileSaved({}, selectedPage)).toBe(false);
  });

  it("returns false when selectedPage is null", () => {
    const detail = { groupId: "br:main", path: "docs/index.md" };
    expect(shouldRefreshOnFileSaved(detail, null)).toBe(false);
  });

  it("returns false when paths or groupIds do not match", () => {
    const detailDifferentPath = { groupId: "br:main", path: "docs/other.md" };
    const detailDifferentGroup = { groupId: "group-2", path: "docs/index.md" };

    expect(shouldRefreshOnFileSaved(detailDifferentPath, selectedPage)).toBe(
      false,
    );
    expect(shouldRefreshOnFileSaved(detailDifferentGroup, selectedPage)).toBe(
      false,
    );
  });
});
