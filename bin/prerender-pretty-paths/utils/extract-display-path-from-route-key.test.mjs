import { extractDisplayPathFromRouteKey } from "./extract-display-path-from-route-key.mjs";

describe("extractDisplayPathFromRouteKey", () => {
  it("extracts display paths from supported prefixes", () => {
    expect(
      extractDisplayPathFromRouteKey("/pages/main/posts/2026/post.md"),
    ).toBe("posts/2026/post.md");
    expect(extractDisplayPathFromRouteKey("/main/posts/2026/post.md")).toBe(
      "posts/2026/post.md",
    );
    expect(
      extractDisplayPathFromRouteKey("/pages/br-main/posts/2026/post.md"),
    ).toBe("posts/2026/post.md");
    expect(
      extractDisplayPathFromRouteKey("/pages/br:main/posts/2026/post.md"),
    ).toBe("posts/2026/post.md");
  });

  it("returns original clean path for unsupported or short pages/ route keys", () => {
    expect(extractDisplayPathFromRouteKey("/pages/x")).toBe("pages/x");
    expect(extractDisplayPathFromRouteKey("/pages/group/post.md")).toBe(
      "post.md",
    );
    expect(extractDisplayPathFromRouteKey("/other/path.md")).toBe(
      "other/path.md",
    );
  });
});
