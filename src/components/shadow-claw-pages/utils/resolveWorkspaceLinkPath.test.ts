import { resolveWorkspaceLinkPath } from "./resolveWorkspaceLinkPath.js";

describe("resolveWorkspaceLinkPath", () => {
  const groupId = "br:main";
  const origin = "http://localhost:8888";

  it("returns null for empty href or fragment-only links", () => {
    expect(
      resolveWorkspaceLinkPath("", "index.md", groupId, origin),
    ).toBeNull();
    expect(
      resolveWorkspaceLinkPath("#section-1", "index.md", groupId, origin),
    ).toBeNull();
    expect(
      resolveWorkspaceLinkPath("   ", "index.md", groupId, origin),
    ).toBeNull();
  });

  it("resolves direct /files/ route candidates for matching group", () => {
    const result = resolveWorkspaceLinkPath(
      "files/br:main/docs/about.md",
      "index.md",
      "br:main",
      origin,
    );
    expect(result).toBe("docs/about.md");
  });

  it("resolves relative markdown links relative to current file route dir", () => {
    const result = resolveWorkspaceLinkPath(
      "guide.md",
      "docs/index.md",
      groupId,
      origin,
    );
    expect(result).toBe("docs/guide.md");
  });

  it("returns null if link points to external origin", () => {
    const result = resolveWorkspaceLinkPath(
      "https://example.com/page",
      "index.md",
      groupId,
      origin,
    );
    expect(result).toBeNull();
  });
});
