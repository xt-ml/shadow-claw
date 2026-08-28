import { routeGroupMatches } from "./routeGroupMatches.js";

describe("routeGroupMatches", () => {
  it("returns true when group IDs are identical", () => {
    expect(routeGroupMatches("group-1", "group-1")).toBe(true);
    expect(routeGroupMatches("main", "main")).toBe(true);
  });

  it("returns true for 'main' and 'br:main' alias combinations", () => {
    expect(routeGroupMatches("main", "br:main")).toBe(true);
    expect(routeGroupMatches("br:main", "main")).toBe(true);
  });

  it("normalizes colons to hyphens when matching namespaced group IDs", () => {
    expect(routeGroupMatches("br:group1", "br-group1")).toBe(true);
    expect(routeGroupMatches("br-group1", "br:group1")).toBe(true);
  });

  it("returns false for non-matching group IDs without colons", () => {
    expect(routeGroupMatches("group1", "group2")).toBe(false);
  });

  it("returns false for different group IDs even with colons", () => {
    expect(routeGroupMatches("br:group1", "br:group2")).toBe(false);
  });
});
