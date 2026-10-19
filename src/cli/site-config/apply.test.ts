import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

import {
  applySiteConfig,
  copyBrandingAssets,
  escapeHtml,
  patch404Html,
  patchIndexHtml,
  patchManifest,
  patchSitemap,
} from "./apply.js";

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("apply-site-config", () => {
  let logSpy: any;
  let warnSpy: any;
  let logs: Array<{ type: string; args: any[] }> = [];

  beforeEach(() => {
    logs = [];
    logSpy = (jest.spyOn(console, "log") as any).mockImplementation(
      (...args: any[]) => {
        logs.push({ type: "log", args });
      },
    );
    warnSpy = (jest.spyOn(console, "warn") as any).mockImplementation(
      (...args: any[]) => {
        logs.push({ type: "warn", args });
      },
    );
  });

  afterEach(() => {
    const state: any = expect.getState();
    const testFailed =
      (state.suppressedErrors && state.suppressedErrors.length > 0) ||
      (state.assertionCalls > 0 &&
        state.numPassingAsserts < state.assertionCalls);

    logSpy.mockRestore();
    warnSpy.mockRestore();

    if (testFailed) {
      for (const item of logs) {
        if (item.type === "warn") {
          console.warn(...item.args);
        } else {
          console.log(...item.args);
        }
      }
    }
  });

  describe("escapeHtml", () => {
    it("escapes special HTML characters", () => {
      expect(escapeHtml("<script>alert(\"xss\" & 'test')</script>")).toBe(
        "&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;test&#39;)&lt;/script&gt;",
      );
    });
  });

  describe("patchIndexHtml", () => {
    const baseHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ShadowClaw</title>
    <meta name="description" content="Default Description" />
    <meta name="theme-color" content="#000000" />
    <link rel="stylesheet" href="index.css" />
    <script src="theme-init.js"></script>
  </head>
  <body>
    <shadow-claw></shadow-claw>
    <script type="module" src="index.js"></script>
  </body>
</html>`;

    it.each([true, false])(
      "embeds settings.overridePrerenderSkeleton=%s as a meta tag before theme-init.js",
      (value) => {
        const patched = patchIndexHtml(baseHtml, {
          settings: { overridePrerenderSkeleton: value },
        });
        const meta = `<meta name="shadow-claw-override-prerender-skeleton" content="${value}" />`;

        expect(patched).toContain(meta);
        expect(patched.indexOf(meta)).toBeLessThan(
          patched.indexOf('<script src="theme-init.js">'),
        );
      },
    );

    it("replaces an existing override meta tag instead of duplicating it", () => {
      const html = baseHtml.replace(
        "</head>",
        '<meta name="shadow-claw-override-prerender-skeleton" content="true" /></head>',
      );
      const patched = patchIndexHtml(html, {
        settings: { overridePrerenderSkeleton: false },
      });

      expect(
        patched.match(/shadow-claw-override-prerender-skeleton/g),
      ).toHaveLength(1);
      expect(patched).toContain('content="false"');
    });

    it("adds no override meta tag when the setting is not configured", () => {
      const patched = patchIndexHtml(baseHtml, {});

      expect(patched).not.toContain("shadow-claw-override-prerender-skeleton");
    });

    it("patches site title, description, themeColor, and embeds site-config before theme-init.js", () => {
      const config = {
        site: {
          title: "Block Garden — 3D Sandbox & Knowledge Hub",
          description: "3D sandbox exploration powered by ShadowClaw.",
          themeColor: "#111c12",
          lang: "en-US",
        },
        customElements: {
          allowedElements: [
            "block-garden",
            "block-garden-select",
            "block-garden-option",
          ],
          allowedDomains: ["kherrick.github.io"],
          scripts: [
            "https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs",
          ],
        },
      };

      const patched = patchIndexHtml(baseHtml, config);

      expect(patched).toContain(
        "<title>Block Garden — 3D Sandbox &amp; Knowledge Hub</title>",
      );
      expect(patched).toContain(
        '<meta name="description" content="3D sandbox exploration powered by ShadowClaw." />',
      );
      expect(patched).toContain(
        '<meta name="theme-color" content="#111c12" />',
      );
      expect(patched).toContain('<html lang="en-US"');
      expect(patched).not.toContain(
        '<script type="module" src="https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs"></script>',
      );

      // Verify that embedded site-config is placed before theme-init.js
      expect(patched).toContain('id="shadow-claw-site-config"');
      const siteConfigIdx = patched.indexOf('id="shadow-claw-site-config"');
      const themeInitIdx = patched.indexOf('<script src="theme-init.js">');
      expect(siteConfigIdx).toBeGreaterThan(-1);
      expect(themeInitIdx).toBeGreaterThan(-1);
      expect(siteConfigIdx).toBeLessThan(themeInitIdx);
    });

    it("resolves theme.stylesheet to its actual on-disk dist path (pages/main/theme.css is never flattened to dist root)", () => {
      const config = {
        theme: {
          stylesheet: "pages/main/theme.css",
        },
      };

      const patched = patchIndexHtml(baseHtml, config);

      expect(patched).toContain(
        '<link rel="stylesheet" href="pages/main/theme.css" />',
      );
      expect(patched).not.toContain(
        '<link rel="stylesheet" href="theme.css" />',
      );
    });

    it.each([
      ["pages/resources/theme.css", "theme.css"],
      ["pages/deps/theme.css", "theme.css"],
      ["resources/theme.css", "theme.css"],
      ["deps/theme.css", "theme.css"],
      ["pages/assets/theme.css", "theme.css"],
      ["pages/main/assets/theme.css", "theme.css"],
    ])(
      "flattens theme.stylesheet %s to dist root as %s (contents of these dirs are flattened by copyResourceDirEntries)",
      (stylesheet, expectedHref) => {
        const patched = patchIndexHtml(baseHtml, { theme: { stylesheet } });

        expect(patched).toContain(
          `<link rel="stylesheet" href="${expectedHref}" />`,
        );
      },
    );

    it("blocks scripts from unapproved domains during build patching of embedded site-config", () => {
      const config = {
        customElements: {
          allowedElements: ["block-garden"],
          allowedDomains: ["kherrick.github.io"],
          scripts: [
            "https://evil.com/malicious.js",
            "https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs",
          ],
        },
      };

      const patched = patchIndexHtml(baseHtml, config);

      expect(patched).not.toContain("evil.com");
      expect(patched).toContain("kherrick.github.io");
    });

    it("patches favicon tag with SVG type when faviconPath is svg", () => {
      const htmlWithFavicon = `${baseHtml.replace("</head>", '<link href="assets/icons/favicon.ico" rel="icon" type="image/x-icon" /></head>')}`;
      const config = {
        branding: {
          faviconPath: "pages/main/favicon.svg",
          appleTouchIconPath: "pages/main/favicon.svg",
        },
      };

      const patched = patchIndexHtml(htmlWithFavicon, config);
      expect(patched).toContain(
        '<link href="favicon.svg" rel="icon" type="image/svg+xml" />',
      );
      expect(patched).toContain(
        '<link href="favicon.svg" rel="apple-touch-icon" />',
      );
    });

    it("injects slotted sidebar html into shadow-claw light DOM when slotHtml is configured", () => {
      const config = {
        sidebar: {
          slotHtml: '<nav class="custom-nav"><a href="/about">About</a></nav>',
        },
      };

      const patched = patchIndexHtml(baseHtml, config);
      expect(patched).toContain('slot="sidebar"');
      expect(patched).toContain('<a href="/about">About</a>');
      expect(patched).toContain("<shadow-claw>");
      expect(patched).toContain("</shadow-claw>");
    });

    it("injects RSS, Atom, and RDF autodiscovery link tags when feed is enabled", () => {
      const config = {
        site: { title: "My Blog" },
        branding: { siteUrl: "https://example.com" },
        feed: { enabled: true },
      };
      const patched = patchIndexHtml(baseHtml, config);

      expect(patched).toContain(
        '<link rel="alternate" type="application/rss+xml" title="My Blog &raquo; Feed" href="https://example.com/feed/" />',
      );
      expect(patched).toContain(
        '<link rel="alternate" type="application/atom+xml" title="My Blog &raquo; Atom Feed" href="https://example.com/feed/atom/" />',
      );
      expect(patched).toContain(
        '<link rel="alternate" type="application/rdf+xml" title="My Blog &raquo; RDF Feed" href="https://example.com/feed/rdf/" />',
      );
    });

    it("does not inject feed autodiscovery tags when feed is disabled or omitted", () => {
      const configDefault = {
        site: { title: "My Blog" },
        branding: { siteUrl: "https://example.com" },
      };
      const patchedDefault = patchIndexHtml(baseHtml, configDefault);
      expect(patchedDefault).not.toContain('type="application/rss+xml"');

      const configDisabled = {
        site: { title: "My Blog" },
        branding: { siteUrl: "https://example.com" },
        feed: { enabled: false },
      };
      const patchedDisabled = patchIndexHtml(baseHtml, configDisabled);
      expect(patchedDisabled).not.toContain('type="application/rss+xml"');
    });

    it("renders and injects declarative sidebar sections into shadow-claw light DOM", () => {
      const config = {
        sidebar: {
          sections: [
            {
              title: "Home",
              headerHref: "/",
              items: [{ title: "About", href: "/about" }],
            },
            {
              title: "Links",
              items: [
                {
                  title: "GitHub",
                  href: "https://github.com/xt-ml/shadow-claw",
                  target: "_blank",
                },
              ],
            },
          ],
        },
      };

      const patched = patchIndexHtml(baseHtml, config);
      expect(patched).toContain('slot="sidebar"');
      expect(patched).toContain('class="sidebar-custom-sections"');
      expect(patched).toContain('href="/" class="sidebar-link">Home</a>');
      expect(patched).toContain('href="/about" class="sidebar-link">About</a>');
      expect(patched).toContain(
        'href="https://github.com/xt-ml/shadow-claw" target="_blank" rel="noopener noreferrer"',
      );
    });

    it("injects customSidebarHtml parameter directly into shadow-claw light DOM", () => {
      const customHtml =
        '<div slot="sidebar" class="my-custom-sidebar"><p>Hello</p></div>';
      const patched = patchIndexHtml(baseHtml, {}, customHtml);
      expect(patched).toContain(customHtml);
    });

    it("preserves existing header logo SVG and heading tag when branding specifies siteUrl", () => {
      const htmlWithLogo = baseHtml.replace(
        "<shadow-claw></shadow-claw>",
        `<shadow-claw>
      <a class="header-title-link" href="/" slot="header-title-link">
        <svg class="header-title-logo" viewBox="0 0 128 128"><path d="M0 0" /></svg>
        <h1 class="header-title">ShadowClaw</h1>
      </a>
    </shadow-claw>`,
      );

      const patched = patchIndexHtml(htmlWithLogo, {
        branding: { siteUrl: "https://xt-ml.github.io/shadow-claw/" },
      });

      expect(patched).toContain('href="https://xt-ml.github.io/shadow-claw/"');
      expect(patched).toContain('class="header-title-logo"');
      expect(patched).toContain(
        '<svg class="header-title-logo" viewBox="0 0 128 128"><path d="M0 0" /></svg>',
      );
      expect(patched).toContain('<h1 class="header-title">ShadowClaw</h1>');
    });

    it("replaces header logo when branding logoSlotHtml is explicitly provided", () => {
      const htmlWithLogo = baseHtml.replace(
        "<shadow-claw></shadow-claw>",
        `<shadow-claw>
      <a class="header-title-link" href="/" slot="header-title-link">
        <svg class="header-title-logo"><path d="M0 0" /></svg>
        <h1 class="header-title">ShadowClaw</h1>
      </a>
    </shadow-claw>`,
      );

      const customLogo = '<img class="header-title-logo" src="custom.png" />';
      const patched = patchIndexHtml(htmlWithLogo, {
        branding: { logoSlotHtml: customLogo },
      });

      expect(patched).toContain(customLogo);
      expect(patched).not.toContain('<svg class="header-title-logo">');
    });

    it("removes header logo when branding logoSlotHtml is set to 'none'", () => {
      const htmlWithLogo = baseHtml.replace(
        "<shadow-claw></shadow-claw>",
        `<shadow-claw>
      <a class="header-title-link" href="/" slot="header-title-link">
        <svg class="header-title-logo"><path d="M0 0" /></svg>
        <h1 class="header-title">ShadowClaw</h1>
      </a>
    </shadow-claw>`,
      );

      const patched = patchIndexHtml(htmlWithLogo, {
        branding: { logoSlotHtml: "none" },
      });

      expect(patched).not.toContain('<svg class="header-title-logo">');
      expect(patched).not.toMatch(
        /<a[^>]*slot="header-title-link"[^>]*>\s*none/iu,
      );
      expect(patched).toContain('<h1 class="header-title">ShadowClaw</h1>');
    });

    it("removes header logo when branding logoSlotHtml is empty string or null", () => {
      const htmlWithLogo = baseHtml.replace(
        "<shadow-claw></shadow-claw>",
        `<shadow-claw>
      <a class="header-title-link" href="/" slot="header-title-link">
        <svg class="header-title-logo"><path d="M0 0" /></svg>
        <h1 class="header-title">ShadowClaw</h1>
      </a>
    </shadow-claw>`,
      );

      const patchedEmpty = patchIndexHtml(htmlWithLogo, {
        branding: { logoSlotHtml: "" },
      });
      expect(patchedEmpty).not.toContain('<svg class="header-title-logo">');
      expect(patchedEmpty).toContain(
        '<h1 class="header-title">ShadowClaw</h1>',
      );

      const patchedNull = patchIndexHtml(htmlWithLogo, {
        branding: { logoSlotHtml: null },
      });
      expect(patchedNull).not.toContain('<svg class="header-title-logo">');
      expect(patchedNull).toContain('<h1 class="header-title">ShadowClaw</h1>');
    });

    it("updates header titleText while preserving bespoke logo SVG", () => {
      const htmlWithLogo = baseHtml.replace(
        "<shadow-claw></shadow-claw>",
        `<shadow-claw>
      <a class="header-title-link" href="/" slot="header-title-link">
        <svg class="header-title-logo"><circle cx="10" cy="10" r="5" /></svg>
        <span class="header-title">Old Title</span>
      </a>
    </shadow-claw>`,
      );

      const patched = patchIndexHtml(htmlWithLogo, {
        branding: { titleText: "New Title" },
      });

      expect(patched).toContain('<span class="header-title">New Title</span>');
      expect(patched).toContain('<circle cx="10" cy="10" r="5" />');
    });
  });

  describe("patchManifest", () => {
    it("patches manifest name, short_name, and colors", () => {
      const baseManifest = JSON.stringify({
        name: "ShadowClaw",
        short_name: "ShadowClaw",
        background_color: "#000000",
        theme_color: "#000000",
      });

      const config = {
        pwa: {
          name: "Block Garden Knowledge Hub",
          shortName: "BlockGarden",
          backgroundColor: "#09110a",
          themeColor: "#22c55e",
        },
      };

      const patched = JSON.parse(patchManifest(baseManifest, config));

      expect(patched.name).toBe("Block Garden Knowledge Hub");
      expect(patched.short_name).toBe("BlockGarden");
      expect(patched.background_color).toBe("#09110a");
      expect(patched.theme_color).toBe("#22c55e");
    });

    it("patches start_url using PAGES_ORIGIN environment variable", () => {
      const baseManifest = JSON.stringify({
        name: "ShadowClaw",
        start_url: "https://production.example.com/",
      });

      const oldEnv = process.env.PAGES_ORIGIN;
      try {
        process.env.PAGES_ORIGIN = "http://localhost:8888/shadow-claw/";
        const patched = JSON.parse(patchManifest(baseManifest, {}));
        expect(patched.start_url).toBe("http://localhost:8888/shadow-claw/");
      } finally {
        if (oldEnv !== undefined) {
          process.env.PAGES_ORIGIN = oldEnv;
        } else {
          delete process.env.PAGES_ORIGIN;
        }
      }
    });
  });

  describe("patchSitemap", () => {
    it("replaces sitemap origin when pagesOrigin is provided for xml", () => {
      const baseXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
  </url>
</urlset>`;

      const patched = patchSitemap(
        baseXml,
        "https://kherrick.github.io/shadow-claw-template-demo/",
      );
      expect(patched).toContain(
        "<loc>https://kherrick.github.io/shadow-claw-template-demo/</loc>",
      );
    });

    it("keeps each path when rewriting a multi-url xml sitemap", () => {
      const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;

      const patched = patchSitemap(xml, "https://demo.example.com/hub/");
      expect(patched).toContain("<loc>https://demo.example.com/hub/</loc>");
      expect(patched).toContain(
        "<loc>https://demo.example.com/hub/about</loc>",
      );
    });

    it("replaces sitemap origin when pagesOrigin is provided for text sitemaps", () => {
      const baseTxt = `https://example.com/
https://example.com/about`;

      const patched = patchSitemap(
        baseTxt,
        "https://kherrick.github.io/shadow-claw-template-demo/",
      );
      expect(patched).toContain(
        "https://kherrick.github.io/shadow-claw-template-demo/\nhttps://kherrick.github.io/shadow-claw-template-demo/about",
      );
    });
  });

  describe("patch404Html", () => {
    it("patches title and SPA redirect base path", () => {
      const base404 = `<title>Default</title><script>l.replace("/shadow-claw/");</script>`;
      const config = { site: { title: "Custom App" } };
      const patched = patch404Html(base404, config, "/custom-app/");

      expect(patched).toContain("<title>Custom App - Not Found</title>");
      expect(patched).toContain('l.replace("/custom-app/")');
    });
  });

  describe("applySiteConfig end-to-end", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = path.join(
        os.tmpdir(),
        `sc-site-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      await mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("applies site configuration files on disk including custom 404, manifest, sitemap, and assets", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const pagesDir = path.join(tmpDir, "pages");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(pagesDir, { recursive: true });

      const indexPath = path.join(distPublicDir, "index.html");
      const manifestPath = path.join(distPublicDir, "manifest.json");
      const siteConfigPath = path.join(pagesDir, "site-config.json");

      await writeFile(
        indexPath,
        '<!doctype html><html><head><script src="theme-init.js"></script></head><body><script type="module" src="index.js"></script></body></html>',
        "utf8",
      );
      await writeFile(
        manifestPath,
        JSON.stringify({ name: "ShadowClaw" }),
        "utf8",
      );

      const pagesMainDir = path.join(pagesDir, "main");
      await mkdir(pagesMainDir, { recursive: true });
      const faviconSourcePath = path.join(pagesMainDir, "favicon.svg");
      await writeFile(faviconSourcePath, "<svg></svg>", "utf8");

      // Custom template overrides
      const custom404Path = path.join(pagesDir, "404.html");
      await writeFile(
        custom404Path,
        '<title>Custom 404</title><script>l.replace("/shadow-claw/");</script>',
        "utf8",
      );

      const customManifestPath = path.join(pagesDir, "manifest.json");
      await writeFile(
        customManifestPath,
        JSON.stringify({ name: "Custom Manifest", start_url: "/demo/" }),
        "utf8",
      );

      const customSitemapPath = path.join(pagesDir, "sitemap.xml");
      await writeFile(
        customSitemapPath,
        "<urlset><url><loc>https://example.com/</loc></url></urlset>",
        "utf8",
      );

      const pagesAssetsDir = path.join(pagesDir, "assets");
      await mkdir(pagesAssetsDir, { recursive: true });
      await writeFile(
        path.join(pagesAssetsDir, "demo-asset.png"),
        "FAKE_PNG",
        "utf8",
      );

      const config = {
        site: { title: "Block Garden" },
        branding: {
          faviconPath: "pages/main/favicon.svg",
        },
        pwa: {
          icons: [{ src: "favicon.svg", type: "image/svg+xml" }],
        },
        customElements: {
          allowedElements: [
            "block-garden",
            "block-garden-select",
            "block-garden-option",
          ],
          allowedDomains: ["kherrick.github.io"],
        },
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      const result = await applySiteConfig(distPublicDir, siteConfigPath);
      expect(result.applied).toBe(true);

      const patchedIndex = await readFile(indexPath, "utf8");
      expect(patchedIndex).toContain('id="shadow-claw-site-config"');
      expect(patchedIndex).toContain("block-garden-select");
      expect(patchedIndex).toContain("block-garden-option");

      const copiedFavicon = await readFile(
        path.join(distPublicDir, "favicon.svg"),
        "utf8",
      );
      expect(copiedFavicon).toBe("<svg></svg>");

      const copied404 = await readFile(
        path.join(distPublicDir, "404.html"),
        "utf8",
      );
      expect(copied404).toContain("Block Garden - Not Found");

      const copiedManifest = JSON.parse(
        await readFile(path.join(distPublicDir, "manifest.json"), "utf8"),
      );
      expect(copiedManifest.name).toBe("Block Garden");
      expect(copiedManifest.start_url).toBe("/demo/");

      const copiedSitemap = await readFile(
        path.join(distPublicDir, "sitemap.xml"),
        "utf8",
      );
      expect(copiedSitemap).toContain("<urlset>");

      const copiedAsset = await readFile(
        path.join(distPublicDir, "assets", "demo-asset.png"),
        "utf8",
      );
      expect(copiedAsset).toBe("FAKE_PNG");
    });

    it("applies site configuration files from dedicated pages/resources directory layout", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const pagesDir = path.join(tmpDir, "pages");
      const resourcesDir = path.join(pagesDir, "resources");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(resourcesDir, { recursive: true });

      const indexPath = path.join(distPublicDir, "index.html");
      const siteConfigPath = path.join(resourcesDir, "site-config.json");

      await writeFile(
        indexPath,
        '<!doctype html><html><head><script src="theme-init.js"></script></head><body></body></html>',
        "utf8",
      );

      await writeFile(
        path.join(resourcesDir, "favicon.svg"),
        '<svg id="demo-fav"></svg>',
        "utf8",
      );
      await writeFile(
        path.join(resourcesDir, "404.html"),
        "<title>Resource 404</title>",
        "utf8",
      );
      await writeFile(
        path.join(resourcesDir, "manifest.json"),
        JSON.stringify({ name: "Resources Manifest" }),
        "utf8",
      );

      const resAssetsDir = path.join(resourcesDir, "assets");
      await mkdir(resAssetsDir, { recursive: true });
      await writeFile(
        path.join(resAssetsDir, "icon.png"),
        "PNG_RESOURCE",
        "utf8",
      );

      const config = {
        site: { title: "Resources Demo" },
        branding: { faviconPath: "favicon.svg" },
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      const result = await applySiteConfig(distPublicDir, siteConfigPath);
      expect(result.applied).toBe(true);

      const copiedFavicon = await readFile(
        path.join(distPublicDir, "favicon.svg"),
        "utf8",
      );
      expect(copiedFavicon).toContain("demo-fav");

      const copiedManifest = JSON.parse(
        await readFile(path.join(distPublicDir, "manifest.json"), "utf8"),
      );
      expect(copiedManifest.name).toBe("Resources Demo");

      const copiedAsset = await readFile(
        path.join(distPublicDir, "assets", "icon.png"),
        "utf8",
      );
      expect(copiedAsset).toBe("PNG_RESOURCE");
    });

    it("prefers the content repo's pages/resources branding asset over a same-path ShadowClaw default at the repo root", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const repoRootDir = tmpDir;
      const pagesResourcesDir = path.join(repoRootDir, "pages/resources");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(pagesResourcesDir, { recursive: true });

      const indexPath = path.join(distPublicDir, "index.html");
      await writeFile(
        indexPath,
        "<!doctype html><html><head></head><body></body></html>",
        "utf8",
      );

      // Simulates ShadowClaw's own bundled default icon at the repo root.
      const defaultIconDir = path.join(repoRootDir, "assets/icons");
      await mkdir(defaultIconDir, { recursive: true });
      await writeFile(
        path.join(defaultIconDir, "favicon.ico"),
        "SHADOW_CLAW_DEFAULT_ICON",
        "utf8",
      );

      // Simulates the content repo's own override, copied to pages/resources/.
      const contentIconDir = path.join(pagesResourcesDir, "assets/icons");
      await mkdir(contentIconDir, { recursive: true });
      await writeFile(
        path.join(contentIconDir, "favicon.ico"),
        "CONTENT_REPO_CUSTOM_ICON",
        "utf8",
      );

      const siteConfigPath = path.join(repoRootDir, "site-config.json");
      const config = {
        branding: { faviconPath: "assets/icons/favicon.ico" },
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      await copyBrandingAssets(config, distPublicDir, siteConfigPath);

      const copiedFavicon = await readFile(
        path.join(distPublicDir, "assets/icons/favicon.ico"),
        "utf8",
      );
      expect(copiedFavicon).toBe("CONTENT_REPO_CUSTOM_ICON");
    });

    it("prioritizes template resources (pages/resources/manifest.json) over root repository defaults", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const pagesDir = path.join(tmpDir, "pages");
      const resourcesDir = path.join(pagesDir, "resources");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(resourcesDir, { recursive: true });

      const indexPath = path.join(distPublicDir, "index.html");
      const siteConfigPath = path.join(resourcesDir, "site-config.json");

      await writeFile(
        indexPath,
        "<!doctype html><html><head></head><body></body></html>",
        "utf8",
      );

      // Root-level default manifest (simulating shadow-claw/manifest.json)
      const rootManifestPath = path.join(tmpDir, "manifest.json");
      await writeFile(
        rootManifestPath,
        JSON.stringify({
          name: "ShadowClaw Root",
          screenshots: [
            {
              sizes: "1920x1050",
              src: "assets/screenshots/shadow-claw-screenshot-1920x1052.png",
            },
          ],
        }),
        "utf8",
      );

      // Template-level manifest in pages/resources/manifest.json
      const templateManifestPath = path.join(resourcesDir, "manifest.json");
      await writeFile(
        templateManifestPath,
        JSON.stringify({
          name: "Template Custom Manifest",
          screenshots: [
            {
              sizes: "1920x1052",
              src: "assets/screenshots/shadow-claw-screenshot-1920x1052.png",
            },
          ],
        }),
        "utf8",
      );

      const config = {
        site: { title: "Template App" },
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      const result = await applySiteConfig(distPublicDir, siteConfigPath);
      expect(result.applied).toBe(true);

      const copiedManifest = JSON.parse(
        await readFile(path.join(distPublicDir, "manifest.json"), "utf8"),
      );
      expect(copiedManifest.screenshots[0].sizes).toBe("1920x1052");
    });

    it("applies site configuration supporting sitemap.txt", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const pagesDir = path.join(tmpDir, "pages");
      const resourcesDir = path.join(pagesDir, "resources");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(resourcesDir, { recursive: true });

      const indexPath = path.join(distPublicDir, "index.html");
      const siteConfigPath = path.join(resourcesDir, "site-config.json");

      await writeFile(
        indexPath,
        "<!doctype html><html><head></head><body></body></html>",
        "utf8",
      );
      await writeFile(
        path.join(resourcesDir, "sitemap.txt"),
        "https://example.com/\nhttps://example.com/about",
        "utf8",
      );

      const config = {
        site: { title: "Sitemap Txt Demo" },
        sitemapPath: "sitemap.txt",
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      const oldEnv = process.env.PAGES_ORIGIN;
      try {
        process.env.PAGES_ORIGIN = "https://demo.example.com/";
        const result = await applySiteConfig(distPublicDir, siteConfigPath);
        expect(result.applied).toBe(true);

        const copiedSitemapTxt = await readFile(
          path.join(distPublicDir, "sitemap.txt"),
          "utf8",
        );
        expect(copiedSitemapTxt).toContain(
          "https://demo.example.com/\nhttps://demo.example.com/about",
        );
      } finally {
        if (oldEnv !== undefined) {
          process.env.PAGES_ORIGIN = oldEnv;
        } else {
          delete process.env.PAGES_ORIGIN;
        }
      }
    });

    it("generates sitemap.xml from routes.json when no sitemap is provided", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const resourcesDir = path.join(tmpDir, "pages", "resources");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(resourcesDir, { recursive: true });

      const siteConfigPath = path.join(resourcesDir, "site-config.json");
      await writeFile(
        path.join(distPublicDir, "index.html"),
        "<!doctype html><html><head></head><body></body></html>",
        "utf8",
      );
      await writeFile(
        path.join(resourcesDir, "routes.json"),
        JSON.stringify({
          routes: {
            "/pages/main/index.html": { prettyPath: "/main" },
            "/pages/main/a.md": { prettyPath: "/main/a" },
          },
        }),
        "utf8",
      );
      await writeFile(
        siteConfigPath,
        JSON.stringify({ site: { title: "Generated Sitemap" } }),
        "utf8",
      );

      const oldOrigin = process.env.PAGES_ORIGIN;
      const oldBase = process.env.PAGES_BASE_PATH;
      try {
        process.env.PAGES_ORIGIN = "https://demo.example.com/hub/";
        process.env.PAGES_BASE_PATH = "/hub/";
        await applySiteConfig(distPublicDir, siteConfigPath);

        const sitemap = await readFile(
          path.join(distPublicDir, "sitemap.xml"),
          "utf8",
        );
        expect(sitemap).toContain("<loc>https://demo.example.com/hub/</loc>");
        expect(sitemap).toContain(
          "<loc>https://demo.example.com/hub/main</loc>",
        );
        expect(sitemap).toContain(
          "<loc>https://demo.example.com/hub/main/a</loc>",
        );
      } finally {
        if (oldOrigin !== undefined) {
          process.env.PAGES_ORIGIN = oldOrigin;
        } else {
          delete process.env.PAGES_ORIGIN;
        }

        if (oldBase !== undefined) {
          process.env.PAGES_BASE_PATH = oldBase;
        } else {
          delete process.env.PAGES_BASE_PATH;
        }
      }
    });

    it("falls back to branding.siteUrl for generated sitemap origin", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const resourcesDir = path.join(tmpDir, "pages", "resources");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(resourcesDir, { recursive: true });

      const siteConfigPath = path.join(resourcesDir, "site-config.json");
      await writeFile(
        path.join(distPublicDir, "index.html"),
        "<!doctype html><html><head></head><body></body></html>",
        "utf8",
      );
      await writeFile(
        path.join(resourcesDir, "routes.json"),
        JSON.stringify({
          routes: { "/pages/a.md": { prettyPath: "/about" } },
        }),
        "utf8",
      );
      await writeFile(
        siteConfigPath,
        JSON.stringify({ branding: { siteUrl: "https://site.example.com" } }),
        "utf8",
      );

      const oldOrigin = process.env.PAGES_ORIGIN;
      try {
        delete process.env.PAGES_ORIGIN;
        await applySiteConfig(distPublicDir, siteConfigPath);

        const sitemap = await readFile(
          path.join(distPublicDir, "sitemap.xml"),
          "utf8",
        );
        expect(sitemap).toContain("<loc>https://site.example.com/about</loc>");
      } finally {
        if (oldOrigin !== undefined) {
          process.env.PAGES_ORIGIN = oldOrigin;
        }
      }
    });

    it("prioritizes template custom asset icons over root repository default asset icons", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const pagesDir = path.join(tmpDir, "pages");
      const resourcesDir = path.join(pagesDir, "resources");
      const rootAssetsIconsDir = path.join(tmpDir, "assets", "icons");
      const templateAssetsIconsDir = path.join(resourcesDir, "assets", "icons");

      await mkdir(distPublicDir, { recursive: true });
      await mkdir(rootAssetsIconsDir, { recursive: true });
      await mkdir(templateAssetsIconsDir, { recursive: true });

      const indexPath = path.join(distPublicDir, "index.html");
      const siteConfigPath = path.join(resourcesDir, "site-config.json");

      await writeFile(
        indexPath,
        "<!doctype html><html><head></head><body></body></html>",
        "utf8",
      );

      // Root repository default asset icon
      await writeFile(
        path.join(rootAssetsIconsDir, "96.png"),
        "ROOT_BASE_96_PNG",
        "utf8",
      );

      // Template-level custom asset icon
      await writeFile(
        path.join(templateAssetsIconsDir, "96.png"),
        "TEMPLATE_DEMO_96_PNG",
        "utf8",
      );

      const config = {
        site: { title: "Custom Asset Prioritization Test" },
        assets: ["assets"],
        pwa: { manifestPath: "manifest.json" },
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      const result = await applySiteConfig(distPublicDir, siteConfigPath);
      expect(result.applied).toBe(true);

      const copied96Icon = await readFile(
        path.join(distPublicDir, "assets", "icons", "96.png"),
        "utf8",
      );
      expect(copied96Icon).toBe("TEMPLATE_DEMO_96_PNG");
    });

    it("resolves template assets relative to the repo root (not its parent) when site-config.json lives at the project root", async () => {
      const workspaceDir = path.join(tmpDir, "workspace");
      const repoDir = path.join(workspaceDir, "shadow-claw-template");
      const distPublicDir = path.join(repoDir, "dist/public");

      await mkdir(distPublicDir, { recursive: true });
      await mkdir(path.join(repoDir, "assets", "icons"), { recursive: true });
      await mkdir(path.join(workspaceDir, "assets", "icons"), {
        recursive: true,
      });

      const indexPath = path.join(distPublicDir, "index.html");
      await writeFile(
        indexPath,
        "<!doctype html><html><head></head><body></body></html>",
        "utf8",
      );

      await writeFile(
        path.join(repoDir, "assets", "icons", "96.png"),
        "REPO_ROOT_96_PNG",
        "utf8",
      );
      await writeFile(
        path.join(workspaceDir, "assets", "icons", "96.png"),
        "OUTSIDE_REPO_96_PNG",
        "utf8",
      );
      await writeFile(
        path.join(workspaceDir, "assets", "leaked-secret.txt"),
        "SHOULD_NOT_LEAK",
        "utf8",
      );

      const siteConfigPath = path.join(repoDir, "site-config.json");
      const config = {
        site: { title: "Root Config Demo" },
        assets: ["assets"],
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      const result = await applySiteConfig(distPublicDir, siteConfigPath);
      expect(result.applied).toBe(true);

      const copiedIcon = await readFile(
        path.join(distPublicDir, "assets", "icons", "96.png"),
        "utf8",
      );
      expect(copiedIcon).toBe("REPO_ROOT_96_PNG");

      await expect(
        readFile(
          path.join(distPublicDir, "assets", "leaked-secret.txt"),
          "utf8",
        ),
      ).rejects.toThrow();
    });

    it("discovers pages/main/sidebar.html and injects it into dist/public/index.html", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const repoDir = tmpDir;
      const pagesMainDir = path.join(repoDir, "pages/main");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(pagesMainDir, { recursive: true });

      const indexPath = path.join(distPublicDir, "index.html");
      await writeFile(
        indexPath,
        "<!doctype html><html><head></head><body><shadow-claw></shadow-claw></body></html>",
        "utf8",
      );

      const sidebarContent =
        '<nav class="my-sidebar"><a href="/about">About Us</a></nav>';
      await writeFile(
        path.join(pagesMainDir, "sidebar.html"),
        sidebarContent,
        "utf8",
      );

      const siteConfigPath = path.join(repoDir, "shadow-claw.config.json");
      const config = {
        site: { title: "Custom Sidebar Site" },
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      const result = await applySiteConfig(distPublicDir, siteConfigPath);
      expect(result.applied).toBe(true);

      const patchedIndex = await readFile(indexPath, "utf8");
      expect(patchedIndex).toContain('slot="sidebar"');
      expect(patchedIndex).toContain("About Us");
    });

    it("generates RSS 2.0, Atom, and RDF feeds when feed.enabled is true", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const pagesDir = path.join(tmpDir, "pages");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(pagesDir, { recursive: true });

      const indexPath = path.join(distPublicDir, "index.html");
      const siteConfigPath = path.join(pagesDir, "site-config.json");
      const routesPath = path.join(pagesDir, "routes.json");

      await writeFile(
        indexPath,
        '<!doctype html><html><head><script src="theme-init.js"></script></head><body><script type="module" src="index.js"></script></body></html>',
        "utf8",
      );

      const routes = {
        routes: {
          "/pages/main/index.html": { prettyPath: "/" },
          "/pages/main/first-post.md": {
            prettyPath: "/posts/first/",
            title: "First Post",
            date: "2026-01-01T00:00:00Z",
            description: "First post description",
          },
        },
      };
      await writeFile(routesPath, JSON.stringify(routes), "utf8");

      const config = {
        site: { title: "Feed Site", description: "Feed Description" },
        branding: { siteUrl: "https://example.com" },
        feed: { enabled: true },
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      const result = await applySiteConfig(distPublicDir, siteConfigPath);
      expect(result.applied).toBe(true);

      const rssXml = await readFile(
        path.join(distPublicDir, "feed/rss.xml"),
        "utf8",
      );
      expect(rssXml).toContain("<title>Feed Site</title>");
      expect(rssXml).toContain("<title>First Post</title>");
      expect(rssXml).toContain("<link>https://example.com/posts/first/</link>");

      const atomXml = await readFile(
        path.join(distPublicDir, "feed/atom/atom.xml"),
        "utf8",
      );
      expect(atomXml).toContain('<title type="text">Feed Site</title>');
      expect(atomXml).toContain(
        '<title type="html"><![CDATA[First Post]]></title>',
      );

      const rdfXml = await readFile(
        path.join(distPublicDir, "feed/rdf/index.xml"),
        "utf8",
      );
      expect(rdfXml).toContain("<title>Feed Site</title>");
      expect(rdfXml).toContain("<title>First Post</title>");

      const rssHtml = await readFile(
        path.join(distPublicDir, "feed/index.html"),
        "utf8",
      );
      expect(rssHtml).toContain('content="0; url=rss.xml"');

      const atomHtml = await readFile(
        path.join(distPublicDir, "feed/atom/index.html"),
        "utf8",
      );
      expect(atomHtml).toContain('content="0; url=atom.xml"');

      const rdfHtml = await readFile(
        path.join(distPublicDir, "feed/rdf/index.html"),
        "utf8",
      );
      expect(rdfHtml).toContain('content="0; url=index.xml"');

      const patchedIndex = await readFile(indexPath, "utf8");
      expect(patchedIndex).toContain('type="application/rss+xml"');
    });

    it("does not generate feeds when feed is not enabled", async () => {
      const distPublicDir = path.join(tmpDir, "dist/public");
      const pagesDir = path.join(tmpDir, "pages");
      await mkdir(distPublicDir, { recursive: true });
      await mkdir(pagesDir, { recursive: true });

      const indexPath = path.join(distPublicDir, "index.html");
      const siteConfigPath = path.join(pagesDir, "site-config.json");

      await writeFile(
        indexPath,
        '<!doctype html><html><head><script src="theme-init.js"></script></head><body><script type="module" src="index.js"></script></body></html>',
        "utf8",
      );

      const config = {
        site: { title: "No Feed Site" },
        branding: { siteUrl: "https://example.com" },
      };
      await writeFile(siteConfigPath, JSON.stringify(config), "utf8");

      await applySiteConfig(distPublicDir, siteConfigPath);

      let exists = false;
      try {
        await stat(path.join(distPublicDir, "feed"));
        exists = true;
      } catch {}
      expect(exists).toBe(false);
    });
  });
});
