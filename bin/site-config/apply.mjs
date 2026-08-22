#!/usr/bin/env node

/**
 * site-config/apply.mjs
 *
 * Reads a declarative `site-config.json` from the template repo's `pages/`
 * directory and patches production build artefacts in `dist/public/` so
 * template consumers can brand the site without touching ShadowClaw source.
 *
 * Usage:
 *   node bin/site-config/apply.mjs <distPublicDir> <siteConfigPath>
 *
 * Both arguments are required, but the script exits silently (0) when the
 * config file does not exist — site-config.json is optional.
 */

import {
  copyFile,
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCustomElementScriptTags } from "./utils/custom-elements/build-custom-element-script-tags.mjs";
import { getApprovedCustomElementScripts } from "./utils/custom-elements/get-approved-custom-element-scripts.mjs";
import { resolveCustomElementScripts } from "./utils/custom-elements/resolve-custom-element-scripts.mjs";
import { sanitizeEmbeddedCustomElementScripts } from "./utils/custom-elements/sanitize-embedded-custom-element-scripts.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function insertBeforeClosingHead(html, contentToInsert) {
  const lastHeadIndex = html.lastIndexOf("</head>");
  if (lastHeadIndex !== -1) {
    return (
      html.slice(0, lastHeadIndex) +
      contentToInsert +
      "\n" +
      html.slice(lastHeadIndex)
    );
  }
  return `${contentToInsert}\n${html}`;
}

function escapeRegexLiteral(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Prefixes whose *contents* are flattened into dist/public root by
// copyResourceDirEntries() during build (see bin/build/build.mjs). A
// stylesheet path under one of these is copied to dist root, so the leading
// segment must be stripped from its href. Any other pages/* path (e.g.
// pages/main/theme.css) is copied verbatim under dist/public/pages/ and must
// keep its path intact.
const FLATTENED_STYLESHEET_PREFIXES = [
  "pages/resources/",
  "pages/deps/",
  "resources/",
  "deps/",
  "pages/assets/",
  "pages/main/assets/",
];

function resolveThemeStylesheetHref(stylesheet) {
  for (const prefix of FLATTENED_STYLESHEET_PREFIXES) {
    if (stylesheet.startsWith(prefix)) {
      return stylesheet.slice(prefix.length);
    }
  }
  return stylesheet;
}

/** Read a JSON file and return the parsed object, or null on failure. */
async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

/** Read a text file, returning null on failure. */
async function readText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/** Write a text file (overwrite). */
async function writeText(filePath, content) {
  await writeFile(filePath, content, "utf8");
}

// ---------------------------------------------------------------------------
// Patching functions
// ---------------------------------------------------------------------------

/**
 * Patch `index.html` with site metadata and branding from site-config.json.
 */
function patchIndexHtml(html, config) {
  let next = html;

  // --- Site metadata ---

  const site = config.site || {};

  if (site.title) {
    next = next.replace(
      /<title>[^<]*<\/title>/iu,
      `<title>${escapeHtml(site.title)}</title>`,
    );
  }

  if (site.description) {
    next = next.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/iu,
      `<meta name="description" content="${escapeHtml(site.description)}" />`,
    );
  }

  if (site.themeColor) {
    next = next.replace(
      /<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?>/iu,
      `<meta name="theme-color" content="${escapeHtml(site.themeColor)}" />`,
    );
  }

  if (site.lang) {
    next = next.replace(/<html\s+lang="[^"]*"/iu, `<html lang="${site.lang}"`);
  }

  // --- Branding ---

  const branding = config.branding || {};

  if (branding.faviconPath) {
    const faviconHref = branding.faviconPath.replace(/^pages\/main\//, "");
    const iconType = faviconHref.endsWith(".svg")
      ? "image/svg+xml"
      : faviconHref.endsWith(".png")
        ? "image/png"
        : "image/x-icon";
    const newTag = `<link href="${escapeHtml(faviconHref)}" rel="icon" type="${iconType}" />`;
    let faviconReplaced = false;
    next = next.replace(
      /<link\b[^>]*\brel=["']?(?:shortcut\s+)?icon["']?[^>]*\/?>/giu,
      () => {
        if (!faviconReplaced) {
          faviconReplaced = true;
          return newTag;
        }
        return "";
      },
    );
    if (!faviconReplaced) {
      next = insertBeforeClosingHead(next, `  ${newTag}`);
    }
  }

  if (branding.appleTouchIconPath) {
    const appleHref = branding.appleTouchIconPath.replace(/^pages\/main\//, "");
    const newTag = `<link href="${escapeHtml(appleHref)}" rel="apple-touch-icon" />`;
    let appleReplaced = false;
    next = next.replace(
      /<link\b[^>]*\brel=["']?apple-touch-icon["']?[^>]*\/?>/giu,
      () => {
        if (!appleReplaced) {
          appleReplaced = true;
          return newTag;
        }
        return "";
      },
    );
    if (!appleReplaced) {
      next = insertBeforeClosingHead(next, `  ${newTag}`);
    }
  }

  // Replace header-title-link slot content
  if (branding.titleText || branding.siteUrl || branding.logoSlotHtml) {
    const titleText = branding.titleText || "ShadowClaw";
    const siteUrl = branding.siteUrl || "";
    const logoHtml = branding.logoSlotHtml || "";

    // Match the entire <a slot="header-title-link"> ... </a> block
    next = next.replace(
      /<a\b[^>]*\bslot="header-title-link"[^>]*>[\s\S]*?<\/a>/iu,
      [
        `<a`,
        `      aria-label="${escapeHtml(titleText)}"`,
        `      class="header-title-link"`,
        siteUrl ? `      href="${escapeHtml(siteUrl)}"` : "",
        `      slot="header-title-link"`,
        `    >`,
        logoHtml ? `      ${logoHtml}` : "",
        `      <span class="header-title">${escapeHtml(titleText)}</span>`,
        `    </a>`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  // Replace header-actions-logo slot content
  if (branding.repoUrl) {
    const repoLabel = branding.repoLabel || "Project on GitHub";
    next = next.replace(
      /<a\b[^>]*\bslot="header-actions-logo"[^>]*>[\s\S]*?<\/a>/iu,
      [
        `<a`,
        `      aria-label="${escapeHtml(repoLabel)}"`,
        `      class="header-actions-logo-link"`,
        `      href="${escapeHtml(branding.repoUrl)}"`,
        `      slot="header-actions-logo"`,
        `    >`,
        // Preserve the GitHub SVG — template can override via logoSlotHtml on the title side
        `      <svg aria-hidden="true" focusable="false" viewBox="0 0 496 512" xmlns="http://www.w3.org/2000/svg">`,
        `        <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8z" fill="var(--shadow-claw-bg-primary-reverse, currentColor)"></path>`,
        `      </svg>`,
        `    </a>`,
      ].join("\n"),
    );
  }

  // --- Origin trial: strip for non-xt-ml origins ---
  if (branding.siteUrl && !branding.siteUrl.includes("xt-ml.github.io")) {
    next = next.replace(
      /\s*<meta\s+http-equiv="origin-trial"\s+content="[^"]*"\s*\/?>\s*/iu,
      "\n",
    );
  }

  // --- Theme stylesheet injection ---
  const theme = config.theme || {};
  if (theme.stylesheet) {
    // Unlike favicon/appleTouchIcon, pages/main/* is copied verbatim to
    // dist/public/pages/main/* (not flattened to dist root — only the
    // contents of pages/{resources,deps,assets}/ and pages/main/assets/ are
    // flattened), so the href must keep its pages/ prefix or the browser
    // 404s on it.
    const stylesheetHref = resolveThemeStylesheetHref(theme.stylesheet);
    const themeCssTag = `<link rel="stylesheet" href="${escapeHtml(stylesheetHref)}" />`;
    if (
      !next.includes(`href="${stylesheetHref}"`) &&
      !next.includes(`href="${escapeHtml(stylesheetHref)}"`)
    ) {
      if (/<link\s+rel="stylesheet"\s+href="index\.css"\s*\/?>/iu.test(next)) {
        next = next.replace(
          /(<link\s+rel="stylesheet"\s+href="index\.css"\s*\/?>)/iu,
          `$1\n    ${themeCssTag}`,
        );
      } else {
        next = insertBeforeClosingHead(next, `  ${themeCssTag}`);
      }
    }
  }

  // --- Custom scripts & custom elements injection ---
  const { rawScripts, allowedDomains } = resolveCustomElementScripts(
    config,
    theme,
  );
  const approvedEntries = getApprovedCustomElementScripts(
    rawScripts,
    allowedDomains,
    console.warn,
  );
  const scriptTags = buildCustomElementScriptTags(approvedEntries, escapeHtml);

  if (scriptTags) {
    if (
      /<script\s+type="module"\s+src="index\.js"\s*><\/script>/iu.test(next)
    ) {
      next = next.replace(
        /(<script\s+type="module"\s+src="index\.js"\s*><\/script>)/iu,
        `${scriptTags}\n    $1`,
      );
    } else {
      next = insertBeforeClosingHead(next, `${scriptTags}`);
    }
  }

  // --- Embed site-config.json for runtime boot-time seeding ---
  // Clone and sanitize embedded config to exclude any rejected scripts
  const sanitizedConfig = sanitizeEmbeddedCustomElementScripts(
    config,
    allowedDomains,
  );

  const safeJson = JSON.stringify(sanitizedConfig)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\u002f");

  const siteConfigScript = `<script id="shadow-claw-site-config" type="application/json">${safeJson}</script>`;

  if (next.includes('<script id="shadow-claw-site-config"')) {
    next = next.replace(
      /<script\s+id="shadow-claw-site-config"[\s\S]*?<\/script>/iu,
      () => siteConfigScript,
    );
  } else if (next.includes('<script src="theme-init.js">')) {
    next = next.replace(
      '<script src="theme-init.js">',
      `${siteConfigScript}\n    <script src="theme-init.js">`,
    );
  } else if (/<script\b[^>]*>\s*var\s+ShadowClawThemeInit\b/iu.test(next)) {
    next = next.replace(
      /(<script\b[^>]*>\s*var\s+ShadowClawThemeInit\b)/iu,
      `${siteConfigScript}\n    $1`,
    );
  } else {
    next = insertBeforeClosingHead(next, `  ${siteConfigScript}`);
  }

  return next;
}

function normalizeManifestIcon(icon) {
  const src = (icon.src || "").replace(
    /^(pages\/)?(resources\/|deps\/|main\/)?/,
    "",
  );
  const iconType =
    icon.type ||
    (src.endsWith(".svg")
      ? "image/svg+xml"
      : src.endsWith(".png")
        ? "image/png"
        : "image/x-icon");

  const rawPurpose = (icon.purpose || "any").trim();

  if (iconType === "image/svg+xml" || src.endsWith(".svg")) {
    return [
      {
        ...icon,
        src,
        type: iconType,
        purpose: "any",
      },
    ];
  }

  if (rawPurpose.includes("any") && rawPurpose.includes("maskable")) {
    return [
      { ...icon, src, type: iconType, purpose: "any" },
      { ...icon, src, type: iconType, purpose: "maskable" },
    ];
  }

  return [
    {
      ...icon,
      src,
      type: iconType,
      purpose: rawPurpose,
    },
  ];
}

/**
 * Patch `manifest.json` with PWA branding from site-config.json.
 */
function patchManifest(manifestJson, config) {
  const manifest =
    typeof manifestJson === "string" ? JSON.parse(manifestJson) : manifestJson;
  const pwa = config.pwa || {};
  const site = config.site || {};
  const pagesOrigin = process.env.PAGES_ORIGIN;
  const basePath = process.env.PAGES_BASE_PATH;

  if (pwa.name || site.title) {
    manifest.name = pwa.name || site.title;
  }

  if (pwa.shortName || site.title) {
    manifest.short_name = pwa.shortName || site.title;
  }

  if (site.description) {
    manifest.description = site.description;
  }

  if (pwa.backgroundColor) {
    manifest.background_color = pwa.backgroundColor;
  }

  if (pwa.themeColor || site.themeColor) {
    manifest.theme_color = pwa.themeColor || site.themeColor;
  }

  if (pwa.startUrl) {
    manifest.start_url = pwa.startUrl;
  } else if (pagesOrigin) {
    manifest.start_url = pagesOrigin;
  } else if (!manifest.start_url) {
    manifest.start_url = "./";
  }

  if (pwa.icons && Array.isArray(pwa.icons)) {
    const customIcons = pwa.icons.flatMap(normalizeManifestIcon);
    const existingIcons = Array.isArray(manifest.icons)
      ? manifest.icons.flatMap(normalizeManifestIcon)
      : [];
    const customSrcs = new Set(customIcons.map((i) => i.src));
    manifest.icons = [
      ...customIcons,
      ...existingIcons.filter((i) => !customSrcs.has(i.src)),
    ];
  } else if (Array.isArray(manifest.icons)) {
    manifest.icons = manifest.icons.flatMap(normalizeManifestIcon);
  }

  if (pwa.screenshots && Array.isArray(pwa.screenshots)) {
    manifest.screenshots = pwa.screenshots.map((screen) => {
      const src = (screen.src || "").replace(
        /^(pages\/)?(resources\/|deps\/|main\/)?/,
        "",
      );
      return {
        ...screen,
        src,
      };
    });
  }

  return JSON.stringify(manifest, null, 2);
}

/**
 * Patch `sitemap.xml` or `sitemap.txt` — replace the hardcoded origin with PAGES_ORIGIN.
 */
function patchSitemap(content, pagesOrigin) {
  if (!pagesOrigin) {
    return content;
  }

  if (/<loc>/i.test(content)) {
    return content.replace(
      /<loc>[^<]*<\/loc>/giu,
      `<loc>${escapeHtml(pagesOrigin)}</loc>`,
    );
  }

  const normalizedOrigin = pagesOrigin.endsWith("/")
    ? pagesOrigin
    : pagesOrigin + "/";

  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        try {
          const u = new URL(trimmed);
          const originUrl = new URL(normalizedOrigin);
          u.protocol = originUrl.protocol;
          u.host = originUrl.host;
          let basePath = originUrl.pathname.endsWith("/")
            ? originUrl.pathname.slice(0, -1)
            : originUrl.pathname;
          let pagePath = u.pathname;
          u.pathname = basePath + pagePath;
          return u.toString();
        } catch {
          return normalizedOrigin;
        }
      } else if (trimmed.startsWith("/")) {
        try {
          return new URL(trimmed, normalizedOrigin).toString();
        } catch {
          return line;
        }
      }
      return line;
    })
    .join("\n");
}

/**
 * Patch `404.html` — title and base path redirection for GitHub Pages SPA.
 */
function patch404Html(html, config, basePath) {
  let next = html;
  const site = config.site || {};

  if (site.title) {
    next = next.replace(
      /<title>[^<]*<\/title>/iu,
      `<title>${escapeHtml(site.title)} - Not Found</title>`,
    );
  }

  if (basePath) {
    const safeBasePath = basePath.endsWith("/") ? basePath : basePath + "/";
    next = next.replace(
      /l\.replace\(["']\/shadow-claw\/["']\)/gu,
      `l.replace("${escapeHtml(safeBasePath)}")`,
    );
  }

  return next;
}

function getRepoRootDir(configDir) {
  const resolved = path.resolve(configDir);
  const parts = resolved.split(path.sep);
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  if ((last === "resources" || last === "deps") && secondLast === "pages") {
    return path.resolve(resolved, "../..");
  }
  if (last === "resources" || last === "deps" || last === "pages") {
    return path.resolve(resolved, "..");
  }
  return resolved;
}

/**
 * Resolve the template root directory (the directory site-config.json
 * "belongs" to conceptually) without escaping above the repo root when
 * site-config.json lives directly at the repo root — otherwise candidate
 * resolution could leak in unrelated sibling directories on disk.
 */
function getTemplateRootDir(configDir) {
  const resolved = path.resolve(configDir);
  const last = path.basename(resolved);
  if (last === "resources" || last === "deps" || last === "pages") {
    return path.resolve(resolved, "..");
  }
  return resolved;
}

/**
 * Helper to resolve candidate file paths considering resources/, deps/, main/ and templateRootDir.
 *
 * Content/template-specific locations (pages/resources, pages/deps, pages/,
 * pages/main) are checked before bare repo-root paths. ShadowClaw itself
 * ships default assets (e.g. assets/icons/favicon.ico) at the repo root, so
 * a bare-root candidate must be a last resort — otherwise it would always
 * shadow a content repo's own override living under pages/.
 */
function getCandidateFilePaths(relativePath, configDir, templateRootDir) {
  if (!relativePath || typeof relativePath !== "string") return [];
  if (path.isAbsolute(relativePath)) return [relativePath];

  const cleanPath = relativePath.replace(
    /^(pages\/)?(resources\/|deps\/|main\/)?/,
    "",
  );
  const repoRootDir = getRepoRootDir(configDir);

  return [
    path.resolve(configDir, "resources", cleanPath),
    path.resolve(configDir, "deps", cleanPath),
    path.resolve(configDir, "main", cleanPath),
    path.resolve(repoRootDir, "pages", "resources", cleanPath),
    path.resolve(repoRootDir, "pages", "resources", relativePath),
    path.resolve(repoRootDir, "pages", "deps", cleanPath),
    path.resolve(repoRootDir, "pages", "deps", relativePath),
    path.resolve(repoRootDir, "resources", cleanPath),
    path.resolve(repoRootDir, "resources", relativePath),
    path.resolve(repoRootDir, "deps", cleanPath),
    path.resolve(repoRootDir, "deps", relativePath),
    path.resolve(templateRootDir, "pages", "resources", cleanPath),
    path.resolve(templateRootDir, "pages", "deps", cleanPath),
    path.resolve(templateRootDir, "resources", cleanPath),
    path.resolve(templateRootDir, "deps", cleanPath),
    path.resolve(templateRootDir, "pages", relativePath),
    path.resolve(templateRootDir, "pages", cleanPath),
    path.resolve(templateRootDir, "pages", "main", cleanPath),
    path.resolve(repoRootDir, "pages", relativePath),
    path.resolve(repoRootDir, "pages", cleanPath),
    path.resolve(repoRootDir, "pages", "main", cleanPath),
    path.resolve(repoRootDir, "pages", "main", relativePath),
    // Bare repo-root/template-root fallbacks last: these match ShadowClaw's
    // own bundled default assets and must not shadow content overrides.
    path.resolve(configDir, relativePath),
    path.resolve(configDir, cleanPath),
    path.resolve(templateRootDir, relativePath),
    path.resolve(templateRootDir, cleanPath),
    path.resolve(repoRootDir, relativePath),
    path.resolve(repoRootDir, cleanPath),
  ];
}

async function findFirstExisting(candidates) {
  for (const cand of candidates) {
    if (!cand) continue;
    try {
      await stat(cand);
      return cand;
    } catch {}
  }
  return null;
}

/**
 * Copies custom template overrides for 404.html, manifest.json, sitemap.xml,
 * assets directories, and root-level resources if present in the template repository.
 */
async function copyCustomSiteFiles(config, distPublicDir, siteConfigPath) {
  const configDir = siteConfigPath
    ? path.dirname(path.resolve(siteConfigPath))
    : process.cwd();
  const templateRootDir = getTemplateRootDir(configDir);
  const repoRootDir = getRepoRootDir(configDir);

  // Copy any root-level resource directory (resources, deps, pages/resources, pages/deps)
  const resourceDirCandidates = [
    path.resolve(configDir, "resources"),
    path.resolve(configDir, "deps"),
    path.resolve(templateRootDir, "resources"),
    path.resolve(templateRootDir, "deps"),
    path.resolve(templateRootDir, "pages", "resources"),
    path.resolve(templateRootDir, "pages", "deps"),
    path.resolve(repoRootDir, "resources"),
    path.resolve(repoRootDir, "deps"),
    path.resolve(repoRootDir, "pages", "resources"),
    path.resolve(repoRootDir, "pages", "deps"),
  ];

  for (const resDir of resourceDirCandidates) {
    try {
      const entries = await readdir(resDir, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(resDir, entry.name);
        const destPath = path.join(distPublicDir, entry.name);
        if (entry.isDirectory()) {
          await cp(srcPath, destPath, { recursive: true, force: true });
        } else if (entry.isFile()) {
          await mkdir(path.dirname(destPath), { recursive: true });
          await copyFile(srcPath, destPath);
        }
      }
    } catch {}
  }

  // 1. Custom 404.html
  const notFoundCandidates = [
    ...(config.pages?.notFoundPath
      ? getCandidateFilePaths(
          config.pages.notFoundPath,
          configDir,
          templateRootDir,
        )
      : []),
    ...(config.branding?.notFoundPath
      ? getCandidateFilePaths(
          config.branding.notFoundPath,
          configDir,
          templateRootDir,
        )
      : []),
    ...(config.notFoundPath
      ? getCandidateFilePaths(config.notFoundPath, configDir, templateRootDir)
      : []),
    ...getCandidateFilePaths("404.html", configDir, templateRootDir),
  ];

  const found404 = await findFirstExisting(notFoundCandidates);
  if (found404) {
    try {
      await copyFile(found404, path.join(distPublicDir, "404.html"));
      console.log(`  Copied custom 404.html: ${found404}`);
    } catch (err) {
      console.warn(`  Warning: Could not copy custom 404.html: ${err.message}`);
    }
  }

  // 2. Custom manifest.json
  const manifestCandidates = [
    ...(config.pwa?.manifestPath
      ? getCandidateFilePaths(
          config.pwa.manifestPath,
          configDir,
          templateRootDir,
        )
      : []),
    ...(config.manifestPath
      ? getCandidateFilePaths(config.manifestPath, configDir, templateRootDir)
      : []),
    ...getCandidateFilePaths("manifest.json", configDir, templateRootDir),
  ];

  const foundManifest = await findFirstExisting(manifestCandidates);
  if (foundManifest) {
    try {
      await copyFile(foundManifest, path.join(distPublicDir, "manifest.json"));
      console.log(`  Copied custom manifest.json: ${foundManifest}`);
    } catch (err) {
      console.warn(
        `  Warning: Could not copy custom manifest.json: ${err.message}`,
      );
    }
  }

  // 3. Custom sitemap (sitemap.xml or sitemap.txt)
  let copiedSitemap = false;
  if (config.sitemapPath) {
    const sitemapCandidates = getCandidateFilePaths(
      config.sitemapPath,
      configDir,
      templateRootDir,
    );
    const foundSitemap = await findFirstExisting(sitemapCandidates);
    if (foundSitemap) {
      try {
        const destName = path.basename(foundSitemap);
        await copyFile(foundSitemap, path.join(distPublicDir, destName));
        console.log(`  Copied custom sitemap: ${foundSitemap} → ${destName}`);
        copiedSitemap = true;
      } catch (err) {
        console.warn(
          `  Warning: Could not copy custom sitemap: ${err.message}`,
        );
      }
    }
  }

  if (!copiedSitemap) {
    const foundXml = await findFirstExisting(
      getCandidateFilePaths("sitemap.xml", configDir, templateRootDir),
    );
    if (foundXml) {
      try {
        await copyFile(foundXml, path.join(distPublicDir, "sitemap.xml"));
        console.log(`  Copied custom sitemap.xml: ${foundXml}`);
      } catch (err) {
        console.warn(
          `  Warning: Could not copy custom sitemap.xml: ${err.message}`,
        );
      }
    }

    const foundTxt = await findFirstExisting(
      getCandidateFilePaths("sitemap.txt", configDir, templateRootDir),
    );
    if (foundTxt) {
      try {
        await copyFile(foundTxt, path.join(distPublicDir, "sitemap.txt"));
        console.log(`  Copied custom sitemap.txt: ${foundTxt}`);
      } catch (err) {
        console.warn(
          `  Warning: Could not copy custom sitemap.txt: ${err.message}`,
        );
      }
    }
  }

  // 4. Custom assets directories
  const overwriteAssets =
    config.overwriteAssets === true ||
    config.branding?.overwriteAssets === true;

  const rawAssetPaths = Array.isArray(config.assets)
    ? config.assets
    : [config.assetsDir, config.assets].filter(Boolean);

  const assetCandidates = Array.from(
    new Set(
      [
        ...rawAssetPaths.flatMap((ap) =>
          getCandidateFilePaths(ap, configDir, templateRootDir),
        ),
        ...getCandidateFilePaths("assets", configDir, templateRootDir),
      ].filter((item) => item && typeof item === "string"),
    ),
  );

  const destAssetsDir = path.join(distPublicDir, "assets");

  if (overwriteAssets) {
    try {
      await rm(destAssetsDir, { recursive: true, force: true });
      await mkdir(destAssetsDir, { recursive: true });
      console.log(
        `  Cleared dist public assets for complete template asset overwrite.`,
      );
    } catch {}
  }

  const copiedAssetSources = new Set();
  const reversedCandidates = [...assetCandidates].reverse();
  for (const candidate of reversedCandidates) {
    if (copiedAssetSources.has(candidate)) continue;
    try {
      const st = await stat(candidate);
      copiedAssetSources.add(candidate);
      if (st.isDirectory()) {
        await cp(candidate, destAssetsDir, { recursive: true, force: true });
        console.log(`  Copied custom assets: ${candidate} → ${destAssetsDir}`);
      } else if (st.isFile()) {
        const fileName = path.basename(candidate);
        await mkdir(destAssetsDir, { recursive: true });
        await copyFile(candidate, path.join(destAssetsDir, fileName));
        console.log(
          `  Copied custom asset file: ${candidate} → ${destAssetsDir}`,
        );
      }
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Theme stylesheet copy
// ---------------------------------------------------------------------------

async function copyThemeStylesheet(config, distPublicDir, siteConfigPath) {
  const theme = config.theme || {};
  if (!theme.stylesheet) {
    return;
  }

  const configDir = siteConfigPath
    ? path.dirname(path.resolve(siteConfigPath))
    : process.cwd();
  const templateRootDir = getTemplateRootDir(configDir);

  const candidatePaths = getCandidateFilePaths(
    theme.stylesheet,
    configDir,
    templateRootDir,
  );

  const sourcePath = await findFirstExisting(candidatePaths);
  if (!sourcePath) return;

  const destFilename = theme.stylesheet.replace(
    /^(pages\/)?(resources\/|deps\/|main\/)?/,
    "",
  );
  const destPath = path.join(distPublicDir, destFilename);

  try {
    await mkdir(path.dirname(destPath), { recursive: true });
    await copyFile(sourcePath, destPath);
    console.log(`  Copied theme stylesheet: ${sourcePath} → ${destPath}`);
  } catch (err) {
    console.warn(
      `  Warning: Could not copy theme stylesheet ${sourcePath}: ${err.message}`,
    );
  }
}

async function copyLocalScripts(config, distPublicDir, siteConfigPath) {
  const rawScripts =
    (config.customElements &&
    typeof config.customElements === "object" &&
    !Array.isArray(config.customElements)
      ? config.customElements?.scripts
      : undefined) ||
    config.scripts ||
    [];

  if (!Array.isArray(rawScripts) || rawScripts.length === 0) {
    return;
  }

  const configDir = siteConfigPath
    ? path.dirname(path.resolve(siteConfigPath))
    : process.cwd();
  const templateRootDir = getTemplateRootDir(configDir);

  for (const entry of rawScripts) {
    const src = typeof entry === "string" ? entry : entry?.src;
    if (
      !src ||
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("//")
    ) {
      continue;
    }

    const candidatePaths = getCandidateFilePaths(
      src,
      configDir,
      templateRootDir,
    );
    const sourcePath = await findFirstExisting(candidatePaths);

    if (sourcePath) {
      const destFilename = src.replace(
        /^(pages\/)?(resources\/|deps\/|main\/)?/,
        "",
      );
      const destPath = path.join(distPublicDir, destFilename);
      try {
        await mkdir(path.dirname(destPath), { recursive: true });
        await copyFile(sourcePath, destPath);
        console.log(`  Copied custom script: ${sourcePath} → ${destPath}`);
      } catch (err) {
        console.warn(
          `  Warning: Could not copy custom script ${sourcePath}: ${err.message}`,
        );
      }
    }
  }
}

async function copyBrandingAssets(config, distPublicDir, siteConfigPath) {
  const branding = config.branding || {};
  const pwa = config.pwa || {};

  const configDir = siteConfigPath
    ? path.dirname(path.resolve(siteConfigPath))
    : process.cwd();
  const templateRootDir = getTemplateRootDir(configDir);

  let manifestIconSrcs = [];
  const manifestCandidate = await findFirstExisting(
    getCandidateFilePaths(
      pwa.manifestPath || config.manifestPath || "manifest.json",
      configDir,
      templateRootDir,
    ),
  );
  if (manifestCandidate) {
    const manifestData = await readJson(manifestCandidate);
    if (manifestData && Array.isArray(manifestData.icons)) {
      manifestIconSrcs = manifestData.icons.map((i) => i?.src).filter(Boolean);
    }
  }

  const candidateAssets = [
    branding.faviconPath,
    branding.appleTouchIconPath,
    "assets/icons/favicon.svg",
    "assets/icons/favicon.ico",
    "favicon.svg",
    "favicon.ico",
    "pages/resources/assets/icons/favicon.svg",
    "pages/resources/assets/icons/favicon.ico",
    "pages/resources/favicon.svg",
    "pages/deps/favicon.svg",
    "pages/main/favicon.svg",
    ...(Array.isArray(pwa.icons) ? pwa.icons.map((i) => i.src) : []),
    ...manifestIconSrcs,
  ].filter(
    (p) =>
      p &&
      typeof p === "string" &&
      !p.startsWith("http://") &&
      !p.startsWith("https://") &&
      !p.startsWith("//"),
  );

  if (candidateAssets.length === 0) {
    return;
  }

  const copiedPaths = new Set();
  const copiedDestPaths = new Set();

  for (const assetPath of candidateAssets) {
    if (copiedPaths.has(assetPath)) continue;
    copiedPaths.add(assetPath);

    const candidatePaths = getCandidateFilePaths(
      assetPath,
      configDir,
      templateRootDir,
    );
    const sourcePath = await findFirstExisting(candidatePaths);

    if (sourcePath) {
      const destFilename = assetPath.replace(
        /^(pages\/)?(resources\/|deps\/|main\/)?/,
        "",
      );
      const destPath = path.join(distPublicDir, destFilename);
      if (copiedDestPaths.has(destPath)) continue;
      copiedDestPaths.add(destPath);
      try {
        await mkdir(path.dirname(destPath), { recursive: true });
        await copyFile(sourcePath, destPath);
        console.log(`  Copied branding asset: ${sourcePath} → ${destPath}`);
      } catch (err) {
        console.warn(
          `  Warning: Could not copy branding asset ${sourcePath}: ${err.message}`,
        );
      }
    }
  }
}

export {
  copyBrandingAssets,
  copyCustomSiteFiles,
  copyLocalScripts,
  copyThemeStylesheet,
  patch404Html,
  patchIndexHtml,
  patchManifest,
  patchSitemap,
};

export async function applySiteConfig(distPublicDir, siteConfigPath) {
  const config = await readJson(siteConfigPath);
  if (!config) {
    console.log("No site-config.json found — skipping site configuration.");
    return { applied: false };
  }

  console.log("Applying site-config.json...");

  const pagesOrigin = process.env.PAGES_ORIGIN || "";
  const basePath = process.env.PAGES_BASE_PATH || "";

  // --- Copy custom template site files (404.html, manifest.json, sitemap.xml, assets) ---
  await copyCustomSiteFiles(config, distPublicDir, siteConfigPath);

  // --- index.html ---
  const indexPath = path.join(distPublicDir, "index.html");
  const indexHtml = await readText(indexPath);
  if (indexHtml) {
    const patched = patchIndexHtml(indexHtml, config);
    await writeText(indexPath, patched);
    console.log("  Patched index.html");
  }

  // --- manifest.json ---
  const manifestPath = path.join(distPublicDir, "manifest.json");
  const manifestText = await readText(manifestPath);
  if (manifestText) {
    const patched = patchManifest(manifestText, config);
    await writeText(manifestPath, patched);
    console.log("  Patched manifest.json");
  }

  // --- sitemap.xml / sitemap.txt ---
  for (const sitemapName of ["sitemap.xml", "sitemap.txt"]) {
    const sitemapPath = path.join(distPublicDir, sitemapName);
    const sitemapText = await readText(sitemapPath);
    if (sitemapText && pagesOrigin) {
      const patched = patchSitemap(sitemapText, pagesOrigin);
      await writeText(sitemapPath, patched);
      console.log(`  Patched ${sitemapName}`);
    }
  }

  // --- 404.html ---
  const notFoundPath = path.join(distPublicDir, "404.html");
  const notFoundText = await readText(notFoundPath);
  if (notFoundText) {
    const patched = patch404Html(notFoundText, config, basePath);
    await writeText(notFoundPath, patched);
    console.log("  Patched 404.html");
  }

  // --- Copy theme stylesheet ---
  await copyThemeStylesheet(config, distPublicDir, siteConfigPath);

  // --- Copy local custom scripts ---
  await copyLocalScripts(config, distPublicDir, siteConfigPath);

  // --- Copy branding & PWA icon assets ---
  await copyBrandingAssets(config, distPublicDir, siteConfigPath);

  console.log("Site configuration applied successfully.");
  return { applied: true };
}

async function main() {
  const [distPublicDir, siteConfigPath] = process.argv.slice(2);

  if (!distPublicDir || !siteConfigPath) {
    console.error(
      "Usage: node bin/site-config/apply.mjs <distPublicDir> <siteConfigPath>",
    );
    process.exit(1);
  }

  await applySiteConfig(distPublicDir, siteConfigPath);
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((err) => {
    console.error("site-config/apply.mjs failed:", err);
    process.exit(1);
  });
}
