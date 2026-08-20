#!/usr/bin/env node

/**
 * apply-site-config.mjs
 *
 * Reads a declarative `site-config.json` from the template repo's `pages/`
 * directory and patches production build artefacts in `dist/public/` so
 * template consumers can brand the site without touching ShadowClaw source.
 *
 * Usage:
 *   node bin/apply-site-config.mjs <distPublicDir> <siteConfigPath>
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

function escapeRegexLiteral(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    if (/<link\s+href="[^"]*"\s+rel="icon"\b[^>]*\/?>/iu.test(next)) {
      next = next.replace(
        /<link\s+href="[^"]*"\s+rel="icon"\b[^>]*\/?>/iu,
        newTag,
      );
    } else if (next.includes("</head>")) {
      next = next.replace("</head>", `  ${newTag}\n</head>`);
    }
  }

  if (branding.appleTouchIconPath) {
    const appleHref = branding.appleTouchIconPath.replace(/^pages\/main\//, "");
    const newTag = `<link href="${escapeHtml(appleHref)}" rel="apple-touch-icon" />`;
    if (
      /<link\s+href="[^"]*"\s+rel="apple-touch-icon"\b[^>]*\/?>/iu.test(next)
    ) {
      next = next.replace(
        /<link\s+href="[^"]*"\s+rel="apple-touch-icon"\b[^>]*\/?>/iu,
        newTag,
      );
    } else if (next.includes("</head>")) {
      next = next.replace("</head>", `  ${newTag}\n</head>`);
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
    // Resolve the stylesheet path relative to the dist root
    const stylesheetHref = theme.stylesheet.replace(/^pages\/main\//, "");
    // Inject after index.css
    next = next.replace(
      /(<link\s+rel="stylesheet"\s+href="index\.css"\s*\/?>)/iu,
      `$1\n    <link rel="stylesheet" href="${escapeHtml(stylesheetHref)}" />`,
    );
  }

  // --- Custom scripts & custom elements injection ---
  const customElConfig = config.customElements;
  const rawScripts =
    (typeof customElConfig === "object" && !Array.isArray(customElConfig)
      ? customElConfig.scripts
      : customElConfig) ||
    config.scripts ||
    theme.scripts ||
    [];

  const allowedDomains =
    (typeof customElConfig === "object" && !Array.isArray(customElConfig)
      ? customElConfig.allowedDomains
      : undefined) ||
    config.allowedCustomElementDomains ||
    [];

  const isDomainAllowed = (urlStr) => {
    if (
      !urlStr.startsWith("http://") &&
      !urlStr.startsWith("https://") &&
      !urlStr.startsWith("//")
    ) {
      return true; // local relative script
    }
    if (
      !allowedDomains ||
      (Array.isArray(allowedDomains) && allowedDomains.length === 0)
    ) {
      return true; // if no explicit domain filter at build time, let runtime security handle it
    }
    try {
      const url = new URL(urlStr, "https://localhost");
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      const hostname = url.hostname.toLowerCase();
      const domainList = Array.isArray(allowedDomains)
        ? allowedDomains
        : String(allowedDomains).split(/[\n,]+/);
      return domainList.some((d) => {
        const pattern = d.trim().toLowerCase();
        return (
          hostname === pattern ||
          hostname.endsWith("." + pattern) ||
          pattern === "*"
        );
      });
    } catch {
      return false;
    }
  };

  if (Array.isArray(rawScripts) && rawScripts.length > 0) {
    const approvedEntries = rawScripts.filter((entry) => {
      const src = typeof entry === "string" ? entry : entry?.src;
      if (!src) return false;
      if (!isDomainAllowed(src)) {
        console.warn(
          `[Security] Skipping script from unapproved domain during build: ${src}`,
        );
        return false;
      }
      return true;
    });

    const scriptTags = approvedEntries
      .map((entry) => {
        const rawSrc = typeof entry === "string" ? entry : entry?.src;
        const isLocal =
          !rawSrc.startsWith("http://") &&
          !rawSrc.startsWith("https://") &&
          !rawSrc.startsWith("//");
        const src = isLocal ? rawSrc.replace(/^pages\/main\//, "") : rawSrc;

        if (typeof entry === "string") {
          return `    <script type="module" src="${escapeHtml(src)}"></script>`;
        }
        if (entry && typeof entry === "object" && entry.src) {
          const type = entry.type
            ? ` type="${escapeHtml(entry.type)}"`
            : ' type="module"';
          const asyncAttr = entry.async ? " async" : "";
          const deferAttr = entry.defer ? " defer" : "";
          return `    <script${type}${asyncAttr}${deferAttr} src="${escapeHtml(src)}"></script>`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    if (scriptTags) {
      next = next.replace(
        /(<script\s+type="module"\s+src="index\.js"\s*><\/script>)/iu,
        `${scriptTags}\n    $1`,
      );
    }
  }

  // --- Embed site-config.json for runtime boot-time seeding ---
  // Clone and sanitize embedded config to exclude any rejected scripts
  const sanitizedConfig = JSON.parse(JSON.stringify(config));
  if (
    sanitizedConfig.customElements &&
    typeof sanitizedConfig.customElements === "object" &&
    Array.isArray(sanitizedConfig.customElements.scripts)
  ) {
    sanitizedConfig.customElements.scripts =
      sanitizedConfig.customElements.scripts.filter((entry) => {
        const src = typeof entry === "string" ? entry : entry?.src;
        return src ? isDomainAllowed(src) : false;
      });
  }

  const safeJson = JSON.stringify(sanitizedConfig)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\u002f");

  const siteConfigScript = `<script id="shadow-claw-site-config" type="application/json">${safeJson}</script>`;

  if (next.includes('<script src="theme-init.js">')) {
    next = next.replace(
      '<script src="theme-init.js">',
      `${siteConfigScript}\n    <script src="theme-init.js">`,
    );
  } else if (next.includes("</head>")) {
    next = next.replace("</head>", `  ${siteConfigScript}\n</head>`);
  }

  return next;
}

/**
 * Patch `manifest.json` with PWA branding from site-config.json.
 */
function patchManifest(manifestJson, config) {
  const manifest =
    typeof manifestJson === "string" ? JSON.parse(manifestJson) : manifestJson;
  const pwa = config.pwa || {};
  const site = config.site || {};

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

  if (pwa.icons && Array.isArray(pwa.icons)) {
    manifest.icons = pwa.icons.map((icon) => {
      const src = (icon.src || "").replace(/^pages\/main\//, "");
      const iconType =
        icon.type ||
        (src.endsWith(".svg")
          ? "image/svg+xml"
          : src.endsWith(".png")
            ? "image/png"
            : "image/x-icon");
      return {
        purpose: icon.purpose || "any",
        sizes: icon.sizes,
        src,
        type: iconType,
      };
    });
  }

  return JSON.stringify(manifest, null, 2);
}

/**
 * Patch `sitemap.xml` — replace the hardcoded origin with PAGES_ORIGIN.
 */
function patchSitemap(xml, pagesOrigin) {
  if (!pagesOrigin) {
    return xml;
  }

  return xml.replace(
    /<loc>[^<]*<\/loc>/giu,
    `<loc>${escapeHtml(pagesOrigin)}</loc>`,
  );
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

/**
 * Copies custom template overrides for 404.html, manifest.json, sitemap.xml,
 * and assets directories if present in the template repository.
 */
async function copyCustomSiteFiles(config, distPublicDir, siteConfigPath) {
  const configDir = siteConfigPath
    ? path.dirname(path.resolve(siteConfigPath))
    : process.cwd();
  const templateRootDir = path.resolve(configDir, "..");

  const findFirstExisting = async (candidates) => {
    for (const cand of candidates) {
      if (!cand) continue;
      try {
        await stat(cand);
        return cand;
      } catch {}
    }
    return null;
  };

  // 1. Custom 404.html
  const notFoundCandidates = [
    config.pages?.notFoundPath,
    config.branding?.notFoundPath,
    config.notFoundPath,
    path.resolve(configDir, "404.html"),
    path.resolve(configDir, "main", "404.html"),
    path.resolve(templateRootDir, "404.html"),
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
    config.pwa?.manifestPath,
    config.manifestPath,
    path.resolve(configDir, "manifest.json"),
    path.resolve(configDir, "main", "manifest.json"),
    path.resolve(templateRootDir, "manifest.json"),
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

  // 3. Custom sitemap.xml
  const sitemapCandidates = [
    config.sitemapPath,
    path.resolve(configDir, "sitemap.xml"),
    path.resolve(configDir, "main", "sitemap.xml"),
    path.resolve(templateRootDir, "sitemap.xml"),
  ];

  const foundSitemap = await findFirstExisting(sitemapCandidates);
  if (foundSitemap) {
    try {
      await copyFile(foundSitemap, path.join(distPublicDir, "sitemap.xml"));
      console.log(`  Copied custom sitemap.xml: ${foundSitemap}`);
    } catch (err) {
      console.warn(
        `  Warning: Could not copy custom sitemap.xml: ${err.message}`,
      );
    }
  }

  // 4. Custom assets directories
  const overwriteAssets =
    config.overwriteAssets === true ||
    config.branding?.overwriteAssets === true;

  const rawAssetPaths = Array.isArray(config.assets)
    ? config.assets
    : [config.assetsDir, config.assets].filter(Boolean);

  const assetCandidates = [
    ...rawAssetPaths,
    path.resolve(configDir, "assets"),
    path.resolve(configDir, "main", "assets"),
    path.resolve(templateRootDir, "assets"),
  ].filter((item) => item && typeof item === "string");

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

  for (const candidate of assetCandidates) {
    const absPath = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(templateRootDir, candidate);
    try {
      const st = await stat(absPath);
      if (st.isDirectory()) {
        await cp(absPath, destAssetsDir, { recursive: true, force: true });
        console.log(`  Copied custom assets: ${absPath} → ${destAssetsDir}`);
      } else if (st.isFile()) {
        const fileName = path.basename(absPath);
        await copyFile(absPath, path.join(destAssetsDir, fileName));
        console.log(
          `  Copied custom asset file: ${absPath} → ${destAssetsDir}`,
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

  // Find source stylesheet: try relative to template root (parent of pages/ dir),
  // then relative to siteConfig directory, then relative to cwd.
  const configDir = siteConfigPath
    ? path.dirname(path.resolve(siteConfigPath))
    : process.cwd();
  const templateRootDir = path.resolve(configDir, "..");

  const candidatePaths = [
    path.resolve(templateRootDir, theme.stylesheet),
    path.resolve(configDir, theme.stylesheet),
    path.resolve(theme.stylesheet),
  ];

  let sourcePath = null;
  for (const candidate of candidatePaths) {
    try {
      await readFile(candidate);
      sourcePath = candidate;
      break;
    } catch {}
  }

  if (!sourcePath) {
    sourcePath = candidatePaths[0];
  }

  const destFilename = theme.stylesheet.replace(/^pages\/main\//, "");
  const destPath = path.join(distPublicDir, destFilename);

  try {
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
  const templateRootDir = path.resolve(configDir, "..");

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

    const candidatePaths = [
      path.resolve(templateRootDir, src),
      path.resolve(configDir, src),
      path.resolve(src),
    ];

    let sourcePath = null;
    for (const candidate of candidatePaths) {
      try {
        await readFile(candidate);
        sourcePath = candidate;
        break;
      } catch {}
    }

    if (sourcePath) {
      const destFilename = src.replace(/^pages\/main\//, "");
      const destPath = path.join(distPublicDir, destFilename);
      try {
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

  const candidateAssets = [
    branding.faviconPath,
    branding.appleTouchIconPath,
    "favicon.svg",
    "pages/main/favicon.svg",
    ...(Array.isArray(pwa.icons) ? pwa.icons.map((i) => i.src) : []),
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

  const configDir = siteConfigPath
    ? path.dirname(path.resolve(siteConfigPath))
    : process.cwd();
  const templateRootDir = path.resolve(configDir, "..");

  const copiedPaths = new Set();

  for (const assetPath of candidateAssets) {
    if (copiedPaths.has(assetPath)) continue;
    copiedPaths.add(assetPath);

    const candidatePaths = [
      path.resolve(templateRootDir, assetPath),
      path.resolve(configDir, assetPath),
      path.resolve(configDir, "main", assetPath),
      path.resolve(assetPath),
    ];

    let sourcePath = null;
    for (const candidate of candidatePaths) {
      try {
        await readFile(candidate);
        sourcePath = candidate;
        break;
      } catch {}
    }

    if (sourcePath) {
      const destFilename = assetPath.replace(/^pages\/main\//, "");
      const destPath = path.join(distPublicDir, destFilename);
      try {
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

  // --- sitemap.xml ---
  const sitemapPath = path.join(distPublicDir, "sitemap.xml");
  const sitemapText = await readText(sitemapPath);
  if (sitemapText && pagesOrigin) {
    const patched = patchSitemap(sitemapText, pagesOrigin);
    await writeText(sitemapPath, patched);
    console.log("  Patched sitemap.xml");
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
      "Usage: node bin/apply-site-config.mjs <distPublicDir> <siteConfigPath>",
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
    console.error("apply-site-config.mjs failed:", err);
    process.exit(1);
  });
}
