import { jest } from "@jest/globals";

import {
  applySiteConfig,
  copyBrandingAssets,
  escapeHtml,
  patch404Html,
  patchIndexHtml,
  patchManifest,
  patchSitemap,
} from "./apply.mjs";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("apply-site-config", () => {
  let logSpy;
  let warnSpy;
  let logs = [];

  beforeEach(() => {
    logs = [];
    logSpy = jest.spyOn(console, "log").mockImplementation((...args) => {
      logs.push({ type: "log", args });
    });
    warnSpy = jest.spyOn(console, "warn").mockImplementation((...args) => {
      logs.push({ type: "warn", args });
    });
  });

  afterEach(() => {
    const state = expect.getState();
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

      // build.mjs only copies the whole `pages` dir to `dist/public/pages`;
      // it never flattens pages/main/theme.css to dist/public/theme.css
      // (unlike favicon/appleTouchIcon paths, which are copied to dist root
      // by getPublishCopyPlan). The injected href must match where the file
      // actually ends up, or the browser will 404 on it.
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
    let tmpDir;

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

    // Reproduces a real deployment bug: site-config.json is copied to the
    // shadow-claw repo root (configDir === repo root) while the content
    // repo's own pages/ tree is copied to shadow-claw/pages/. ShadowClaw
    // ships its own default assets/icons/favicon.ico at the repo root, at
    // the exact same relative path declared by branding.faviconPath, so it
    // must not be allowed to shadow the content repo's actual branding
    // asset under pages/resources/.
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
      // An unrelated directory one level above the repo root that happens to
      // share the "assets" name — must never be treated as a template source.
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
      // A file that ONLY exists outside the repo — it must never leak into
      // the build output, regardless of overwrite ordering for shared names.
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
  });
});
