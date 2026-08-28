import { handleFileSavedEvent } from "./handleFileSavedEvent.js";
import type { SavedPageRef } from "../../../db/types.js";

describe("handleFileSavedEvent", () => {
  const selectedPage: SavedPageRef = {
    groupId: "group-1",
    path: "doc.md",
  };

  it("returns true when event detail matches selected page", () => {
    const event = new CustomEvent("shadow-claw-file-saved", {
      detail: { groupId: "group-1", path: "doc.md" },
    });

    expect(handleFileSavedEvent(event, selectedPage)).toBe(true);
  });

  it("returns false when event detail does not match selected page", () => {
    const event = new CustomEvent("shadow-claw-file-saved", {
      detail: { groupId: "group-1", path: "other.md" },
    });

    expect(handleFileSavedEvent(event, selectedPage)).toBe(false);
  });
});
