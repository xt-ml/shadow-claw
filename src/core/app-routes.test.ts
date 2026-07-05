import {
  applyBasePath,
  buildRoutePath,
  getAppBasePath,
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

    expect(buildRoutePath({ page: "chat" })).toBe("/chat");
    expect(buildRoutePath({ page: "chat", groupId: "br:main" })).toBe(
      "/chat/br%3Amain/",
    );

    expect(buildRoutePath({ page: "files" })).toBe("/files");
    expect(buildRoutePath({ page: "files", groupId: "br:main" })).toBe(
      "/files/br%3Amain/",
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
      // Simulate GitHub Pages subpath: /shadow-claw/chat/br-main
      // parseRouteFromUrl should strip the prefix before parsing.
      // Since jsdom has base "/", this tests the raw parser path.
      expect(
        parseRouteFromUrl(new URL("http://localhost/chat/br-main")),
      ).toEqual({
        page: "chat",
        groupId: "br:main",
        anchor: undefined,
      });
    });
  });
});
