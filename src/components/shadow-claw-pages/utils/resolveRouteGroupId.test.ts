import { resolveRouteGroupId } from "./resolveRouteGroupId.js";

describe("resolveRouteGroupId", () => {
  const groups = [
    { groupId: "group-1" },
    { groupId: "br:main" },
    { groupId: "custom-group" },
  ];

  it("returns expectedGroupId if routeGroupId matches expectedGroupId directly or via alias", () => {
    expect(resolveRouteGroupId("group-1", "group-1", groups)).toBe("group-1");
    expect(resolveRouteGroupId("main", "br:main", groups)).toBe("br:main");
    expect(resolveRouteGroupId("br:main", "main", groups)).toBe("main");
  });

  it("returns exact group ID if found in groups array", () => {
    expect(resolveRouteGroupId("custom-group", "group-1", groups)).toBe(
      "custom-group",
    );
  });

  it("returns matching group ID from groups array via alias match", () => {
    expect(resolveRouteGroupId("main", "other-group", groups)).toBe("br:main");
  });

  it("returns routeGroupId if not found in groups array", () => {
    expect(resolveRouteGroupId("unknown-group", "group-1", groups)).toBe(
      "unknown-group",
    );
  });

  it("returns null if routeGroupId is empty string", () => {
    expect(resolveRouteGroupId("", "group-1", groups)).toBeNull();
  });
});
