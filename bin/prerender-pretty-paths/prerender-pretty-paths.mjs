#!/usr/bin/env node

import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPagesDsdHost,
  buildShadowClawDsdTemplate,
  buildShadowClawDsdTemplateWithoutPages,
  collectPageSources,
  extractTemplateContent,
  injectShadowClawTemplate,
  injectStaticManifestScript,
  inlineCriticalAssets,
  isPageFile,
  markNoSeedPrerenderHost,
  minifyDsdTemplateHtml,
  normalizePrerenderPagesOption,
  renderPageHtml,
  sortPagePaths,
  splitFrontmatterWithGrayMatter,
} from "../prerender-dsd-shell/prerender-dsd-shell.mjs";
import { extractDisplayPathFromRouteKey } from "./utils/extract-display-path-from-route-key.mjs";
import { injectStaticRoutingScript } from "./utils/inject-static-routing-script.mjs";
import { insertBeforeClosingHead } from "./utils/insert-before-closing-head.mjs";
import { trimSlashes } from "./utils/trim-slashes.mjs";

export { injectStaticRoutingScript };
export { insertBeforeClosingHead };

/**
 * @typedef {import("../../src/storage/staticRouting.js").StaticRoutesManifest} StaticRoutesManifest
 * @typedef {import("../../src/storage/staticRouting.js").StaticRouteDefinition} StaticRouteDefinition
 * @typedef {import("../../src/core/app-routes.js").ShadowClawAppRoute} ShadowClawAppRoute
 */

/**
 * @typedef {Object} PrerenderPrettyPathsOptions
 *
 * @property {string} [publicDir]
 * @property {string} [routesPath]
 * @property {string} [sourcePath]
 * @property {string} [indexPath]
 * @property {string|number} [prerenderPages]
 * @property {boolean} [silent]
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

  if (!routesData || typeof routesData !== "object") {
    return {
      count: 0,
      skipped: true,
      reason: "Invalid routes.json",
    };
  }

  if (!routesData.routes) {
    routesData.routes = {};
  }

  const allRoutes = { ...(routesData.routes || {}) };
  const seenPaths = new Set();

  async function resolveSubRoutes(manifest, currentPath) {
    if (!manifest.subRoutes) return;
    const subList = Array.isArray(manifest.subRoutes)
      ? manifest.subRoutes
      : Object.values(manifest.subRoutes);

    for (const sub of subList) {
      let subPath = path.resolve(path.dirname(currentPath), sub);
      if (sub.startsWith("pages/")) {
        subPath = path.resolve(sub);
      }
      if (seenPaths.has(subPath)) continue;
      seenPaths.add(subPath);
      try {
        const content = await readFile(subPath, "utf8");
        const parsed = JSON.parse(content);
        if (parsed.routes) {
          Object.assign(allRoutes, parsed.routes);
        }
        await resolveSubRoutes(parsed, subPath);
      } catch (err) {
        console.warn(`Failed to read subRoute: ${subPath}`, err.message);
      }
    }
  }

  await resolveSubRoutes(routesData, routesPath);

  Object.assign(routesData.routes, allRoutes);
  const isLegacyArraySubRoutes = Array.isArray(routesData.subRoutes);
  if (isLegacyArraySubRoutes) {
    delete routesData.subRoutes;
  }

  const routeEntries = Object.entries(allRoutes);
  if (routeEntries.length === 0) {
    return { count: 0, skipped: true, reason: "Empty routes table" };
  }

  const staticRoutingJson = JSON.stringify(routesData, null, 2);
  const staticRoutingPath = path.join(publicDir, "static-routing.json");
  await mkdir(publicDir, { recursive: true });
  await writeFile(staticRoutingPath, staticRoutingJson, "utf8");

  const embeddedRoutingJson = JSON.stringify(routesData);

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

  const shadowClawCssPath = path.join(
    publicDir,
    "components/shadow-claw/shadow-claw.css",
  );
  const pagesCssPath = path.join(
    publicDir,
    "components/shadow-claw-pages/shadow-claw-pages.css",
  );
  const pageHeaderCssPath = path.join(
    publicDir,
    "components/shadow-claw-page-header/shadow-claw-page-header.css",
  );

  const [
    indexHtml,
    shadowClawTemplateSource,
    pagesTemplateSource,
    pageHeaderTemplateSource,
    rawPageSources,
    shadowClawCssSource,
    pagesCssSource,
    pageHeaderCssSource,
  ] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(shadowClawTemplatePath, "utf8"),
    readFile(pagesTemplatePath, "utf8").catch(() => ""),
    readFile(pageHeaderTemplatePath, "utf8").catch(() => ""),
    collectPageSources(sourcePath),
    readFile(shadowClawCssPath, "utf8").catch(() => ""),
    readFile(pagesCssPath, "utf8").catch(() => ""),
    readFile(pageHeaderCssPath, "utf8").catch(() => ""),
  ]);

  // Load all page contents
  const rawPageSourcesWithContent = await Promise.all(
    rawPageSources.map(async (page) => {
      const content =
        typeof page.inlineContent === "string"
          ? page.inlineContent
          : await readFile(page.absolutePath, "utf8");
      return { ...page, content };
    }),
  );

  const pageSourcesWithContent = rawPageSourcesWithContent.filter((page) => {
    return !(
      page.displayPath.endsWith(".md") &&
      /^---\r?\n[\s\S]*?slug:\s*"shadow-claw--purge-pages"[\s\S]*?---/mu.test(
        page.content,
      )
    );
  });

  // Update root index.html with static routing script
  const rootHtmlMinified = minifyDsdTemplateHtml(
    injectStaticRoutingScript(indexHtml, embeddedRoutingJson),
  );
  const updatedRootHtml = await inlineCriticalAssets(
    rootHtmlMinified,
    publicDir,
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
  let existingManifest = {};
  try {
    existingManifest = JSON.parse(await readFile(fullManifestPath, "utf8"));
  } catch {}

  const fullManifest = {
    pages: allManifestPages,
    ...(Array.isArray(existingManifest.skills)
      ? { skills: existingManifest.skills }
      : {}),
    ...(Array.isArray(existingManifest.tools)
      ? { tools: existingManifest.tools }
      : {}),
    ...(existingManifest.skillsPurgeId
      ? { skillsPurgeId: existingManifest.skillsPurgeId }
      : {}),
    ...(existingManifest.preRenderedStaticPages
      ? { preRenderedStaticPages: existingManifest.preRenderedStaticPages }
      : {}),
    ...(existingManifest.purgeId ? { purgeId: existingManifest.purgeId } : {}),
  };

  await writeFile(
    fullManifestPath,
    JSON.stringify(fullManifest, null, 2),
    "utf8",
  );

  // Ensure static-main and files/main directories are populated
  try {
    const sourceStats = await stat(sourcePath);
    if (sourceStats.isDirectory()) {
      const targetDir = path.join(publicDir, "static-main");
      await mkdir(targetDir, { recursive: true });
      await cp(sourcePath, targetDir, { recursive: true });

      const filesTargetDir = path.join(publicDir, "files/main");
      await mkdir(filesTargetDir, { recursive: true });
      await cp(sourcePath, filesTargetDir, { recursive: true });
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
      matchedPage.displayPath,
    );

    let shadowClawDsdTemplate;
    if (prerenderPages === 0) {
      shadowClawDsdTemplate = buildShadowClawDsdTemplateWithoutPages(
        shadowClawTemplateContent,
        shadowClawCssSource,
      );
    } else {
      const pagesDsdHost = buildPagesDsdHost(
        pagesTemplateContent,
        dsdPages,
        rendered,
        pageHeaderTemplateContent,
        frontmatterTitle,
        pagesCssSource,
        pageHeaderCssSource,
      );
      shadowClawDsdTemplate = buildShadowClawDsdTemplate(
        shadowClawTemplateContent,
        pagesDsdHost,
        shadowClawCssSource,
      );
    }

    const htmlWithDsd = injectShadowClawTemplate(
      indexHtml,
      shadowClawDsdTemplate,
    );

    const markedHtml = markNoSeedPrerenderHost(htmlWithDsd);
    const embeddedManifestJson = JSON.stringify({
      pages: embeddedManifestPages,
      ...(Array.isArray(existingManifest.skills)
        ? { skills: existingManifest.skills }
        : {}),
      ...(Array.isArray(existingManifest.tools)
        ? { tools: existingManifest.tools }
        : {}),
      ...(existingManifest.skillsPurgeId
        ? { skillsPurgeId: existingManifest.skillsPurgeId }
        : {}),
      ...(existingManifest.preRenderedStaticPages
        ? { preRenderedStaticPages: existingManifest.preRenderedStaticPages }
        : {}),
      ...(existingManifest.purgeId
        ? { purgeId: existingManifest.purgeId }
        : {}),
    });
    const htmlWithManifest = injectStaticManifestScript(
      markedHtml,
      embeddedManifestJson,
    );

    const minifiedHtml = minifyDsdTemplateHtml(
      injectStaticRoutingScript(htmlWithManifest, embeddedRoutingJson),
    );
    const finalHtml = await inlineCriticalAssets(minifiedHtml, publicDir);

    const cleanPrettyPath = trimSlashes(routeDef.prettyPath);
    let targetRelativePath;
    if (cleanPrettyPath.endsWith(".html")) {
      targetRelativePath = cleanPrettyPath;
    } else {
      targetRelativePath = path.join(cleanPrettyPath, "index.html");
    }

    const targetFilePath = path.join(publicDir, targetRelativePath);
    const targetDir = path.dirname(targetFilePath);
    await mkdir(targetDir, { recursive: true });
    await writeFile(targetFilePath, finalHtml, "utf8");

    if (matchedPage && matchedPage.absolutePath) {
      try {
        const pageDir = path.dirname(matchedPage.absolutePath);
        const dirEntries = await readdir(pageDir, { withFileTypes: true });
        for (const entry of dirEntries) {
          if (
            entry.isFile() &&
            !isPageFile(entry.name) &&
            entry.name !== "routes.json"
          ) {
            await cp(
              path.join(pageDir, entry.name),
              path.join(targetDir, entry.name),
            );
          }
        }
      } catch (err) {
        console.warn(`Failed to copy co-located assets for ${routeKey}:`, err);
      }
    }

    generatedPaths.push(targetRelativePath.replace(/\\/g, "/"));
  }

  const isSilent = options.silent ?? process.env.NODE_ENV === "test";
  if (!isSilent) {
    console.log(
      `Prerendered ${generatedPaths.length} pretty path page${generatedPaths.length === 1 ? "" : "s"} from ${routesPath} (prerender-pages: ${prerenderPages}).`,
    );
  }

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
