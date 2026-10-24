import { jest } from "@jest/globals";
import {
  injectStaticRoutingScript,
  prerenderPrettyPaths,
} from "./prerender-pretty-paths.js";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
    const scriptContent = scriptMatch![1];
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
  let tmpDir: string;

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

    // Also assert that sibling .html file exists for clean URL direct serving
    expect(result.generatedPaths).toContain(
      "2026/06/30/on-developing-loops.html",
    );
    const flatHtmlPath = path.join(
      publicDir,
      "2026/06/30/on-developing-loops.html",
    );
    const flatHtml = await readFile(flatHtmlPath, "utf8");
    expect(flatHtml).toContain("On Developing Loops");
    expect(prettyHtml).toContain(
      "<title>On Developing Loops - ShadowClaw</title>",
    );
    expect(prettyHtml).toContain(
      '<meta property="og:title" content="On Developing Loops - ShadowClaw" />',
    );
    expect(prettyHtml).toContain(
      '<meta name="description" content="This is SSR content for pretty path." />',
    );
    expect(prettyHtml).toContain("This is SSR content for pretty path.");
    expect(prettyHtml).toContain('id="shadow-claw-static-routing"');
    expect(prettyHtml).toContain('id="shadow-claw-static-manifest"');
    expect(prettyHtml).toContain('data-shadow-claw-dsd="true"');

    // Check that embedded manifest in pretty path HTML has ONLY the 1 current page by default
    const manifestMatch = prettyHtml.match(
      /<script id="shadow-claw-static-manifest"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(manifestMatch).not.toBeNull();
    const embeddedManifest = JSON.parse(manifestMatch![1]);
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
    const embeddedManifest = JSON.parse(manifestMatch![1]);
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
    const embeddedManifest = JSON.parse(manifestMatch![1]);
    expect(embeddedManifest.pages).toHaveLength(1);
    expect(embeddedManifest.pages[0].displayPath).toBe("posts/post1.md");

    const fullManifest = JSON.parse(
      await readFile(path.join(publicDir, "static-main-manifest.json"), "utf8"),
    );
    expect(fullManifest.pages).toHaveLength(1);
    expect(fullManifest.pages[0].displayPath).toBe("posts/post1.md");
  });

  it("excludes routes matching denyList from static-routing.json and does not prerender them", async () => {
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

    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      "<shadow-claw><template shadowrootmode='open'><slot></slot></template></shadow-claw>",
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      "<shadow-claw-pages><template shadowrootmode='open'><slot></slot></template></shadow-claw-pages>",
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      "<shadow-claw-page-header><template shadowrootmode='open'></template></shadow-claw-page-header>",
      "utf8",
    );
    await writeFile(
      indexPath,
      "<!doctype html><html><head></head><body><shadow-claw></shadow-claw></body></html>",
      "utf8",
    );

    await writeFile(
      path.join(sourcePath, "posts/post1.md"),
      '---\ntitle: "Post 1"\nslug: "post-1"\n---\n# Post 1',
      "utf8",
    );
    await writeFile(
      path.join(sourcePath, "MEMORY.md"),
      '---\ntitle: "Memory"\nslug: "memory"\n---\n# Memory Content',
      "utf8",
    );

    const routesJson = {
      routes: {
        "/pages/main/posts/post1.md": {
          prettyPath: "/post-1/",
        },
        "/pages/main/MEMORY.md": {
          prettyPath: "/main/memory",
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
      siteConfig: {
        pages: {
          denyList: ["/main/memory"],
        },
      },
    });

    // post-1 should be generated
    const post1Exists = await readFile(
      path.join(publicDir, "post-1/index.html"),
      "utf8",
    ).then(
      () => true,
      () => false,
    );
    expect(post1Exists).toBe(true);

    // /main/memory should NOT be generated
    const memoryExists = await readFile(
      path.join(publicDir, "main/memory/index.html"),
      "utf8",
    ).then(
      () => true,
      () => false,
    );
    expect(memoryExists).toBe(false);

    // static-routing.json should not contain /main/memory
    const staticRouting = JSON.parse(
      await readFile(path.join(publicDir, "static-routing.json"), "utf8"),
    );
    expect(staticRouting.routes["/pages/main/MEMORY.md"]).toBeUndefined();
    expect(staticRouting.routes["/pages/main/posts/post1.md"]).toBeDefined();
  });

  it("prerenders root route '/' at index.html and keeps it in static-routing.json", async () => {
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
    await mkdir(sourcePath, { recursive: true });

    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      '<template shadowrootmode="open"><slot></slot></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      '<template shadowrootmode="open"><div data-pages-rendered></div></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      '<template shadowrootmode="open"><h1>Header</h1></template>',
      "utf8",
    );

    await writeFile(
      indexPath,
      "<html><head></head><body><shadow-claw><shadow-claw-pages></shadow-claw-pages></shadow-claw></body></html>",
      "utf8",
    );

    await writeFile(
      path.join(sourcePath, "index.html"),
      "<main><h1>Root Home Page</h1></main>",
      "utf8",
    );
    await writeFile(path.join(sourcePath, "about.md"), "# About Page", "utf8");

    const routesJson = {
      routes: {
        "/pages/main/index.html": {
          prettyPath: "/",
        },
        "/pages/main/about.md": {
          prettyPath: "/about",
        },
      },
    };
    await writeFile(routesPath, JSON.stringify(routesJson, null, 2), "utf8");

    const result = await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      indexPath,
      prerenderPages: 1,
    });

    expect(result.count).toBe(2);
    expect(result.generatedPaths).toContain("index.html");
    expect(result.generatedPaths).toContain("about/index.html");

    // index.html should be populated with DSD and static manifest containing index.html
    const updatedIndexHtml = await readFile(indexPath, "utf8");
    expect(updatedIndexHtml).toContain("Root Home Page");
    expect(updatedIndexHtml).toContain('id="shadow-claw-static-manifest"');
    expect(updatedIndexHtml).toContain('id="shadow-claw-static-routing"');

    // static-routing.json should keep root route
    const staticRouting = JSON.parse(
      await readFile(path.join(publicDir, "static-routing.json"), "utf8"),
    );
    expect(staticRouting.routes["/pages/main/index.html"]).toEqual({
      prettyPath: "/",
    });
    expect(staticRouting.routes["/pages/main/about.md"]).toEqual({
      prettyPath: "/about",
    });
  });

  it("applies Yoast-style SEO titles, route overrides, and canonical URLs to pretty path HTML", async () => {
    const publicDir = path.join(tmpDir, "dist/public-seo");
    const indexPath = path.join(publicDir, "index.html");
    const sourcePath = path.join(tmpDir, "pages/main-seo");
    const routesPath = path.join(tmpDir, "pages/routes-seo.json");
    const siteConfigPath = path.join(tmpDir, "pages/site-config-seo.json");

    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });
    await mkdir(sourcePath, { recursive: true });

    await writeFile(
      indexPath,
      '<!doctype html><html><head><base href="/shadow-claw/"><title>ShadowClaw</title><link rel="canonical" href="https://xt-ml.github.io/shadow-claw/" /></head><body><shadow-claw></shadow-claw></body></html>',
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

    const siteConfig = {
      site: {
        title: "ShadowClaw",
        titleSeparator: " | ",
      },
      branding: {
        siteUrl: "https://xt-ml.github.io/shadow-claw/",
      },
    };
    await writeFile(
      siteConfigPath,
      JSON.stringify(siteConfig, null, 2),
      "utf8",
    );

    // Page 1: Uses frontmatter title and frontmatter description
    const page1Content = `---
title: "Agent Skills & Skill Creator"
description: "Build custom declarative agent skills and tool pipelines."
---
# Agent Skills & Skill Creator

Welcome to skills.`;
    await writeFile(
      path.join(sourcePath, "skill-creator.md"),
      page1Content,
      "utf8",
    );

    // Page 2: Route override in routes.json overrides title & description
    const page2Content = `---
title: "Internal Title"
---
# Body Title

Body content paragraph for auto description.`;
    await writeFile(
      path.join(sourcePath, "custom-page.md"),
      page2Content,
      "utf8",
    );

    const routesJson = {
      routes: {
        "/pages/main-seo/skill-creator.md": {
          prettyPath: "/docs/skill-creator/",
        },
        "/pages/main-seo/custom-page.md": {
          prettyPath: "/custom-url/",
          title: "Custom Route Title",
          description: "Explicit route override description.",
        },
      },
    };
    await writeFile(routesPath, JSON.stringify(routesJson, null, 2), "utf8");

    const result = await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      siteConfigPath,
      indexPath,
      prerenderPages: 1,
    });

    expect(result.count).toBe(2);

    // Verify Page 1 (skill creator)
    const page1Html = await readFile(
      path.join(publicDir, "docs/skill-creator/index.html"),
      "utf8",
    );
    expect(page1Html).toContain(
      "<title>Agent Skills &amp; Skill Creator | ShadowClaw</title>",
    );
    expect(page1Html).toContain(
      '<meta name="description" content="Build custom declarative agent skills and tool pipelines." />',
    );
    expect(page1Html).toContain(
      '<link rel="canonical" href="https://xt-ml.github.io/shadow-claw/docs/skill-creator/" />',
    );
    expect(page1Html).toContain(
      '<meta property="og:title" content="Agent Skills &amp; Skill Creator | ShadowClaw" />',
    );
    expect(page1Html).toContain(
      '<meta property="og:url" content="https://xt-ml.github.io/shadow-claw/docs/skill-creator/" />',
    );

    // Verify Page 2 (route overrides)
    const page2Html = await readFile(
      path.join(publicDir, "custom-url/index.html"),
      "utf8",
    );
    expect(page2Html).toContain(
      "<title>Custom Route Title | ShadowClaw</title>",
    );
    expect(page2Html).toContain(
      '<meta name="description" content="Explicit route override description." />',
    );
    expect(page2Html).toContain(
      '<link rel="canonical" href="https://xt-ml.github.io/shadow-claw/custom-url/" />',
    );
  });

  it("injects global scripts and page frontmatter script dependencies into head of pretty path pages", async () => {
    const publicDir = path.join(tmpDir, "dist/public-deps");
    const indexPath = path.join(publicDir, "index.html");
    const sourcePath = path.join(tmpDir, "pages/main-deps");
    const routesPath = path.join(tmpDir, "pages/routes-deps.json");
    const siteConfigPath = path.join(tmpDir, "shadow-claw.config.json");

    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });
    await mkdir(sourcePath, { recursive: true });
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

    const siteConfigJson = {
      site: { title: "ShadowClaw" },
      customElements: {
        scripts: [
          {
            id: "feed-scroller",
            src: "/pages/main/assets/feed-scroller.js",
            global: true,
            hasInit: true,
          },
          {
            id: "x-hook-component",
            src: "/pages/main/assets/x-hook-component.js",
            hasInit: true,
          },
          {
            name: "x-postpress-code",
            src: "/pages/main/assets/x-postpress-code.js",
            hasInit: true,
          },
        ],
      },
    };
    await writeFile(
      siteConfigPath,
      JSON.stringify(siteConfigJson, null, 2),
      "utf8",
    );

    const page1Content = [
      "---",
      'title: "The Web Is Dynamic"',
      'slug: "the-web-is-dynamic"',
      "dependencies:",
      '  - "x-hook-component"',
      "---",
      "# The Web Is Dynamic",
      "",
      "Content using hook component.",
      '<script type="module" src="/pages/main/assets/x-hook-component.js"></script>',
    ].join("\n");

    const page2Content = [
      "---",
      'title: "Unknown Script Page"',
      'slug: "unknown-script-page"',
      "dependencies:",
      '  - "missing-non-existent-script"',
      "---",
      "# Unknown Script Page",
      "",
      "Content with unresolvable script.",
    ].join("\n");

    await writeFile(
      path.join(sourcePath, "2021-02-27-the-web-is-dynamic.md"),
      page1Content,
      "utf8",
    );
    await writeFile(path.join(sourcePath, "unknown.md"), page2Content, "utf8");

    const routesJson = {
      routes: {
        "/pages/main-deps/2021-02-27-the-web-is-dynamic.md": {
          prettyPath: "/2021/02/27/the-web-is-dynamic/",
        },
        "/pages/main-deps/unknown.md": {
          prettyPath: "/unknown-page/",
        },
      },
    };
    await writeFile(routesPath, JSON.stringify(routesJson, null, 2), "utf8");

    const result = await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      siteConfigPath,
      indexPath,
      prerenderPages: 1,
    });

    expect(result.count).toBe(2);

    const page1Html = await readFile(
      path.join(publicDir, "2021/02/27/the-web-is-dynamic/index.html"),
      "utf8",
    );

    // Should contain both the global script and the frontmatter-requested dependency in <head>
    expect(page1Html).toMatch(
      /<head>[\s\S]*<script type="module" src="\/pages\/main\/assets\/feed-scroller\.js"><\/script>[\s\S]*<\/head>/,
    );
    expect(page1Html).toMatch(
      /<head>[\s\S]*<script type="module" src="\/pages\/main\/assets\/x-hook-component\.js"><\/script>[\s\S]*<\/head>/,
    );
    // Should NOT contain the unrequested x-postpress-code
    expect(page1Html).not.toContain("/pages/main/assets/x-postpress-code.js");

    const page2Html = await readFile(
      path.join(publicDir, "unknown-page/index.html"),
      "utf8",
    );
    // Should still have the global script and render cleanly despite missing dependency
    expect(page2Html).toMatch(
      /<head>[\s\S]*<script type="module" src="\/pages\/main\/assets\/feed-scroller\.js"><\/script>[\s\S]*<\/head>/,
    );
    expect(page2Html).not.toMatch(/<script\b[^>]*missing-non-existent-script/);
  });

  it("injects dependencies when existing config does not specify an id and fails gracefully", async () => {
    const publicDir = path.join(tmpDir, "dist/public");
    const indexPath = path.join(publicDir, "index.html");
    const sourcePath = path.join(tmpDir, "pages/main-legacy");
    const routesPath = path.join(tmpDir, "pages/routes-legacy.json");
    const siteConfigPath = path.join(tmpDir, "shadow-claw.config.json");

    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });
    await mkdir(sourcePath, { recursive: true });

    await mkdir(path.dirname(routesPath), { recursive: true });

    await writeFile(
      indexPath,
      '<!doctype html><html><head><base href="/"><title>Legacy Config Site</title></head><body><shadow-claw></shadow-claw></body></html>',
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

    // Existing legacy config without 'id' fields
    const legacySiteConfig = {
      site: { title: "Legacy Config Site" },
      customElements: {
        scripts: [
          { src: "/pages/main/assets/feed-scroller.js", global: true },
          { src: "/pages/main/assets/x-hook-component.js" },
        ],
      },
    };
    await writeFile(
      siteConfigPath,
      JSON.stringify(legacySiteConfig, null, 2),
      "utf8",
    );

    const postContent = [
      "---",
      'title: "Legacy Config Page"',
      "dependencies:",
      '  - "x-hook-component"',
      '  - "unrecognized-missing-id"',
      "---",
      "# Legacy Config Page",
      "",
      "Content rendered best effort.",
    ].join("\n");

    await writeFile(
      path.join(sourcePath, "legacy-page.md"),
      postContent,
      "utf8",
    );

    const routesJson = {
      routes: {
        "/pages/main-legacy/legacy-page.md": {
          prettyPath: "/legacy-page/",
        },
      },
    };
    await writeFile(routesPath, JSON.stringify(routesJson, null, 2), "utf8");

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      siteConfigPath,
      indexPath,
      prerenderPages: 1,
    });
    warnSpy.mockRestore();

    expect(result.count).toBe(1);

    const pageHtml = await readFile(
      path.join(publicDir, "legacy-page/index.html"),
      "utf8",
    );

    // Global script injected
    expect(pageHtml).toMatch(
      /<head>[\s\S]*<script type="module" src="\/pages\/main\/assets\/feed-scroller\.js"><\/script>[\s\S]*<\/head>/,
    );
    // Matched by stem even without id in config
    expect(pageHtml).toMatch(
      /<head>[\s\S]*<script type="module" src="\/pages\/main\/assets\/x-hook-component\.js"><\/script>[\s\S]*<\/head>/,
    );
    // Unrecognized id has no script tag injected and does not cause a failure
    expect(pageHtml).not.toMatch(/<script\b[^>]*unrecognized-missing-id/);
  });

  it("skips feed and .xml routes from DSD prerendering", async () => {
    const publicDir = path.join(tmpDir, "dist/public");
    const routesPath = path.join(tmpDir, "routes.json");
    const sourcePath = path.join(tmpDir, "pages/main");
    const indexPath = path.join(publicDir, "index.html");

    await mkdir(publicDir, { recursive: true });
    await mkdir(sourcePath, { recursive: true });
    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });

    await writeFile(
      indexPath,
      "<!doctype html><html><head><title>Base</title></head><body><shadow-claw></shadow-claw></body></html>",
      "utf8",
    );
    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      '<template><div class="app"></div></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      '<template><div class="pages"></div></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      "<template><header></header></template>",
      "utf8",
    );

    const routes = {
      routes: {
        "/pages/main/article.md": { prettyPath: "/article/" },
        "/feed/rss.xml": { prettyPath: "/feed/" },
        "/feed/atom/atom.xml": { prettyPath: "/feed/atom/" },
        "/feed/rdf/index.xml": { prettyPath: "/feed/rdf/" },
      },
    };
    await writeFile(routesPath, JSON.stringify(routes), "utf8");

    await writeFile(
      path.join(sourcePath, "article.md"),
      "# Article\n\nContent",
      "utf8",
    );

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      indexPath,
      prerenderPages: 1,
    });
    warnSpy.mockRestore();

    expect(result.count).toBe(1);
    expect(result.generatedPaths).toContain("article/index.html");
    expect(result.generatedPaths).not.toContain("feed/index.html");
  });

  it("updates <base href> across root index.html and all pre-rendered pretty paths when siteUrl or basePath is configured", async () => {
    const publicDir = path.join(tmpDir, "dist/public");
    const routesPath = path.join(tmpDir, "pages/routes.json");
    const sourcePath = path.join(tmpDir, "pages/main");
    const indexPath = path.join(publicDir, "index.html");

    await mkdir(sourcePath, { recursive: true });
    await mkdir(path.join(publicDir, "components/shadow-claw"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-pages"), {
      recursive: true,
    });
    await mkdir(path.join(publicDir, "components/shadow-claw-page-header"), {
      recursive: true,
    });

    await writeFile(
      indexPath,
      '<!doctype html><html><head><title>Base</title><base href="/" /></head><body><shadow-claw></shadow-claw></body></html>',
      "utf8",
    );
    await writeFile(
      path.join(publicDir, "components/shadow-claw/shadow-claw.html"),
      '<template><div class="app"></div></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-pages/shadow-claw-pages.html",
      ),
      '<template><div class="pages"></div></template>',
      "utf8",
    );
    await writeFile(
      path.join(
        publicDir,
        "components/shadow-claw-page-header/shadow-claw-page-header.html",
      ),
      "<template><header></header></template>",
      "utf8",
    );

    const routes = {
      routes: {
        "/pages/main/skill-creator.md": { prettyPath: "/docs/skill-creator" },
      },
    };
    await writeFile(routesPath, JSON.stringify(routes), "utf8");
    await writeFile(
      path.join(sourcePath, "skill-creator.md"),
      "# Skill Creator\n\nContent",
      "utf8",
    );

    const result = await prerenderPrettyPaths({
      publicDir,
      routesPath,
      sourcePath,
      indexPath,
      prerenderPages: 1,
      siteConfig: {
        branding: {
          siteUrl: "https://xt-ml.github.io/shadow-claw/",
        },
      },
    });

    expect(result.count).toBe(1);
    const rootHtml = await readFile(indexPath, "utf8");
    const dirPrettyHtml = await readFile(
      path.join(publicDir, "docs/skill-creator/index.html"),
      "utf8",
    );
    const filePrettyHtml = await readFile(
      path.join(publicDir, "docs/skill-creator.html"),
      "utf8",
    );

    expect(rootHtml).toContain('<base href="/shadow-claw/" />');
    expect(dirPrettyHtml).toContain('<base href="/shadow-claw/" />');
    expect(filePrettyHtml).toContain('<base href="/shadow-claw/" />');
  });
});
