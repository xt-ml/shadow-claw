import { announcePageChange } from "./announcePageChange.js";
import type { SavedPageRef } from "../../../db/types.js";

describe("announcePageChange", () => {
  const page: SavedPageRef = {
    groupId: "br:main",
    path: "docs/readme.md",
  };

  it("announces title from frontmatter when provided", () => {
    const announcer = document.createElement("div");
    announcePageChange(page, "Custom Documentation Title", announcer);
    expect(announcer.textContent).toBe(
      "Navigated to page: Custom Documentation Title",
    );
  });

  it("falls back to page.path when frontmatter title is missing", () => {
    const announcer = document.createElement("div");
    announcePageChange(page, null, announcer);
    expect(announcer.textContent).toBe("Navigated to page: docs/readme.md");
  });

  it("handles null announcer gracefully", () => {
    expect(() => announcePageChange(page, "Title", null)).not.toThrow();
  });
});
