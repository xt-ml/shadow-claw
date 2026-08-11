#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPagesDsdHost,
  buildShadowClawDsdTemplate,
  buildShadowClawDsdTemplateWithoutPages,
  collectPageSources,
  escapeJsonForHtmlScript,
  extractTemplateContent,
  injectShadowClawTemplate,
  injectStaticManifestScript,
  markNoSeedPrerenderHost,
  normalizePrerenderPagesOption,
  renderPageHtml,
  sortPagePaths,
  splitFrontmatterWithGrayMatter,
} from "./prerender-dsd-shell.mjs";

/**
 * @typedef {import("../src/storage/staticRouting.js").StaticRoutesManifest} StaticRoutesManifest
 * @typedef {import("../src/storage/staticRouting.js").StaticRouteDefinition} StaticRouteDefinition
 * @typedef {import("../src/core/app-routes.js").ShadowClawAppRoute} ShadowClawAppRoute
 */

/**
 * @typedef {Object} PrerenderPrettyPathsOptions
 *
 * @property {string} [publicDir]
 * @property {string} [routesPath]
 * @property {string} [sourcePath]
 * @property {string} [indexPath]
 * @property {string|number} [prerenderPages]
 */

/**
 * @typedef {Object} PrerenderPrettyPathsResult
 *
 * @property {number} count
 * @property {string[]} [generatedPaths]
 * @property {boolean} skipped
 * @property {string} [reason]
 */

/**
 * Injects or updates the static routing JSON script block into the HTML head.
 *
 * @param {string} html
 * @param {string} routingJson
 *
 * @returns {string}
 */
export function injectStaticRoutingScript(html, routingJson) {
  const safeRoutingJson = escapeJsonForHtmlScript(routingJson);
  const scriptTag = `<script id="shadow-claw-static-routing" type="application/json">${safeRoutingJson}</script>`;
  if (/id="shadow-claw-static-routing"/iu.test(html)) {
    return html.replace(
      /<script\s+id="shadow-claw-static-routing"[\s\S]*?<\/script>/iu,
      () => scriptTag,
    );
  }

  if (html.includes("</head>")) {
    return html.replace("</head>", () => `  ${scriptTag}\n</head>`);
  }

  return `${scriptTag}\n${html}`;
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function extractDisplayPathFromRouteKey(routeKey) {
  let clean = trimSlashes(routeKey);
  if (clean.startsWith("pages/main/")) {
    return clean.slice("pages/main/".length);
  }

  if (clean.startsWith("pages/br:main/")) {
    return clean.slice("pages/br:main/".length);
  }

  if (clean.startsWith("pages/br-main/")) {
    return clean.slice("pages/br-main/".length);
  }

  if (clean.startsWith("main/")) {
    return clean.slice("main/".length);
  }

  if (clean.startsWith("pages/")) {
    const parts = clean.split("/");
    if (parts.length >= 3) {
      return parts.slice(2).join("/");
    }
  }
  return clean;
}

/**
 * Pre-renders individual static HTML files for all pretty paths configured in routes.json.
 *
 * @param {PrerenderPrettyPathsOptions} [options]
 *
 * @returns {Promise<PrerenderPrettyPathsResult>}
 */
export async function prerenderPrettyPaths(options = {}) {
  const publicDir = path.resolve(options.publicDir || "dist/public");
  const routesPath = path.resolve(options.routesPath || "pages/routes.json");
  const sourcePath = path.resolve(options.sourcePath || "pages/main");
  const indexPath = path.resolve(
    options.indexPath || path.join(publicDir, "index.html"),
  );

  const rawPagesOpt =
    options.prerenderPages !== undefined
      ? options.prerenderPages
      : (process.env.PRERENDER_PAGES ?? 1);
  const prerenderPages = normalizePrerenderPagesOption(rawPagesOpt);

  let routesJsonContent;
  try {
    routesJsonContent = await readFile(routesPath, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") {
      return { count: 0, skipped: true, reason: "No routes.json found" };
    }
    throw err;
  }

  let routesData;
  try {
    routesData = JSON.parse(routesJsonContent);
  } catch (err) {
    console.warn(`Failed to parse ${routesPath}:`, err);
    return { count: 0, skipped: true, reason: "Invalid JSON in routes.json" };
  }

  if (!routesData || typeof routesData !== "object" || !routesData.routes) {
    return {
      count: 0,
      skipped: true,
      reason: "No routes object in routes.json",
    };
  }

  const routeEntries = Object.entries(routesData.routes);
  if (routeEntries.length === 0) {
    return { count: 0, skipped: true, reason: "Empty routes table" };
  }

  const staticRoutingJson = JSON.stringify(routesData, null, 2);
  const staticRoutingPath = path.join(publicDir, "static-routing.json");
  await mkdir(publicDir, { recursive: true });
  await writeFile(staticRoutingPath, staticRoutingJson, "utf8");

  // Read base templates
  const shadowClawTemplatePath = path.join(
    publicDir,
    "components/shadow-claw/shadow-claw.html",
  );

  const pagesTemplatePath = path.join(
    publicDir,
    "components/shadow-claw-pages/shadow-claw-pages.html",
  );

  const pageHeaderTemplatePath = path.join(
    publicDir,
    "components/shadow-claw-page-header/shadow-claw-page-header.html",
  );

  const [
    indexHtml,
    shadowClawTemplateSource,
    pagesTemplateSource,
    pageHeaderTemplateSource,
    rawPageSources,
  ] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(shadowClawTemplatePath, "utf8"),
    readFile(pagesTemplatePath, "utf8"),
    readFile(pageHeaderTemplatePath, "utf8"),
    collectPageSources(sourcePath),
  ]);

  // Load all page contents
  const pageSourcesWithContent = await Promise.all(
    rawPageSources.map(async (page) => {
      const content =
        typeof page.inlineContent === "string"
          ? page.inlineContent
          : await readFile(page.absolutePath, "utf8");
      return { ...page, content };
    }),
  );

  // Update root index.html with static routing script
  const updatedRootHtml = injectStaticRoutingScript(
    indexHtml,
    staticRoutingJson,
  );

  await writeFile(indexPath, updatedRootHtml, "utf8");

  const shadowClawTemplateContent = extractTemplateContent(
    shadowClawTemplateSource,
  );

  const pagesTemplateContent = extractTemplateContent(pagesTemplateSource);
  const pageHeaderTemplateContent = extractTemplateContent(
    pageHeaderTemplateSource,
  );

  // Manifest of all pages for static-main-manifest.json
  const allManifestPages = pageSourcesWithContent.map((page) => ({
    displayPath: page.displayPath,
    content: page.content,
  }));

  const fullManifestPath = path.join(publicDir, "static-main-manifest.json");
  await writeFile(
    fullManifestPath,
    JSON.stringify({ pages: allManifestPages }, null, 2),
    "utf8",
  );

  // Ensure static-main directory is populated
  try {
    const sourceStats = await stat(sourcePath);
    if (sourceStats.isDirectory()) {
      const targetDir = path.join(publicDir, "static-main");
      await mkdir(targetDir, { recursive: true });
      await cp(sourcePath, targetDir, { recursive: true });
    }
  } catch {}

  const generatedPaths = [];

  for (const [routeKey, routeDef] of routeEntries) {
    if (!routeDef || !routeDef.prettyPath) {
      continue;
    }

    const expectedDisplayPath = extractDisplayPathFromRouteKey(routeKey);
    let matchedPage = pageSourcesWithContent.find(
      (p) => p.displayPath === expectedDisplayPath,
    );

    if (!matchedPage) {
      // Try to load direct file if not in collected page sources
      try {
        const directPath = path.join(sourcePath, expectedDisplayPath);
        const content = await readFile(directPath, "utf8");
        matchedPage = {
          absolutePath: directPath,
          displayPath: expectedDisplayPath,
          content,
        };
      } catch {
        console.warn(
          `Could not find page file for route: ${routeKey} (${expectedDisplayPath})`,
        );
        continue;
      }
    }

    const otherPages = pageSourcesWithContent.filter(
      (p) => p.displayPath !== matchedPage.displayPath,
    );

    let dsdPages = [];
    let embeddedManifestPages = [];

    if (prerenderPages === "all") {
      dsdPages = [matchedPage, ...otherPages];
      embeddedManifestPages = dsdPages.map((p) => ({
        displayPath: p.displayPath,
        content: p.content,
      }));
    } else if (typeof prerenderPages === "number") {
      if (prerenderPages === 0) {
        dsdPages = [];
        embeddedManifestPages = [];
      } else {
        dsdPages = [matchedPage, ...otherPages.slice(0, prerenderPages - 1)];
        embeddedManifestPages = dsdPages.map((p) => ({
          displayPath: p.displayPath,
          content: p.content,
        }));
      }
    }

    const parsed = splitFrontmatterWithGrayMatter(matchedPage.content);
    const frontmatterTitle =
      parsed.data && parsed.data.title ? parsed.data.title : "";

    const rendered = await renderPageHtml(
      matchedPage.content,
      matchedPage.absolutePath || matchedPage.displayPath,
    );

    let shadowClawDsdTemplate;
    if (prerenderPages === 0) {
      shadowClawDsdTemplate = buildShadowClawDsdTemplateWithoutPages(
        shadowClawTemplateContent,
      );
    } else {
      const pagesDsdHost = buildPagesDsdHost(
        pagesTemplateContent,
        dsdPages,
        rendered,
        pageHeaderTemplateContent,
        frontmatterTitle,
      );
      shadowClawDsdTemplate = buildShadowClawDsdTemplate(
        shadowClawTemplateContent,
        pagesDsdHost,
      );
    }

    const htmlWithDsd = injectShadowClawTemplate(
      indexHtml,
      shadowClawDsdTemplate,
    );

    const markedHtml = markNoSeedPrerenderHost(htmlWithDsd);
    const embeddedManifestJson = JSON.stringify({
      pages: embeddedManifestPages,
    });
    const htmlWithManifest = injectStaticManifestScript(
      markedHtml,
      embeddedManifestJson,
    );

    const finalHtml = injectStaticRoutingScript(
      htmlWithManifest,
      staticRoutingJson,
    );

    const cleanPrettyPath = trimSlashes(routeDef.prettyPath);
    let targetRelativePath;
    if (cleanPrettyPath.endsWith(".html")) {
      targetRelativePath = cleanPrettyPath;
    } else {
      targetRelativePath = path.join(cleanPrettyPath, "index.html");
    }

    const targetFilePath = path.join(publicDir, targetRelativePath);
    await mkdir(path.dirname(targetFilePath), { recursive: true });
    await writeFile(targetFilePath, finalHtml, "utf8");

    generatedPaths.push(targetRelativePath.replace(/\\/g, "/"));
  }

  console.log(
    `Prerendered ${generatedPaths.length} pretty path page${generatedPaths.length === 1 ? "" : "s"} from ${routesPath} (prerender-pages: ${prerenderPages}).`,
  );

  return {
    count: generatedPaths.length,
    generatedPaths,
    skipped: false,
  };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));

  let prerenderPages;
  for (const flag of flags) {
    if (flag.startsWith("--prerender-pages=")) {
      prerenderPages = flag.slice("--prerender-pages=".length);
    } else if (flag.startsWith("--pages=")) {
      prerenderPages = flag.slice("--pages=".length);
    }
  }

  const publicDir = args[0] || "dist/public";
  const routesPath = args[1] || "pages/routes.json";
  const sourcePath = args[2] || "pages/main";
  const indexPath = args[3] || path.join(publicDir, "index.html");

  await prerenderPrettyPaths({
    publicDir,
    routesPath,
    sourcePath,
    indexPath,
    prerenderPages,
  });
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
