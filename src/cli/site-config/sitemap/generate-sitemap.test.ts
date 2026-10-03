import { generateSitemapXml, getRoutePrettyPaths } from "./generate-sitemap.js";

describe("getRoutePrettyPaths", () => {
  it("returns pretty paths in declaration order", () => {
    expect(
      getRoutePrettyPaths({
        routes: {
          "/pages/main/index.html": { prettyPath: "/main" },
          "/pages/main/a.md": { prettyPath: "/main/a" },
        },
      }),
    ).toEqual(["/main", "/main/a"]);
  });

  it("skips routes without a prettyPath and de-duplicates", () => {
    expect(
      getRoutePrettyPaths({
        routes: {
          "/pages/a.md": {},
          "/pages/b.md": { prettyPath: "/b" },
          "/pages/c.md": { prettyPath: "/b" },
        },
      }),
    ).toEqual(["/b"]);
  });

  it("returns an empty list for missing or malformed input", () => {
    expect(getRoutePrettyPaths(null)).toEqual([]);
    expect(getRoutePrettyPaths({})).toEqual([]);
    expect(getRoutePrettyPaths({ routes: "nope" })).toEqual([]);
  });
});

describe("generateSitemapXml", () => {
  const routes = {
    routes: {
      "/pages/main/index.html": { prettyPath: "/" },
      "/pages/main/about.md": { prettyPath: "/about" },
      "/pages/main/posts/x.md": { prettyPath: "/posts/x/" },
    },
  };

  it("emits a valid urlset with the origin root first", () => {
    const xml = generateSitemapXml(routes, "https://example.com");

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(xml.match(/<loc>/g)).toHaveLength(3);
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<loc>https://example.com/about</loc>");
    expect(xml).toContain("<loc>https://example.com/posts/x/</loc>");
  });

  it("preserves a base path in the origin", () => {
    const xml = generateSitemapXml(
      { routes: { "/pages/main/index.html": { prettyPath: "/main" } } },
      "https://kherrick.github.io/pwgen-knowledge-hub/",
    );

    expect(xml).toContain(
      "<loc>https://kherrick.github.io/pwgen-knowledge-hub/main</loc>",
    );
  });

  it("always includes the site root even when routes do not map to it", () => {
    const xml = generateSitemapXml(
      { routes: { "/pages/main/index.html": { prettyPath: "/main" } } },
      "https://example.com/base",
    );

    expect(xml).toContain("<loc>https://example.com/base/</loc>");
    expect(xml).toContain("<loc>https://example.com/base/main</loc>");
    expect(xml.match(/<loc>/g)).toHaveLength(2);
  });

  it("does not duplicate the root when a route maps to it", () => {
    const xml = generateSitemapXml(routes, "https://example.com");

    expect(xml.match(/<loc>https:\/\/example\.com\/<\/loc>/g)).toHaveLength(1);
  });

  it("escapes XML special characters", () => {
    const xml = generateSitemapXml(
      { routes: { "/pages/a.md": { prettyPath: "/a&b" } } },
      "https://example.com",
    );

    expect(xml).toContain("<loc>https://example.com/a&amp;b</loc>");
  });

  it("emits only the root when there are no routes", () => {
    const xml = generateSitemapXml(null, "https://example.com");

    expect(xml.match(/<loc>/g)).toHaveLength(1);
    expect(xml).toContain("<loc>https://example.com/</loc>");
  });
});
