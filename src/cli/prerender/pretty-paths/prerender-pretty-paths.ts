import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
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
  splitFrontmatterWithGrayMatter,
  type PageSource,
} from "../dsd-shell/prerender-dsd-shell.js";
import { extractDisplayPathFromRouteKey } from "../utils/extract-display-path-from-route-key.js";
import { injectStaticRoutingScript } from "../utils/inject-static-routing-script.js";
import { insertBeforeClosingHead } from "../utils/insert-before-closing-head.js";
import { trimSlashes } from "../../../utils/normalize-workspace-path.js";
import { isPagePathAllowed } from "../../../utils/is-page-path-allowed.js";
import { resolvePageScriptDependencies } from "../../../utils/resolve-page-script-dependencies.js";
import { buildCustomElementScriptTags } from "../../site-config/custom-elements/build-custom-element-script-tags.js";
import {
  extractMarkdownDescription,
  formatSeoTitle,
  patchHtmlHeadMetadata,
  resolveCanonicalUrl,
} from "../../../utils/seo.js";
import { resolveThemeStylesheetHref } from "../../../ui/iframe-theme.js";
import { patchBaseHref, resolveSiteBasePath } from "../../site-config/apply.js";

export { injectStaticRoutingScript };
export { insertBeforeClosingHead };

function extractFirstMarkdownHeading(content: string): string {
  const clean = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/mu, "");
  const match = clean.match(/^#+\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

export interface PrerenderPrettyPathsOptions {
  publicDir?: string;
  routesPath?: string;
  sourcePath?: string;
  indexPath?: string;
  prerenderPages?: string | number;
  silent?: boolean;
  siteConfigPath?: string;
  siteConfig?: any;
  basePath?: string;
  pagesOrigin?: string;
  isProduction?: boolean;
  singleFile?: boolean;
}

export interface PrerenderPrettyPathsResult {
  count: number;
  generatedPaths?: string[];
  skipped: boolean;
  reason?: string;
}

/**
 * Pre-renders individual static HTML files for all pretty paths configured in routes.json.
 */
export async function prerenderPrettyPaths(
  options: PrerenderPrettyPathsOptions = {},
): Promise<PrerenderPrettyPathsResult> {
  const publicDir = path.resolve(options.publicDir || "dist/public");
  const routesPath = path.resolve(options.routesPath || "pages/routes.json");
  const sourcePath = path.resolve(options.sourcePath || "pages/main");
  const indexPath = path.resolve(
    options.indexPath || path.join(publicDir, "index.html"),
  );

  let siteConfig: any = options.siteConfig || {};
  let hasExplicitOrLocalSiteConfig = Boolean(options.siteConfig);
  if (!options.siteConfig) {
    const configCandidatePaths = [
      options.siteConfigPath,
      path.resolve(path.dirname(sourcePath), "shadow-claw.config.json"),
      path.resolve(path.dirname(sourcePath), "site-config.json"),
      path.resolve("shadow-claw.config.json"),
      path.resolve("site-config.json"),
      path.join(publicDir, "shadow-claw.config.json"),
      path.join(publicDir, "site-config.json"),
    ].filter(Boolean) as string[];

    for (const candidate of configCandidatePaths) {
      try {
        const raw = await readFile(candidate, "utf8");
        siteConfig = JSON.parse(raw);
        if (
          options.siteConfigPath ||
          candidate.startsWith(path.dirname(sourcePath)) ||
          candidate.startsWith(publicDir) ||
          publicDir.startsWith(process.cwd())
        ) {
          hasExplicitOrLocalSiteConfig = true;
        }
        break;
      } catch {}
    }
  }

  const rawPagesOpt =
    options.prerenderPages !== undefined
      ? options.prerenderPages
      : (process.env.PRERENDER_PAGES ?? 1);
  const prerenderPages = normalizePrerenderPagesOption(rawPagesOpt);

  let routesJsonContent: string;
  try {
    routesJsonContent = await readFile(routesPath, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return { count: 0, skipped: true, reason: "No routes.json found" };
    }
    throw err;
  }

  let routesData: any;
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

  const allRoutes: Record<string, any> = { ...(routesData.routes || {}) };
  const seenPaths = new Set<string>();

  async function resolveSubRoutes(
    manifest: any,
    currentPath: string,
  ): Promise<void> {
    if (!manifest.subRoutes) return;
    const subList = Array.isArray(manifest.subRoutes)
      ? manifest.subRoutes
      : Object.values(manifest.subRoutes);

    for (const sub of subList) {
      let subPath = path.resolve(path.dirname(currentPath), sub as string);
      if (typeof sub === "string" && sub.startsWith("pages/")) {
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
      } catch (err: any) {
        console.warn(`Failed to read subRoute: ${subPath}`, err?.message);
      }
    }
  }

  await resolveSubRoutes(routesData, routesPath);

  Object.assign(routesData.routes, allRoutes);
  const isLegacyArraySubRoutes = Array.isArray(routesData.subRoutes);
  if (isLegacyArraySubRoutes) {
    delete routesData.subRoutes;
  }

  const filterOptions = {
    allowList:
      siteConfig?.pages?.allowList ??
      siteConfig?.pages?.allowlist ??
      siteConfig?.allowList ??
      siteConfig?.allowlist,
    denyList:
      siteConfig?.pages?.denyList ??
      siteConfig?.pages?.denylist ??
      siteConfig?.denyList ??
      siteConfig?.denylist,
  };

  for (const [routeKey, routeDef] of Object.entries(allRoutes)) {
    const expectedDisplayPath = extractDisplayPathFromRouteKey(routeKey);
    const isAllowed =
      isPagePathAllowed(expectedDisplayPath, {
        ...filterOptions,
        basePathPrefix: sourcePath,
      }) &&
      isPagePathAllowed(routeKey, filterOptions) &&
      (!routeDef?.prettyPath ||
        isPagePathAllowed(routeDef.prettyPath, filterOptions));

    if (!isAllowed) {
      delete allRoutes[routeKey];
      delete routesData.routes[routeKey];
    }
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
    rawIndexHtml,
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
    collectPageSources(sourcePath, "desc", {
      allowList:
        siteConfig?.pages?.allowList ??
        siteConfig?.pages?.allowlist ??
        siteConfig?.allowList ??
        siteConfig?.allowlist,
      denyList:
        siteConfig?.pages?.denyList ??
        siteConfig?.pages?.denylist ??
        siteConfig?.denyList ??
        siteConfig?.denylist,
    }),
    readFile(shadowClawCssPath, "utf8").catch(() => ""),
    readFile(pagesCssPath, "utf8").catch(() => ""),
    readFile(pageHeaderCssPath, "utf8").catch(() => ""),
  ]);

  const isProd = options.isProduction ?? process.env.NODE_ENV === "production";
  const singleFile = options.singleFile ?? false;
  const effectiveBasePathOpt =
    options.basePath !== undefined
      ? options.basePath
      : process.env.PAGES_BASE_PATH || "";
  const effectivePagesOriginOpt =
    options.pagesOrigin || process.env.PAGES_ORIGIN || "";
  const effectiveSiteUrl =
    hasExplicitOrLocalSiteConfig && (isProd || options.basePath === undefined)
      ? siteConfig?.branding?.siteUrl
      : undefined;
  const existingBaseMatch = rawIndexHtml.match(/<base\s+href="([^"]*)"/i);
  const existingBaseHref = existingBaseMatch ? existingBaseMatch[1] : "/";
  const resolvedCandidateBase =
    effectiveBasePathOpt || effectivePagesOriginOpt || effectiveSiteUrl
      ? resolveSiteBasePath({
          basePath: effectiveBasePathOpt,
          pagesOrigin: effectivePagesOriginOpt,
          siteUrl: effectiveSiteUrl,
          defaultBasePath: existingBaseHref,
        })
      : existingBaseHref;
  const finalBaseHref =
    effectiveBasePathOpt !== ""
      ? effectiveBasePathOpt
      : resolvedCandidateBase !== "/"
        ? resolvedCandidateBase
        : existingBaseHref;
  const indexHtml = existingBaseMatch
    ? patchBaseHref(rawIndexHtml, finalBaseHref)
    : rawIndexHtml;

  // Load all page contents
  const rawPageSourcesWithContent = await Promise.all(
    rawPageSources.map(async (page) => {
      const content =
        typeof page.inlineContent === "string"
          ? page.inlineContent
          : await readFile(page.absolutePath!, "utf8");
      return { ...page, content };
    }),
  );

  const pageSourcesWithContent = rawPageSourcesWithContent.filter((page) => {
    return !(
      page.displayPath.endsWith(".md") &&
      /^---\r?\n[\s\S]*?slug:\s*"shadow-claw--purge-pages"[\s\S]*?---/mu.test(
        page.content || "",
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
    { isProduction: isProd, singleFile },
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
  let existingManifest: Record<string, any> = {};
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

  const generatedPaths: string[] = [];
  let processedRouteCount = 0;

  for (const [routeKey, routeDef] of routeEntries) {
    if (!routeDef || !routeDef.prettyPath) {
      continue;
    }

    const cleanPretty = trimSlashes(routeDef.prettyPath);
    if (
      cleanPretty === "feed" ||
      cleanPretty.startsWith("feed/") ||
      routeKey.endsWith(".xml")
    ) {
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
      (p) => p.displayPath !== matchedPage!.displayPath,
    );

    let dsdPages: PageSource[] = [];
    let embeddedManifestPages: { displayPath: string; content?: string }[] = [];

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

    const parsed = splitFrontmatterWithGrayMatter(matchedPage.content || "");
    const frontmatterTitle =
      parsed.data && parsed.data.title ? parsed.data.title : "";

    const approvedScripts = (siteConfig?.customElements?.scripts || [])
      .map((s: any) => (typeof s === "string" ? s : s?.src))
      .filter(Boolean);

    const rendered = await renderPageHtml(
      matchedPage.content || "",
      matchedPage.displayPath,
      { approvedScripts },
    );

    const themeStylesheet = siteConfig?.theme?.stylesheet;
    let normalizedThemeHref = "";
    if (typeof themeStylesheet === "string" && themeStylesheet.trim()) {
      const resolved = resolveThemeStylesheetHref(themeStylesheet.trim());
      normalizedThemeHref =
        resolved.startsWith("http://") ||
        resolved.startsWith("https://") ||
        resolved.startsWith("//")
          ? resolved
          : resolved.replace(/^\/+/, "");
    }

    let shadowClawDsdTemplate: string;
    if (prerenderPages === 0) {
      shadowClawDsdTemplate = buildShadowClawDsdTemplateWithoutPages(
        shadowClawTemplateContent,
        shadowClawCssSource,
        siteConfig.sidebar,
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
        normalizedThemeHref,
      );
      shadowClawDsdTemplate = buildShadowClawDsdTemplate(
        shadowClawTemplateContent,
        pagesDsdHost,
        shadowClawCssSource,
        siteConfig.sidebar,
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

    const cleanPrettyPath = trimSlashes(routeDef.prettyPath);
    const isHome =
      cleanPrettyPath === "" ||
      cleanPrettyPath === "index.html" ||
      routeDef.prettyPath === "/";

    const baseHrefMatch = indexHtml.match(/<base\s+href="([^"]*)"/i);
    const basePath = baseHrefMatch ? baseHrefMatch[1] : undefined;
    const origin = siteConfig?.branding?.siteUrl || undefined;

    const resolvedPageTitle =
      routeDef.title ||
      parsed.data?.seo_title ||
      parsed.data?.seoTitle ||
      parsed.data?.title ||
      extractFirstMarkdownHeading(matchedPage.content || "");

    const formattedTitle = formatSeoTitle({
      pageTitle: resolvedPageTitle,
      siteTitle: siteConfig?.site?.title || "ShadowClaw",
      siteDescription: siteConfig?.site?.description,
      separator: siteConfig?.site?.titleSeparator ?? siteConfig?.site?.sep,
      titleTemplate: siteConfig?.site?.titleTemplate,
      isHome,
    });

    const pageDescription =
      routeDef.description ||
      parsed.data?.seo_description ||
      parsed.data?.seoDescription ||
      parsed.data?.description ||
      parsed.data?.excerpt ||
      parsed.data?.summary ||
      extractMarkdownDescription(matchedPage.content || "", {
        fallback: siteConfig?.site?.description,
      }) ||
      siteConfig?.site?.description;

    const canonicalUrl = resolveCanonicalUrl({
      origin,
      basePath,
      prettyPath: routeDef.prettyPath,
    });

    const htmlWithSeo = patchHtmlHeadMetadata(htmlWithManifest, {
      title: formattedTitle,
      description: pageDescription,
      canonicalUrl,
      siteTitle: siteConfig?.site?.title || "ShadowClaw",
      type: isHome ? "website" : "article",
    });

    const rawScripts = siteConfig?.customElements?.scripts || [];
    const resolvedScripts = resolvePageScriptDependencies(
      rawScripts,
      parsed.data,
      matchedPage.content,
    );

    let htmlWithScripts = htmlWithSeo;
    if (resolvedScripts.length > 0) {
      const headMatch = htmlWithScripts.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      const headContent = headMatch ? headMatch[1] : "";
      const scriptsToInject = resolvedScripts.filter(
        (s) =>
          !headContent.includes(`src="${s.src}"`) &&
          !headContent.includes(`src='${s.src}'`),
      );
      if (scriptsToInject.length > 0) {
        const scriptTags = buildCustomElementScriptTags(scriptsToInject);
        htmlWithScripts = insertBeforeClosingHead(
          htmlWithScripts,
          `  ${scriptTags.trim()}`,
        );
      }
    }

    const minifiedHtml = minifyDsdTemplateHtml(
      injectStaticRoutingScript(htmlWithScripts, embeddedRoutingJson),
    );
    const finalHtml = await inlineCriticalAssets(minifiedHtml, publicDir, {
      isProduction: isProd,
      singleFile,
    });

    let targetRelativePath: string;
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

    if (!cleanPrettyPath.endsWith(".html") && cleanPrettyPath.length > 0) {
      const flatRelativePath = `${cleanPrettyPath}.html`;
      const flatFilePath = path.join(publicDir, flatRelativePath);
      await mkdir(path.dirname(flatFilePath), { recursive: true });
      await writeFile(flatFilePath, finalHtml, "utf8");
      generatedPaths.push(flatRelativePath.replace(/\\/g, "/"));
    }

    processedRouteCount++;
  }

  const isSilent = options.silent ?? process.env.NODE_ENV === "test";
  if (!isSilent) {
    console.log(
      `Prerendered ${processedRouteCount} pretty path page${processedRouteCount === 1 ? "" : "s"} from ${routesPath} (prerender-pages: ${prerenderPages}).`,
    );
  }

  return {
    count: processedRouteCount,
    generatedPaths,
    skipped: false,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));

  let prerenderPages: string | undefined;
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
