import { jest } from "@jest/globals";
import {
  clearStaticRoutesManifestCache,
  getEmbeddedStaticRoutesManifest,
  getStaticRoutingManifest,
  resolvePrettyPathToRoute,
  resolvePrettyPathToRouteAsync,
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

  it("resolves static routing manifest url correctly when location is deep path", () => {
    const origHref = window.location.href;
    try {
      window.history.pushState(
        {},
        "",
        "/pages/main/posts/2025/12/31/2025-12-31_00-08-00.md",
      );
      expect(resolveStaticRoutingManifestUrl()).toBe(
        `${window.location.origin}/static-routing.json`,
      );
    } finally {
      window.history.pushState({}, "", origHref);
    }
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

  it("fetches and merges subRoutes lazily using resolvePrettyPathToRouteAsync", async () => {
    const rootManifest: StaticRoutesManifest = {
      routes: {
        "/pages/main/test1.md": { prettyPath: "/test1" },
      },
      subRoutes: {
        "/test2": "sub1.json",
        "/test3": "sub2.json",
      },
    };

    const sub1Manifest: StaticRoutesManifest = {
      routes: {
        "/pages/main/test2.md": { prettyPath: "/test2" },
      },
    };

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = jest
      .fn<any>()
      .mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("static-routing.json"))
          return { ok: true, json: async () => rootManifest };
        if (urlStr.endsWith("sub1.json"))
          return { ok: true, json: async () => sub1Manifest };
        return { ok: false };
      });

    try {
      // First, getStaticRoutingManifest should just return the root without recursive fetch
      const result = await getStaticRoutingManifest();
      expect(result.routes["/pages/main/test1.md"]).toBeDefined();
      expect(result.routes["/pages/main/test2.md"]).toBeUndefined(); // Not fetched eagerly

      // Now, try to resolve /test2 using async method
      const route = await resolvePrettyPathToRouteAsync("/test2");

      expect(route).toEqual({
        page: "pages",
        groupId: "br:main",
        path: "test2.md",
      });

      // Now it should be merged into the cached manifest
      expect(result.routes["/pages/main/test2.md"]).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("resolves multi-level nested lazy subRoutes (year -> month -> day)", async () => {
    const rootManifest: StaticRoutesManifest = {
      routes: {},
      subRoutes: {
        "2026/": "pages/main/posts/2026/routes.json",
      },
    };

    const yearManifest: StaticRoutesManifest = {
      routes: {},
      subRoutes: {
        "2026/06/": "07/routes.json",
      },
    };

    const monthManifest: StaticRoutesManifest = {
      routes: {},
      subRoutes: {
        "2026/06/30/": "01/routes.json",
      },
    };

    const dayManifest: StaticRoutesManifest = {
      routes: {
        "/pages/main/posts/2026/07/01/post.md": {
          prettyPath: "/2026/06/30/on-developing-loops/",
        },
      },
    };

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = jest
      .fn<any>()
      .mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("static-routing.json"))
          return { ok: true, json: async () => rootManifest };
        if (urlStr.endsWith("pages/main/posts/2026/routes.json"))
          return { ok: true, json: async () => yearManifest };
        if (urlStr.endsWith("pages/main/posts/2026/07/routes.json"))
          return { ok: true, json: async () => monthManifest };
        if (urlStr.endsWith("pages/main/posts/2026/07/01/routes.json"))
          return { ok: true, json: async () => dayManifest };
        return { ok: false };
      });

    try {
      const route = await resolvePrettyPathToRouteAsync(
        "/2026/06/30/on-developing-loops/",
      );
      expect(route).toEqual({
        page: "pages",
        groupId: "br:main",
        path: "posts/2026/07/01/post.md",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("resolves 2025 nested lazy subRoutes (Sprite Garden and timezone-adjusted Block Garden)", async () => {
    const rootManifest: StaticRoutesManifest = {
      routes: {},
      subRoutes: {
        "2025/": "pages/main/posts/2025/routes.json",
      },
    };

    const yearManifest: StaticRoutesManifest = {
      routes: {},
      subRoutes: {
        "2025/10/": "10/routes.json",
        "2025/12/": "12/routes.json",
      },
    };

    const decMonthManifest: StaticRoutesManifest = {
      routes: {},
      subRoutes: {
        "2025/12/30/": "31/routes.json",
        "2025/12/31/": "31/routes.json",
      },
    };

    const blockGardenManifest: StaticRoutesManifest = {
      routes: {
        "/pages/main/posts/2025/12/31/2025-12-31_00-08-00.md": {
          prettyPath: "/2025/12/30/block-garden/",
        },
      },
    };

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = jest
      .fn<any>()
      .mockImplementation(async (url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("static-routing.json"))
          return { ok: true, json: async () => rootManifest };
        if (urlStr.endsWith("pages/main/posts/2025/routes.json"))
          return { ok: true, json: async () => yearManifest };
        if (urlStr.endsWith("pages/main/posts/2025/12/routes.json"))
          return { ok: true, json: async () => decMonthManifest };
        if (urlStr.endsWith("pages/main/posts/2025/12/31/routes.json"))
          return { ok: true, json: async () => blockGardenManifest };
        return { ok: false };
      });

    try {
      const route = await resolvePrettyPathToRouteAsync(
        "/2025/12/30/block-garden/",
      );
      expect(route).toEqual({
        page: "pages",
        groupId: "br:main",
        path: "posts/2025/12/31/2025-12-31_00-08-00.md",
      });
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
