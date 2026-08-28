import { resolveWorkspaceFileTarget } from "./resolveWorkspaceFileTarget.js";

describe("resolveWorkspaceFileTarget", () => {
  const groupId = "br:main";
  const origin = "http://localhost:8888";
  const groups = [{ groupId: "br:main" }, { groupId: "other-group" }];

  it("returns null for empty href or fragment-only links", () => {
    expect(
      resolveWorkspaceFileTarget("", "index.md", groupId, groups, origin),
    ).toBeNull();
    expect(
      resolveWorkspaceFileTarget(
        "#header",
        "index.md",
        groupId,
        groups,
        origin,
      ),
    ).toBeNull();
  });

  it("resolves route request paths targeting a specific group", () => {
    const result = resolveWorkspaceFileTarget(
      "files/br:main/docs/guide.md",
      "index.md",
      groupId,
      groups,
      origin,
    );
    expect(result).toEqual({ groupId: "br:main", path: "docs/guide.md" });
  });

  it("resolves relative workspace links for current group", () => {
    const result = resolveWorkspaceFileTarget(
      "docs/readme.md",
      "index.md",
      groupId,
      groups,
      origin,
    );
    expect(result).toEqual({ groupId: "br:main", path: "docs/readme.md" });
  });
});
