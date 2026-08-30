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

  it("resolves relative image link in file directory", () => {
    const result = resolveWorkspaceLinkPath(
      "01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg",
      "index.md",
      groupId,
      origin,
    );
    expect(result).toBe("01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg");
  });

  it("resolves relative links when subpath base tag is active", () => {
    document.querySelectorAll("base").forEach((el) => el.remove());
    const baseEl = document.createElement("base");
    baseEl.setAttribute("href", "/shadow-claw/");
    document.head.appendChild(baseEl);
    (globalThis as any).__applyBasePathCacheReset?.();

    try {
      const result = resolveWorkspaceLinkPath(
        "01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg",
        "index.md",
        groupId,
        origin,
      );
      expect(result).toBe("01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg");
    } finally {
      baseEl.remove();
      (globalThis as any).__applyBasePathCacheReset?.();
    }
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
