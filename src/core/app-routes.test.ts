import {
  applyBasePath,
  buildRoutePath,
  getAppBasePath,
  getDeploymentNamespace,
  getFileRouteDirPath,
  getWorkspaceRouteRequestPath,
  parseRouteFromUrl,
  resolveHrefAgainstRoute,
} from "./app-routes.js";

describe("app-routes", () => {
  it("builds requested restful route examples", () => {
    expect(buildRoutePath({ page: "pages" })).toBe("/pages");
    expect(buildRoutePath({ page: "pages", path: "example.html" })).toBe(
      "/pages/example.html",
    );
    expect(
      buildRoutePath({
        page: "pages",
        groupId: "br:main",
        path: "MEMORY.md",
      }),
    ).toBe("/pages/main/MEMORY.md");

    expect(buildRoutePath({ page: "chat" })).toBe("/chat");
    expect(buildRoutePath({ page: "chat", groupId: "br:main" })).toBe(
      "/chat/main/",
    );

    expect(buildRoutePath({ page: "files" })).toBe("/files");
    expect(buildRoutePath({ page: "files", groupId: "br:main" })).toBe(
      "/files/main/",
    );
    expect(
      buildRoutePath({
        page: "files",
        groupId: "group-1",
        path: "path/to/file.md",
      }),
    ).toBe("/files/group-1/path/to/file.md");
    expect(
      buildRoutePath({
        page: "files",
        groupId: "group-1",
        path: "folder-of-files",
      }),
    ).toBe("/files/group-1/folder-of-files");

    expect(buildRoutePath({ page: "tasks" })).toBe("/tasks");
    expect(buildRoutePath({ page: "tasks", groupId: "group-1" })).toBe(
      "/tasks/group-1/",
    );

    expect(buildRoutePath({ page: "settings" })).toBe("/settings");
    expect(buildRoutePath({ page: "tools" })).toBe(
      "/settings/tool-configuration",
    );
  });

  it("parses route paths", () => {
    expect(
      parseRouteFromUrl(
        new URL("http://localhost/chat/br-01KT4NGEM3T94M0FGHJYVNGS7M"),
      ),
    ).toEqual({
      page: "chat",
      groupId: "br:01KT4NGEM3T94M0FGHJYVNGS7M",
      anchor: undefined,
    });

    expect(
      parseRouteFromUrl(
        new URL("http://localhost/files/group-1/docs/notes.md"),
      ),
    ).toEqual({
      page: "files",
      groupId: "group-1",
      path: "docs/notes.md",
      anchor: undefined,
    });

    expect(
      parseRouteFromUrl(
        new URL("http://localhost/pages/group-1/README.md#overview"),
      ),
    ).toEqual({
      page: "pages",
      groupId: "group-1",
      path: "README.md",
      anchor: "overview",
    });

    expect(
      parseRouteFromUrl(
        new URL("http://localhost/settings/tool-configuration"),
      ),
    ).toEqual({ page: "tools", anchor: undefined });
  });

  it("resolves href against route base", () => {
    const resolved = resolveHrefAgainstRoute(
      "../img/logo.png",
      "/files/group-1/docs/guides/",
      "http://localhost",
    );

    expect(resolved?.pathname).toBe("/files/group-1/docs/img/logo.png");
  });

  it("creates file route directory base path", () => {
    expect(getFileRouteDirPath("group-1", "docs/guide.md")).toBe(
      "/files/group-1/docs/",
    );
  });

  it("extracts workspace fetch target from files routes", () => {
    expect(
      getWorkspaceRouteRequestPath("/files/group-1/assets/logo.png"),
    ).toEqual({
      groupId: "group-1",
      path: "assets/logo.png",
    });

    expect(getWorkspaceRouteRequestPath("/pages/group-1/assets/logo.png")).toBe(
      null,
    );
  });

  it("normalizes main and br-main groupId aliases in getWorkspaceRouteRequestPath", () => {
    // /files/main/... should resolve to the canonical br:main groupId
    expect(
      getWorkspaceRouteRequestPath("/files/main/posts/2003-08-27.md"),
    ).toEqual({
      groupId: "br:main",
      path: "posts/2003-08-27.md",
    });

    // /files/br-main/... (legacy URL form) should also normalize to br:main
    expect(
      getWorkspaceRouteRequestPath("/files/br-main/posts/2003-08-27.md"),
    ).toEqual({
      groupId: "br:main",
      path: "posts/2003-08-27.md",
    });
  });

  describe("applyBasePath", () => {
    // Reset cached base path between tests
    beforeEach(() => {
      // Force-reset the module-level cache so each sub-test starts fresh.
      // We do this by temporarily reassigning window.location via jsdom.
      (globalThis as any).__applyBasePathCacheReset?.();
    });

    it("returns path unchanged when base is root", () => {
      // In jsdom the default base path resolves to "/"
      expect(applyBasePath("/chat")).toBe("/chat");
      expect(applyBasePath("/settings")).toBe("/settings");
    });

    it("does not double-prefix a path already containing the base", () => {
      // Simulate a /shadow-claw/ base by calling resolveHrefAgainstRoute
      // which internally calls applyBasePath. We test the guard directly:
      const base = getAppBasePath(); // "/" in jsdom
      const path = `${base}chat`;
      // Calling applyBasePath on a path that already starts with the base
      // should return the original path unchanged.
      const once = applyBasePath(path);
      const twice = applyBasePath(once);
      expect(once).toBe(twice);
    });

    it("resolves absolute hrefs correctly via resolveHrefAgainstRoute", () => {
      const resolved = resolveHrefAgainstRoute(
        "/settings",
        "/files/group-1/docs/guides/",
        "http://localhost",
      );
      // With root base path in jsdom, /settings stays /settings
      expect(resolved?.pathname).toBe("/settings");
    });

    it("parses subpath-prefixed URLs correctly", () => {
      // Simulate GitHub Pages subpath: /shadow-claw/chat/main
      // parseRouteFromUrl should strip the prefix before parsing.
      // Since jsdom has base "/", this tests the raw parser path.
      expect(parseRouteFromUrl(new URL("http://localhost/chat/main"))).toEqual({
        page: "chat",
        groupId: "br:main",
        anchor: undefined,
      });
    });
  });

  describe("pretty path routing", () => {
    beforeEach(() => {
      document
        .querySelectorAll("script#shadow-claw-static-routing")
        .forEach((el) => el.remove());
    });

    afterEach(() => {
      document
        .querySelectorAll("script#shadow-claw-static-routing")
        .forEach((el) => el.remove());
    });

    it("parses pretty path URL when static routing manifest is present", () => {
      const script = document.createElement("script");
      script.id = "shadow-claw-static-routing";
      script.type = "application/json";
      script.textContent = JSON.stringify({
        routes: {
          "/pages/main/posts/2026-07-01_03-37-38.md": {
            prettyPath: "/2026/06/30/on-developing-loops/",
          },
        },
      });
      document.head.appendChild(script);

      expect(
        parseRouteFromUrl(
          new URL("http://localhost/2026/06/30/on-developing-loops/"),
        ),
      ).toEqual({
        page: "pages",
        groupId: "br:main",
        path: "posts/2026-07-01_03-37-38.md",
        anchor: undefined,
      });

      // With anchor
      expect(
        parseRouteFromUrl(
          new URL("http://localhost/2026/06/30/on-developing-loops/#video"),
        ),
      ).toEqual({
        page: "pages",
        groupId: "br:main",
        path: "posts/2026-07-01_03-37-38.md",
        anchor: "video",
      });
    });

    it("builds pretty path URL when static route is configured", () => {
      const script = document.createElement("script");
      script.id = "shadow-claw-static-routing";
      script.type = "application/json";
      script.textContent = JSON.stringify({
        routes: {
          "/pages/main/posts/2026-07-01_03-37-38.md": {
            prettyPath: "/2026/06/30/on-developing-loops/",
          },
        },
      });
      document.head.appendChild(script);

      expect(
        buildRoutePath({
          page: "pages",
          groupId: "br:main",
          path: "posts/2026-07-01_03-37-38.md",
        }),
      ).toBe("/2026/06/30/on-developing-loops/");

      // With anchor
      expect(
        buildRoutePath({
          page: "pages",
          groupId: "br:main",
          path: "posts/2026-07-01_03-37-38.md",
          anchor: "section-1",
        }),
      ).toBe("/2026/06/30/on-developing-loops/#section-1");
    });

    it("maintains root base path and correctly routes to /files from a pretty URL", () => {
      const script = document.createElement("script");
      script.id = "shadow-claw-static-routing";
      script.type = "application/json";
      script.textContent = JSON.stringify({
        routes: {
          "/pages/main/posts/2026-07-01_03-37-38.md": {
            prettyPath: "/2026/06/30/on-developing-loops/",
          },
        },
      });
      document.head.appendChild(script);

      // Simulate being on the pretty URL in browser
      window.history.pushState({}, "", "/2026/06/30/on-developing-loops/");
      (globalThis as any).__applyBasePathCacheReset?.();

      expect(getAppBasePath()).toBe("/");

      // Navigating to files must yield /files/main/ or /files, NOT /2026/06/30/on-developing-loops/files/main/
      const filesRoutePath = buildRoutePath({
        page: "files",
        groupId: "br:main",
      });
      expect(filesRoutePath).toBe("/files/main/");
      expect(applyBasePath(filesRoutePath)).toBe("/files/main/");

      const filesPagePath = buildRoutePath({ page: "files" });
      expect(filesPagePath).toBe("/files");
      expect(applyBasePath(filesPagePath)).toBe("/files");

      // Navigating back to the pretty URL (with and without trailing slash) parses correctly
      expect(
        parseRouteFromUrl(
          new URL("http://localhost/2026/06/30/on-developing-loops/"),
        ),
      ).toEqual({
        page: "pages",
        groupId: "br:main",
        path: "posts/2026-07-01_03-37-38.md",
        anchor: undefined,
      });

      expect(
        parseRouteFromUrl(
          new URL("http://localhost/2026/06/30/on-developing-loops"),
        ),
      ).toEqual({
        page: "pages",
        groupId: "br:main",
        path: "posts/2026-07-01_03-37-38.md",
        anchor: undefined,
      });
    });

    it("returns null when parsing invalid nested subpaths under pretty URLs", () => {
      const script = document.createElement("script");
      script.id = "shadow-claw-static-routing";
      script.type = "application/json";
      script.textContent = JSON.stringify({
        routes: {
          "/pages/main/posts/2026-07-01_03-37-38.md": {
            prettyPath: "/2026/06/30/on-developing-loops/",
          },
        },
      });
      document.head.appendChild(script);

      // Deep linked invalid nested subpaths should not resolve to routes
      expect(
        parseRouteFromUrl(
          new URL(
            "http://localhost/2026/06/30/on-developing-loops/files/main/",
          ),
        ),
      ).toBeNull();

      expect(
        parseRouteFromUrl(
          new URL("http://localhost/2026/06/30/on-developing-loops/chat"),
        ),
      ).toBeNull();
    });

    it("respects explicit <base href> tag for subpath deployments", () => {
      const baseEl = document.createElement("base");
      baseEl.setAttribute("href", "/subpath/");
      document.head.appendChild(baseEl);

      const script = document.createElement("script");
      script.id = "shadow-claw-static-routing";
      script.type = "application/json";
      script.textContent = JSON.stringify({
        routes: {
          "/pages/main/posts/2026-07-01_03-37-38.md": {
            prettyPath: "/2026/06/30/on-developing-loops/",
          },
        },
      });
      document.head.appendChild(script);

      window.history.pushState(
        {},
        "",
        "/subpath/2026/06/30/on-developing-loops/",
      );
      (globalThis as any).__applyBasePathCacheReset?.();

      expect(getAppBasePath()).toBe("/subpath/");

      const filesRoutePath = buildRoutePath({
        page: "files",
        groupId: "br:main",
      });
      expect(applyBasePath(filesRoutePath)).toBe("/subpath/files/main/");

      expect(
        parseRouteFromUrl(
          new URL("http://localhost/subpath/2026/06/30/on-developing-loops/"),
        ),
      ).toEqual({
        page: "pages",
        groupId: "br:main",
        path: "posts/2026-07-01_03-37-38.md",
        anchor: undefined,
      });

      baseEl.remove();
    });
  });

  describe("getDeploymentNamespace", () => {
    beforeEach(() => {
      (globalThis as any).__applyBasePathCacheReset?.();
      delete (window as any).__SHADOWCLAW_DEPLOY_ID__;
      delete process.env.SHADOWCLAW_DEPLOY_ID;
    });

    afterEach(() => {
      delete (window as any).__SHADOWCLAW_DEPLOY_ID__;
      delete process.env.SHADOWCLAW_DEPLOY_ID;
    });

    it("returns empty string when base path is root", () => {
      expect(getDeploymentNamespace()).toBe("");
    });

    it("derives clean namespace from subpath base path", () => {
      const baseEl = document.createElement("base");
      baseEl.setAttribute("href", "/shadow-claw-deploy-1/");
      document.head.appendChild(baseEl);
      (globalThis as any).__applyBasePathCacheReset?.();

      expect(getDeploymentNamespace()).toBe("shadow-claw-deploy-1");

      baseEl.remove();
    });

    it("respects explicit window.__SHADOWCLAW_DEPLOY_ID__ override", () => {
      (window as any).__SHADOWCLAW_DEPLOY_ID__ = "deploy-custom-1";
      expect(getDeploymentNamespace()).toBe("deploy-custom-1");
    });

    it("respects process.env.SHADOWCLAW_DEPLOY_ID override when window override is absent", () => {
      process.env.SHADOWCLAW_DEPLOY_ID = "deploy-env-2";
      expect(getDeploymentNamespace()).toBe("deploy-env-2");
    });

    it("derives subpath deployment namespace when running in Web Worker context", () => {
      const originalSelf = (globalThis as any).self;
      class MockWorkerGlobalScope {}
      (globalThis as any).WorkerGlobalScope = MockWorkerGlobalScope;
      try {
        const mockWorkerSelf = Object.create(MockWorkerGlobalScope.prototype);
        mockWorkerSelf.location = new URL(
          "http://localhost/shadow-claw/assets/agent.worker.js",
        );
        (globalThis as any).self = mockWorkerSelf;
        (globalThis as any).__applyBasePathCacheReset?.();

        expect(getDeploymentNamespace()).toBe("shadow-claw");
      } finally {
        delete (globalThis as any).WorkerGlobalScope;
        (globalThis as any).self = originalSelf;
        (globalThis as any).__applyBasePathCacheReset?.();
      }
    });
  });
});
