import { pageRefKey } from "./pageRefKey.js";
import type { SavedPageRef } from "../../../db/types.js";

describe("pageRefKey", () => {
  it("returns an empty string when page reference is null", () => {
    expect(pageRefKey(null)).toBe("");
  });

  it("returns normalized group ID and path separated by null character", () => {
    const page: SavedPageRef = { groupId: "group-1", path: "docs/index.md" };
    expect(pageRefKey(page)).toBe("group-1\u0000docs/index.md");
  });

  it("normalizes 'main' group ID to 'br:main'", () => {
    const page: SavedPageRef = { groupId: "main", path: "docs/readme.md" };
    expect(pageRefKey(page)).toBe("br:main\u0000docs/readme.md");
  });

  it("preserves non-main group IDs including 'br:main'", () => {
    const page: SavedPageRef = { groupId: "br:main", path: "docs/readme.md" };
    expect(pageRefKey(page)).toBe("br:main\u0000docs/readme.md");
  });
});
