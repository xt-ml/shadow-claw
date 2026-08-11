#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPagesDsdHost,
  buildShadowClawDsdTemplate,
  collectPageSources,
  escapeJsonForHtmlScript,
  extractTemplateContent,
  injectShadowClawTemplate,
  injectStaticManifestScript,
  markNoSeedPrerenderHost,
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

  // Manifest of all pages for static fallback
  const manifestPages = pageSourcesWithContent.map((page) => ({
    displayPath: page.displayPath,
    content: page.content,
  }));

  const manifestJson = JSON.stringify({ pages: manifestPages });

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

    // Reorder page sources so the matched page is first (active)
    const otherPages = pageSourcesWithContent.filter(
      (p) => p.displayPath !== matchedPage.displayPath,
    );

    const orderedPages = [matchedPage, ...otherPages];

    const parsed = splitFrontmatterWithGrayMatter(matchedPage.content);
    const frontmatterTitle =
      parsed.data && parsed.data.title ? parsed.data.title : "";

    const rendered = await renderPageHtml(
      matchedPage.content,
      matchedPage.absolutePath || matchedPage.displayPath,
    );

    const pagesDsdHost = buildPagesDsdHost(
      pagesTemplateContent,
      orderedPages,
      rendered,
      pageHeaderTemplateContent,
      frontmatterTitle,
    );

    const shadowClawDsdTemplate = buildShadowClawDsdTemplate(
      shadowClawTemplateContent,
      pagesDsdHost,
    );

    const htmlWithDsd = injectShadowClawTemplate(
      indexHtml,
      shadowClawDsdTemplate,
    );

    const markedHtml = markNoSeedPrerenderHost(htmlWithDsd);
    const htmlWithManifest = injectStaticManifestScript(
      markedHtml,
      manifestJson,
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
    `Prerendered ${generatedPaths.length} pretty path page${generatedPaths.length === 1 ? "" : "s"} from ${routesPath}.`,
  );

  return {
    count: generatedPaths.length,
    generatedPaths,
    skipped: false,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const publicDir = args[0] || "dist/public";
  const routesPath = args[1] || "pages/routes.json";
  const sourcePath = args[2] || "pages/main";
  const indexPath = args[3] || path.join(publicDir, "index.html");

  await prerenderPrettyPaths({
    publicDir,
    routesPath,
    sourcePath,
    indexPath,
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
