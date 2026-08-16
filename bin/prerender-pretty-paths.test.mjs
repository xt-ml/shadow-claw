import {
  injectStaticRoutingScript,
  prerenderPrettyPaths,
} from "./prerender-pretty-paths.mjs";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { escapeJsonForHtmlScript } from "./prerender-dsd-shell.mjs";

describe("injectStaticRoutingScript", () => {
  it("escapes script tags, HTML comments, and special characters in routing JSON", () => {
    const rawRouting = {
      routes: {
        "/pages/main/posts/2026-07-01_03-37-38.md": {
          prettyPath: "/2026/06/30/on-developing-loops/",
        },
      },
    };

    const routingJson = JSON.stringify(rawRouting);
    const htmlHost =
      "<html><head></head><body><shadow-claw></shadow-claw></body></html>";
    const injectedHtml = injectStaticRoutingScript(htmlHost, routingJson);

    expect(injectedHtml).toContain('id="shadow-claw-static-routing"');
    const scriptMatch = injectedHtml.match(
      /<script id="shadow-claw-static-routing"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(scriptMatch).not.toBeNull();
    const scriptContent = scriptMatch[1];
    expect(scriptContent).not.toContain("</script>");

    const parsed = JSON.parse(scriptContent);
    expect(parsed).toEqual(rawRouting);
  });

  it("replaces existing static routing script tag if already present", () => {
    const originalRouting = { routes: { "/a": { prettyPath: "/old" } } };
    const newRouting = { routes: { "/a": { prettyPath: "/new" } } };

    const initialHtml = injectStaticRoutingScript(
      "<html><head></head><body></body></html>",
      JSON.stringify(originalRouting),
    );
    expect(initialHtml).toContain("\\u002fold");

    const updatedHtml = injectStaticRoutingScript(
      initialHtml,
      JSON.stringify(newRouting),
    );
    expect(updatedHtml).not.toContain("\\u002fold");
    expect(updatedHtml).toContain("\\u002fnew");
    const matches = updatedHtml.match(/id="shadow-claw-static-routing"/g);
    expect(matches).toHaveLength(1);
  });
});

describe("prerenderPrettyPaths", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `sc-pretty-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("handles missing routes.json gracefully without error", async () => {
    const result = await prerenderPrettyPaths({
      publicDir: path.join(tmpDir, "dist/public"),
      routesPath: path.join(tmpDir, "pages/routes.json"),
      sourcePath: path.join(tmpDir, "pages/main"),
      indexPath: path.join(tmpDir, "dist/public/index.html"),
    });

    expect(result.count).toBe(0);
    expect(result.skipped).toBe(true);
  });

  it("prerenders static HTML at prettyPath locations for each route in routes.json", async () => {
    const publicDir = path.join(tmpDir, "dist/public");
    const indexPath = path.join(publicDir, "index.html");
    const sourcePath = path.join(tmpDir, "pages/main");
    const routesPath = path.join(tmpDir, "pages/routes.json");

    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });
    await mkdir(path.join(sourcePath, "posts"), { recursive: true });
    await mkdir(path.dirname(routesPath), { recursive: true });

    await writeFile(
      indexPath,
      '<!doctype html><html><head><base href="/"><title>ShadowClaw</title></head><body><shadow-claw></shadow-claw></body></html>',
      "utf8",
    );
    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      '<template><div class="app"><shadow-claw-pages></shadow-claw-pages></div></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      '<template><div class="pages__list" data-pages-list role="list"></div><div class="pages__rendered" data-pages-rendered hidden></div><div class="pages__empty" data-pages-empty></div><shadow-claw-page-header title="Pages"></shadow-claw-page-header></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      '<template><header class="header"><h2 class="header__title"></h2><details class="header__actions-disclosure"></details><div class="header__actions" id="header-actions-panel"></div></header></template>',
      "utf8",
    );

    const postContent = [
      "---",
      'title: "On Developing Loops"',
      'slug: "on-developing-loops"',
      "---",
      "# On Developing Loops",
      "",
      "This is SSR content for pretty path.",
    ].join("\n");

    await writeFile(
      path.join(sourcePath, "posts/2026-07-01_03-37-38.md"),
      postContent,
      "utf8",
    );

    const routesJson = {
      routes: {
        "/pages/main/posts/2026-07-01_03-37-38.md": {
          prettyPath: "/2026/06/30/on-developing-loops/",
        },
      },
    };

    await writeFile(routesPath, JSON.stringify(routesJson, null, 2), "utf8");

    const result = await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      indexPath,
    });

    expect(result.count).toBe(1);
    expect(result.generatedPaths).toContain(
      "2026/06/30/on-developing-loops/index.html",
    );

    // Check that dist/public/2026/06/30/on-developing-loops/index.html exists and has content
    const prettyHtmlPath = path.join(
      publicDir,
      "2026/06/30/on-developing-loops/index.html",
    );
    const prettyHtml = await readFile(prettyHtmlPath, "utf8");

    expect(prettyHtml).toContain("On Developing Loops");
    expect(prettyHtml).toContain("This is SSR content for pretty path.");
    expect(prettyHtml).toContain('id="shadow-claw-static-routing"');
    expect(prettyHtml).toContain('id="shadow-claw-static-manifest"');
    expect(prettyHtml).toContain('data-shadow-claw-dsd="true"');

    // Check that embedded manifest in pretty path HTML has ONLY the 1 current page by default
    const manifestMatch = prettyHtml.match(
      /<script id="shadow-claw-static-manifest"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(manifestMatch).not.toBeNull();
    const embeddedManifest = JSON.parse(manifestMatch[1]);
    expect(embeddedManifest.pages).toHaveLength(1);
    expect(embeddedManifest.pages[0].displayPath).toBe(
      "posts/2026-07-01_03-37-38.md",
    );

    // Check that static-routing.json was written
    const manifestPath = path.join(publicDir, "static-routing.json");
    const manifestContent = await readFile(manifestPath, "utf8");
    const parsedManifest = JSON.parse(manifestContent);
    expect(
      parsedManifest.routes["/pages/main/posts/2026-07-01_03-37-38.md"]
        .prettyPath,
    ).toBe("/2026/06/30/on-developing-loops/");

    // Check that static-main-manifest.json was written with full manifest
    const staticMainManifestPath = path.join(
      publicDir,
      "static-main-manifest.json",
    );
    const staticMainManifestContent = await readFile(
      staticMainManifestPath,
      "utf8",
    );
    const parsedStaticMainManifest = JSON.parse(staticMainManifestContent);
    expect(parsedStaticMainManifest.pages).toHaveLength(1);

    // Check that root index.html also received the static routing script
    const rootHtml = await readFile(indexPath, "utf8");
    expect(rootHtml).toContain('id="shadow-claw-static-routing"');
  });

  it("recursively loads and merges subRoutes", async () => {
    const publicDir = path.join(tmpDir, "dist/public");
    const indexPath = path.join(publicDir, "index.html");
    const sourcePath = path.join(tmpDir, "pages/main");
    const routesPath = path.join(tmpDir, "pages/routes.json");

    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });
    await mkdir(path.join(sourcePath, "posts"), { recursive: true });
    await mkdir(path.dirname(routesPath), { recursive: true });

    await writeFile(
      indexPath,
      '<!doctype html><html><head><base href="/"><title>ShadowClaw</title></head><body><shadow-claw></shadow-claw></body></html>',
      "utf8",
    );
    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      "<template></template>",
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      "<template></template>",
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      "<template></template>",
      "utf8",
    );

    const routesJson = {
      routes: {
        "/pages/main/posts/main.md": { prettyPath: "/main-post/" },
      },
      subRoutes: ["sub-routes.json"],
    };
    await writeFile(routesPath, JSON.stringify(routesJson, null, 2), "utf8");

    const subRoutesJson = {
      routes: {
        "/pages/main/posts/sub.md": { prettyPath: "/sub-post/" },
      },
    };
    await writeFile(
      path.join(tmpDir, "pages/sub-routes.json"),
      JSON.stringify(subRoutesJson, null, 2),
      "utf8",
    );

    await writeFile(path.join(sourcePath, "posts/main.md"), "main", "utf8");
    await writeFile(path.join(sourcePath, "posts/sub.md"), "sub", "utf8");

    const result = await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      indexPath,
      prerenderPages: 0,
    });

    expect(result.count).toBe(2);
    expect(result.generatedPaths).toContain("main-post/index.html");
    expect(result.generatedPaths).toContain("sub-post/index.html");

    // Check that subRoutes property is removed from final routing json
    const manifestPath = path.join(publicDir, "static-routing.json");
    const manifestContent = await readFile(manifestPath, "utf8");
    const parsedManifest = JSON.parse(manifestContent);
    expect(parsedManifest.subRoutes).toBeUndefined();
    expect(parsedManifest.routes["/pages/main/posts/sub.md"].prettyPath).toBe(
      "/sub-post/",
    );
  });

  it("embeds all pages when prerenderPages is 'all'", async () => {
    const publicDir = path.join(tmpDir, "dist/public");
    const indexPath = path.join(publicDir, "index.html");
    const sourcePath = path.join(tmpDir, "pages/main");
    const routesPath = path.join(tmpDir, "pages/routes.json");

    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });
    await mkdir(path.join(sourcePath, "posts"), { recursive: true });
    await mkdir(path.dirname(routesPath), { recursive: true });

    await writeFile(
      indexPath,
      '<!doctype html><html><head><base href="/"><title>ShadowClaw</title></head><body><shadow-claw></shadow-claw></body></html>',
      "utf8",
    );
    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      '<template><div class="app"><shadow-claw-pages></shadow-claw-pages></div></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      '<template><div class="pages__list" data-pages-list role="list"></div><div class="pages__rendered" data-pages-rendered hidden></div><div class="pages__empty" data-pages-empty></div><shadow-claw-page-header title="Pages"></shadow-claw-page-header></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      '<template><header class="header"><h2 class="header__title"></h2><details class="header__actions-disclosure"></details><div class="header__actions" id="header-actions-panel"></div></header></template>',
      "utf8",
    );

    await writeFile(
      path.join(sourcePath, "posts/post1.md"),
      '---\ntitle: "Post 1"\n---\n# Post 1',
      "utf8",
    );
    await writeFile(
      path.join(sourcePath, "posts/post2.md"),
      '---\ntitle: "Post 2"\n---\n# Post 2',
      "utf8",
    );

    const routesJson = {
      routes: {
        "/pages/main/posts/post1.md": {
          prettyPath: "/post-1/",
        },
      },
    };
    await writeFile(routesPath, JSON.stringify(routesJson, null, 2), "utf8");

    await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      indexPath,
      prerenderPages: "all",
    });

    const prettyHtml = await readFile(
      path.join(publicDir, "post-1/index.html"),
      "utf8",
    );
    const manifestMatch = prettyHtml.match(
      /<script id="shadow-claw-static-manifest"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(manifestMatch).not.toBeNull();
    const embeddedManifest = JSON.parse(manifestMatch[1]);
    expect(embeddedManifest.pages).toHaveLength(2);
  });

  it("copies co-located assets to pretty path directory and populates files/main and static-main", async () => {
    const publicDir = path.join(tmpDir, "dist/public");
    const indexPath = path.join(publicDir, "index.html");
    const sourcePath = path.join(tmpDir, "pages/main");
    const routesPath = path.join(tmpDir, "pages/routes.json");

    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });
    await mkdir(path.join(sourcePath, "posts/2026/07/01"), { recursive: true });
    await mkdir(path.dirname(routesPath), { recursive: true });

    await writeFile(
      indexPath,
      '<!doctype html><html><head><base href="/"><title>ShadowClaw</title></head><body><shadow-claw></shadow-claw></body></html>',
      "utf8",
    );
    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      "<template></template>",
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      "<template></template>",
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      "<template></template>",
      "utf8",
    );

    const postContent = [
      "---",
      'title: "On Developing Loops"',
      "---",
      "![screenshot.png](screenshot.png)",
    ].join("\n");

    await writeFile(
      path.join(sourcePath, "posts/2026/07/01/2026-07-01_03-37-38.md"),
      postContent,
      "utf8",
    );
    await writeFile(
      path.join(sourcePath, "posts/2026/07/01/screenshot.png"),
      "FAKE_PNG_BINARY_DATA",
      "utf8",
    );

    const routesJson = {
      routes: {
        "/pages/main/posts/2026/07/01/2026-07-01_03-37-38.md": {
          prettyPath: "/2026/06/30/on-developing-loops/",
        },
      },
    };
    await writeFile(routesPath, JSON.stringify(routesJson, null, 2), "utf8");

    await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      indexPath,
      prerenderPages: "all",
    });

    // Verify screenshot was copied to pretty path directory
    const prettyAssetPath = path.join(
      publicDir,
      "2026/06/30/on-developing-loops/screenshot.png",
    );
    const prettyAsset = await readFile(prettyAssetPath, "utf8");
    expect(prettyAsset).toBe("FAKE_PNG_BINARY_DATA");

    // Verify screenshot was copied to files/main and static-main
    const filesAssetPath = path.join(
      publicDir,
      "files/main/posts/2026/07/01/screenshot.png",
    );
    const filesAsset = await readFile(filesAssetPath, "utf8");
    expect(filesAsset).toBe("FAKE_PNG_BINARY_DATA");

    const staticMainAssetPath = path.join(
      publicDir,
      "static-main/posts/2026/07/01/screenshot.png",
    );
    const staticMainAsset = await readFile(staticMainAssetPath, "utf8");
    expect(staticMainAsset).toBe("FAKE_PNG_BINARY_DATA");
  });

  it("excludes purge flag pages from pretty path shells and embedded static manifest", async () => {
    const publicDir = path.join(tmpDir, "dist/public");
    const indexPath = path.join(publicDir, "index.html");
    const sourcePath = path.join(tmpDir, "pages/main");
    const routesPath = path.join(tmpDir, "pages/routes.json");

    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });
    await mkdir(path.join(sourcePath, "posts"), { recursive: true });
    await mkdir(path.dirname(routesPath), { recursive: true });

    await writeFile(
      indexPath,
      '<!doctype html><html><head><base href="/"><title>ShadowClaw</title></head><body><shadow-claw></shadow-claw></body></html>',
      "utf8",
    );
    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      '<template><div class="app"><shadow-claw-pages></shadow-claw-pages></div></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      '<template><div class="pages__list" data-pages-list role="list"></div><div class="pages__rendered" data-pages-rendered hidden></div><div class="pages__empty" data-pages-empty></div><shadow-claw-page-header title="Pages"></shadow-claw-page-header></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      '<template><header class="header"><h2 class="header__title"></h2><details class="header__actions-disclosure"></details><div class="header__actions" id="header-actions-panel"></div></header></template>',
      "utf8",
    );

    await writeFile(
      path.join(sourcePath, "posts/post1.md"),
      '---\ntitle: "Post 1"\nslug: "post-1"\n---\n# Post 1',
      "utf8",
    );
    await writeFile(
      path.join(sourcePath, "MEMORY.md"),
      '---\ntitle: "MEMORY"\nslug: "shadow-claw--purge-pages"\npurge-id: "purge-test-123"\n---\n',
      "utf8",
    );

    const routesJson = {
      routes: {
        "/pages/main/posts/post1.md": {
          prettyPath: "/post-1/",
        },
      },
    };
    await writeFile(routesPath, JSON.stringify(routesJson, null, 2), "utf8");

    await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      indexPath,
      prerenderPages: "all",
    });

    const prettyHtml = await readFile(
      path.join(publicDir, "post-1/index.html"),
      "utf8",
    );
    expect(prettyHtml).not.toContain("shadow-claw--purge-pages");
    expect(prettyHtml).not.toContain("MEMORY.md");

    const manifestMatch = prettyHtml.match(
      /<script id="shadow-claw-static-manifest"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(manifestMatch).not.toBeNull();
    const embeddedManifest = JSON.parse(manifestMatch[1]);
    expect(embeddedManifest.pages).toHaveLength(1);
    expect(embeddedManifest.pages[0].displayPath).toBe("posts/post1.md");

    const fullManifest = JSON.parse(
      await readFile(path.join(publicDir, "static-main-manifest.json"), "utf8"),
    );
    expect(fullManifest.pages).toHaveLength(1);
    expect(fullManifest.pages[0].displayPath).toBe("posts/post1.md");
  });
});
