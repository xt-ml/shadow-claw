import { patch404Html, patchIndexHtml, patchManifest } from "./apply.mjs";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const candidatePaths = [
  path.join(projectRoot, "shadow-claw-config.json"),
  path.join(projectRoot, "shadow-claw.config.json"),
  path.join(projectRoot, "shadowclaw.config.json"),
  path.join(projectRoot, "site-config.json"),
];
const configPath =
  candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

describe("shadow-claw default root configuration", () => {
  let config;
  let originalIndexHtml;
  let originalManifest;
  let original404Html;

  beforeAll(async () => {
    config = await readJson(configPath);
    originalIndexHtml = await readFile(
      path.join(projectRoot, "index.html"),
      "utf8",
    );
    originalManifest = await readJson(path.join(projectRoot, "manifest.json"));
    original404Html = await readFile(
      path.join(projectRoot, "404.html"),
      "utf8",
    );
  });

  it("declares the same title, description, and theme color already hardcoded in index.html", () => {
    const patched = patchIndexHtml(originalIndexHtml, config);

    expect(patched).toContain("<title>ShadowClaw</title>");
    expect(patched).toContain(
      '<meta name="description" content="ShadowClaw - Browser-native AI agent." />',
    );
    expect(patched).toContain('<meta name="theme-color" content="#fff" />');
  });

  it("preserves the bespoke header logo/GitHub SVG slots instead of overwriting them", () => {
    const patched = patchIndexHtml(originalIndexHtml, config);

    // No titleText/siteUrl/repoUrl/logoSlotHtml is declared, so the existing
    // slot content authored directly in index.html must be left untouched.
    expect(patched).toContain('slot="header-title-link"');
    expect(patched).toContain("xt-ml.github.io/shadow-claw");
    expect(patched).toContain('slot="header-actions-logo"');
    expect(patched).toContain("M165.9 397.4c0 2-2.3 3.6-5.2 3.6");
  });

  it("keeps the favicon and apple-touch-icon links identical to the current hardcoded values", () => {
    const patched = patchIndexHtml(originalIndexHtml, config);

    expect(patched).toContain(
      '<link href="assets/icons/favicon.ico" rel="icon" type="image/x-icon" />',
    );
    expect(patched).toContain(
      '<link href="assets/icons/180.png" rel="apple-touch-icon" />',
    );
  });

  it("produces a manifest.json with the same values as the current hardcoded manifest", () => {
    const patched = JSON.parse(
      patchManifest(JSON.stringify(originalManifest), config),
    );

    expect(patched.name).toBe(originalManifest.name);
    expect(patched.short_name).toBe(originalManifest.short_name);
    expect(patched.description).toBe(originalManifest.description);
    expect(patched.theme_color).toBe(originalManifest.theme_color);
    expect(patched.background_color).toBe(originalManifest.background_color);
    expect(patched.start_url).toBe(originalManifest.start_url);
    expect(patched.icons).toEqual(originalManifest.icons);
  });

  it("still redirects GitHub Pages 404s to the site root", () => {
    const patched = patch404Html(original404Html, config, undefined);

    expect(patched).toContain('l.replace("/shadow-claw/")');
  });
});
