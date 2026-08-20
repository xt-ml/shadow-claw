import {
  applySiteConfig,
  escapeHtml,
  patch404Html,
  patchIndexHtml,
  patchManifest,
  patchSitemap,
} from "./apply-site-config.mjs";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("apply-site-config", () => {
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
      expect(patched).toContain(
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

    it("blocks scripts from unapproved domains during build patching", () => {
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
  });

  describe("patchSitemap", () => {
    it("replaces sitemap origin when pagesOrigin is provided", () => {
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
  });
});
