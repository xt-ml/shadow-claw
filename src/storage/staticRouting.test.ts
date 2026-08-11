import { jest } from "@jest/globals";
import {
  clearStaticRoutesManifestCache,
  getEmbeddedStaticRoutesManifest,
  getStaticRoutingManifest,
  resolvePrettyPathToRoute,
  resolveRouteToPrettyPath,
  resolveStaticRoutingManifestUrl,
  setStaticRoutesManifest,
  STATIC_ROUTING_SCRIPT_ID,
  type StaticRoutesManifest,
} from "./staticRouting.js";

describe("staticRouting", () => {
  beforeEach(() => {
    clearStaticRoutesManifestCache();
    document
      .querySelectorAll(`script#${STATIC_ROUTING_SCRIPT_ID}`)
      .forEach((el) => el.remove());
  });

  afterEach(() => {
    clearStaticRoutesManifestCache();
    document
      .querySelectorAll(`script#${STATIC_ROUTING_SCRIPT_ID}`)
      .forEach((el) => el.remove());
  });

  it("resolves static routing manifest url correctly", () => {
    const url = resolveStaticRoutingManifestUrl();
    expect(url).toContain("static-routing.json");
  });

  it("reads manifest from embedded script element", () => {
    const manifest: StaticRoutesManifest = {
      routes: {
        "/pages/main/posts/2026-07-01_03-37-38.md": {
          prettyPath: "/2026/06/30/on-developing-loops/",
        },
      },
    };

    const script = document.createElement("script");
    script.id = STATIC_ROUTING_SCRIPT_ID;
    script.type = "application/json";
    script.textContent = JSON.stringify(manifest);
    document.head.appendChild(script);

    const embedded = getEmbeddedStaticRoutesManifest();
    expect(embedded).toEqual(manifest);
  });

  it("resolves pretty path to canonical ShadowClawAppRoute", () => {
    const manifest: StaticRoutesManifest = {
      routes: {
        "/pages/main/posts/2026-07-01_03-37-38.md": {
          prettyPath: "/2026/06/30/on-developing-loops/",
        },
        "/pages/main/about.md": {
          prettyPath: "/about",
        },
      },
    };

    // Test with explicit manifest
    expect(
      resolvePrettyPathToRoute("/2026/06/30/on-developing-loops/", manifest),
    ).toEqual({
      page: "pages",
      groupId: "br:main",
      path: "posts/2026-07-01_03-37-38.md",
    });

    // Test without trailing slash
    expect(
      resolvePrettyPathToRoute("/2026/06/30/on-developing-loops", manifest),
    ).toEqual({
      page: "pages",
      groupId: "br:main",
      path: "posts/2026-07-01_03-37-38.md",
    });

    // Test with index.html
    expect(
      resolvePrettyPathToRoute(
        "/2026/06/30/on-developing-loops/index.html",
        manifest,
      ),
    ).toEqual({
      page: "pages",
      groupId: "br:main",
      path: "posts/2026-07-01_03-37-38.md",
    });

    expect(resolvePrettyPathToRoute("/about", manifest)).toEqual({
      page: "pages",
      groupId: "br:main",
      path: "about.md",
    });

    // Unmatched path returns null
    expect(resolvePrettyPathToRoute("/unknown/path", manifest)).toBeNull();
  });

  it("resolves route to pretty path", () => {
    const manifest: StaticRoutesManifest = {
      routes: {
        "/pages/main/posts/2026-07-01_03-37-38.md": {
          prettyPath: "/2026/06/30/on-developing-loops/",
        },
        "/pages/main/about.md": {
          prettyPath: "/about/",
        },
      },
    };

    expect(
      resolveRouteToPrettyPath(
        {
          page: "pages",
          groupId: "br:main",
          path: "posts/2026-07-01_03-37-38.md",
        },
        manifest,
      ),
    ).toBe("/2026/06/30/on-developing-loops/");

    expect(
      resolveRouteToPrettyPath(
        { page: "pages", groupId: "main", path: "about.md" },
        manifest,
      ),
    ).toBe("/about/");

    expect(
      resolveRouteToPrettyPath(
        { page: "pages", groupId: "br:main", path: "nonexistent.md" },
        manifest,
      ),
    ).toBeNull();
  });

  it("fetches static routing manifest when not embedded in DOM", async () => {
    const manifest: StaticRoutesManifest = {
      routes: {
        "/pages/main/test.md": {
          prettyPath: "/test-pretty",
        },
      },
    };

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = jest.fn<any>().mockResolvedValue({
      ok: true,
      json: async () => manifest,
    });

    try {
      const result = await getStaticRoutingManifest();
      expect(result).toEqual(manifest);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("supports programmatic override with setStaticRoutesManifest", () => {
    const customManifest: StaticRoutesManifest = {
      routes: {
        "/pages/main/custom.md": {
          prettyPath: "/custom-url/",
        },
      },
    };

    setStaticRoutesManifest(customManifest);
    expect(resolvePrettyPathToRoute("/custom-url/")).toEqual({
      page: "pages",
      groupId: "br:main",
      path: "custom.md",
    });
  });
});
