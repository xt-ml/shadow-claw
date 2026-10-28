import { execSync } from "node:child_process";
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { chdir, env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { rimraf } from "rimraf";

import { copyResourceDirEntries } from "./utils/copy-resource-dir-entries.js";
import { copyWithFallback } from "./utils/copy-with-fallback.js";
import { findFirstExistingPath } from "./utils/find-first-existing-path.js";
import { getPublishCopyPlan } from "./utils/get-publish-copy-plan.js";
import { getRoutesCandidates } from "./utils/get-routes-candidates.js";
import { getSiteConfigCandidates } from "./utils/get-site-config-candidates.js";
import { resolveBuildFlags } from "./utils/resolve-build-flags.js";
import {
  collectPageSources,
  prerenderDsdShell,
} from "../prerender/dsd-shell/prerender-dsd-shell.js";
import { prerenderPrettyPaths } from "../prerender/pretty-paths/prerender-pretty-paths.js";
import { insertBeforeClosingHead } from "../prerender/utils/insert-before-closing-head.js";
import {
  applySiteConfig,
  patchBaseHref,
  resolveSiteBasePath,
} from "../site-config/apply.js";
import { patchServiceWorkerTrustedTypesFile } from "../tools/patch-service-worker-trusted-types.js";
import { touchNoJekyll } from "../tools/touch-nojekyll.js";

import { getProjectRoot } from "../utils/resolve-project-root.js";

const projectRoot = getProjectRoot(import.meta.url);

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export interface RunBuildOptions {
  quiet?: boolean;
  stdio?: any;
  contentRoot?: string;
  toolchainRoot?: string;
  isProduction?: boolean;
  copyAllAssets?: boolean;
  prerenderPages?: string | number;
  prerenderMainMemory?: boolean | string;
  outDir?: string;
  pagesOrigin?: string;
  basePath?: string;
  singleFile?: boolean;
}

export async function runBuild(options: RunBuildOptions = {}): Promise<void> {
  const isQuiet =
    options.quiet ?? (process.env.NODE_ENV === "test" && !process.env.VERBOSE);
  const defaultStdio =
    options.stdio ??
    (process.env.NODE_ENV === "test" && !process.env.VERBOSE
      ? "pipe"
      : "inherit");

  const log = (...args: any[]) => {
    if (!isQuiet) {
      console.log(...args);
    }
  };

  const contentRoot = resolve(
    options.contentRoot || env.SHADOWCLAW_CONTENT_ROOT || process.cwd(),
  );
  const toolchainRoot = resolve(options.toolchainRoot || projectRoot);
  const isInRepo = contentRoot === toolchainRoot;

  const { isProduction, copyAllAssets, prerenderPages, prerenderMainMemory } =
    resolveBuildFlags({
      ...env,
      ...(options.isProduction !== undefined
        ? { NODE_ENV: options.isProduction ? "production" : "development" }
        : {}),
      ...(options.copyAllAssets !== undefined
        ? { COPY_ALL_ASSETS: String(options.copyAllAssets) }
        : {}),
      ...(options.prerenderPages !== undefined
        ? { PRERENDER_PAGES: String(options.prerenderPages) }
        : {}),
      ...(options.prerenderMainMemory !== undefined
        ? { PRERENDER_MAIN_MEMORY: String(options.prerenderMainMemory) }
        : {}),
    });

  if (isProduction) {
    process.env.NODE_ENV = "production";
  }

  async function run(command: string, runOptions: any = {}): Promise<void> {
    if (!isQuiet && !runOptions.quiet) {
      console.log(`> ${command}`);
    }
    const stdio = runOptions.stdio ?? defaultStdio;
    const runEnv = {
      ...process.env,
      ...(isProduction ? { NODE_ENV: "production" } : {}),
      ...(runOptions.env || {}),
    };
    execSync(command, { stdio, ...runOptions, env: runEnv });
  }

  if (isInRepo) {
    chdir(projectRoot);

    await rimraf("dist/public");
    await mkdir("dist/public/assets", { recursive: true });

    if (copyAllAssets) {
      await cp("assets", "dist/public", { recursive: true });
    } else {
      await cp("assets/icons", "dist/public/assets/icons", { recursive: true });
      await cp("assets/screenshots", "dist/public/assets/screenshots", {
        recursive: true,
      });
      try {
        await cp("assets/fonts", "dist/public/assets/fonts", {
          recursive: true,
        });
      } catch {}
    }

    await copyResourceDirEntries(
      [
        "pages/resources",
        "pages/deps",
        "resources",
        "deps",
        "pages/assets",
        "pages/main/assets",
      ],
      "dist/public",
    );

    for (const plan of getPublishCopyPlan()) {
      await copyWithFallback(plan.sources, plan.dest, plan.opts || {});
    }

    try {
      await cp("e2e/README.md", "dist/public/e2e/README.md");
    } catch {}

    try {
      await cp("pages", "dist/public/pages", { recursive: true });
    } catch {}

    try {
      await cp("pages/main", "dist/public/files/main", { recursive: true });
    } catch {}

    let noTestFilter: ((src: string) => boolean) | undefined;
    try {
      const { isTestFileOrDir } = await import("../commands/skills-index.js");
      noTestFilter = (src: string) => !isTestFileOrDir(basename(src), src);
    } catch {}

    try {
      await cp("pages/main", "dist/public/static-main", { recursive: true });
    } catch {}

    try {
      const { migrateLegacyWorkspaceLayout } =
        await import("../utils/migrate-skills.js");
      await migrateLegacyWorkspaceLayout(process.cwd());
    } catch {}

    try {
      await cp(".agents/skills", "dist/public/.agents/skills", {
        recursive: true,
        ...(noTestFilter ? { filter: noTestFilter } : {}),
      });
    } catch {}

    try {
      await cp(".agents/tools", "dist/public/.agents/tools", {
        recursive: true,
        ...(noTestFilter ? { filter: noTestFilter } : {}),
      });
    } catch {}

    try {
      await cp(".agents/scripts", "dist/public/.agents/scripts", {
        recursive: true,
        ...(noTestFilter ? { filter: noTestFilter } : {}),
      });
    } catch {}

    // Generate / sync Agent Skills Discovery index (.well-known/agent-skills/index.json)
    if (await pathExists(".agents/skills")) {
      try {
        const { generateSkillsIndex } =
          await import("../commands/skills-index.js");
        await generateSkillsIndex(projectRoot);
      } catch (err) {
        console.warn(
          "Notice: Failed to auto-generate agent-skills index:",
          err,
        );
      }
    }

    if (await pathExists(".well-known")) {
      try {
        await cp(".well-known", "dist/public/.well-known", {
          recursive: true,
          force: true,
        });
      } catch {}
    }

    await run("npm run -s rolldown");

    const siteConfigCandidate = await findFirstExistingPath(
      getSiteConfigCandidates(),
    );
    const siteConfigPath = siteConfigCandidate || "pages/site-config.json";

    let inRepoSiteConfig: Record<string, any> | undefined;
    if (siteConfigCandidate) {
      try {
        inRepoSiteConfig = JSON.parse(
          await readFile(siteConfigCandidate, "utf8"),
        ) as Record<string, any>;
      } catch {}
    }

    const pagesOrigin = options.pagesOrigin || env.PAGES_ORIGIN;
    const basePath = isProduction
      ? resolveSiteBasePath({
          basePath: options.basePath || env.PAGES_BASE_PATH,
          pagesOrigin,
          siteUrl: inRepoSiteConfig?.branding?.siteUrl,
          defaultBasePath: "/shadow-claw/",
        })
      : options.basePath || env.PAGES_BASE_PATH || "/";

    if (prerenderMainMemory) {
      await prerenderDsdShell({
        indexPath: "dist/public/index.html",
        sourcePath: "pages/main",
        prerenderPages,
        siteConfigPath,
      });
    } else {
      await prerenderDsdShell({
        indexPath: "dist/public/index.html",
        noSeed: true,
        siteConfigPath,
      });
    }

    try {
      await applySiteConfig("dist/public", siteConfigPath, {
        basePath,
        pagesOrigin,
        isProduction,
      });
    } catch {}

    try {
      const pkgJson = JSON.parse(await readFile("package.json", "utf8"));
      if (pkgJson.version) {
        const idxPath = "dist/public/index.html";
        const idxHtml = await readFile(idxPath, "utf8");
        await writeFile(
          idxPath,
          idxHtml.replace(
            /<meta\s+name="version"[^>]*>/,
            `<meta name="version" content="${pkgJson.version}" />`,
          ),
          "utf8",
        );

        for (const relPath of [
          ".well-known/mcp.json",
          ".well-known/mcp/server-card.json",
        ]) {
          const cardPath = join("dist/public", relPath);
          if (await pathExists(cardPath)) {
            try {
              const card = JSON.parse(await readFile(cardPath, "utf8"));
              if (card.version !== pkgJson.version) {
                card.version = pkgJson.version;
                await writeFile(
                  cardPath,
                  JSON.stringify(card, null, 2) + "\n",
                  "utf8",
                );
              }
            } catch {}
          }
        }
      }
    } catch {}

    try {
      const idxPath = "dist/public/index.html";
      const idxHtml = await readFile(idxPath, "utf8");
      await writeFile(idxPath, patchBaseHref(idxHtml, basePath), "utf8");

      const sharePath = "dist/public/share/share-target.html";
      if (await pathExists(sharePath)) {
        const shareHtml = await readFile(sharePath, "utf8");
        await writeFile(sharePath, patchBaseHref(shareHtml, basePath), "utf8");
      }
    } catch {}

    if (isProduction) {
      log("Running production post-build steps...");

      log(`  PAGES_ORIGIN   : ${pagesOrigin || "(relative ./)"}`);
      log(`  PAGES_BASE_PATH: ${basePath}`);

      if (pagesOrigin) {
        try {
          const manifestPath = "dist/public/manifest.json";
          const manifestStr = await readFile(manifestPath, "utf8");
          const manifestObj = JSON.parse(manifestStr);
          if (manifestObj.start_url) {
            manifestObj.start_url = pagesOrigin;
            await writeFile(
              manifestPath,
              JSON.stringify(manifestObj, null, 2),
              "utf8",
            );
          }
        } catch {}
      }

      await touchNoJekyll("dist/public");

      let meta = "";
      try {
        meta = execSync("npm run -s build:pkg:get:meta", {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {}
      if (meta) {
        await run(`npm run -s build:pkg:meta "${meta}"`);
      }
    }

    const routesCandidate = await findFirstExistingPath(getRoutesCandidates());
    const routesPath = routesCandidate || "pages/routes.json";
    await prerenderPrettyPaths({
      publicDir: "dist/public",
      routesPath,
      sourcePath: "pages/main",
      prerenderPages,
      siteConfigPath,
      basePath,
      pagesOrigin,
    });

    await run("npm run -s build:service-worker");
    const swPath = "dist/public/service-worker.js";
    if (await pathExists(swPath)) {
      await patchServiceWorkerTrustedTypesFile(swPath, { logImpl: () => {} });
    }

    if (isProduction) {
      try {
        const { precompressAssets } =
          await import("../tools/precompress-assets.js");
        const result = await precompressAssets("dist/public", {
          silent: isQuiet,
        });
        if (!isQuiet && result.count > 0) {
          log(`Pre-compressed ${result.count} assets (.br and .gz).`);
        }
      } catch (err) {
        if (!isQuiet) {
          console.warn(
            "Notice: Asset pre-compression encountered an issue:",
            err,
          );
        }
      }
    }

    log("Build completed successfully.");
    return;
  }

  // --- CLI / EXTERNAL CONSUMER MODE ---
  const outDir = options.outDir || "dist/public";
  const distPublicDir = resolve(contentRoot, outDir);

  await rimraf(distPublicDir);
  await mkdir(distPublicDir, { recursive: true });
  await mkdir(join(distPublicDir, "assets"), { recursive: true });

  // 1. Ensure core toolchain bundle is available in toolchainRoot
  const toolchainDist = join(toolchainRoot, "dist/public");
  const toolchainBuilt = await pathExists(join(toolchainDist, "index.js"));
  if (!toolchainBuilt) {
    log("Building ShadowClaw core toolchain...");
    await rimraf(join(toolchainRoot, "dist/public"));
    await rimraf(join(toolchainRoot, "dist-electron"));
    await run("npm run -s rolldown", { cwd: toolchainRoot });
  }

  // Copy base distribution into target
  await cp(toolchainDist, distPublicDir, {
    recursive: true,
    filter: (src) => {
      // Exclude cache
      const isCache =
        src.includes("/assets/cache/") ||
        src.includes("\\assets\\cache\\") ||
        src.includes("/.cache/") ||
        src.includes("\\.cache\\") ||
        src.includes("/cache/") ||
        src.includes("\\cache\\") ||
        src.endsWith("/cache") ||
        src.endsWith("\\cache");
      if (isCache) {
        return false;
      }

      // Do not leak the toolchain's own site-specific docs, pages, or manifests into consumer builds
      if (contentRoot !== toolchainRoot) {
        const rel = relative(toolchainDist, src).replace(/\\/g, "/");
        if (
          rel === "docs" ||
          rel.startsWith("docs/") ||
          rel === "main" ||
          rel.startsWith("main/") ||
          rel === "main.html" ||
          rel.startsWith("main.html.") ||
          rel === "static-main" ||
          rel.startsWith("static-main/") ||
          rel === "static-main-manifest.json" ||
          rel.startsWith("static-main-manifest.json.") ||
          rel === "static-routing.json" ||
          rel.startsWith("static-routing.json.") ||
          rel === "files" ||
          rel.startsWith("files/") ||
          rel === "pages" ||
          rel.startsWith("pages/") ||
          rel === "sitemap.xml" ||
          rel.startsWith("sitemap.xml.") ||
          rel === "sitemap.txt" ||
          rel.startsWith("sitemap.txt.") ||
          rel === "llms.txt" ||
          rel.startsWith("llms.txt.") ||
          rel === "README.md" ||
          rel.startsWith("README.md.") ||
          rel === "AGENTS.md" ||
          rel.startsWith("AGENTS.md.")
        ) {
          return false;
        }
      }

      return true;
    },
  });

  // The toolchain's own sitemap must not leak into another site's build.
  if (contentRoot !== toolchainRoot) {
    await rimraf(join(distPublicDir, "sitemap.xml"));
    await rimraf(join(distPublicDir, "sitemap.txt"));
  }

  // 2. Copy/merge assets from contentRoot
  const contentAssets = join(contentRoot, "assets");
  if (await pathExists(contentAssets)) {
    if (copyAllAssets) {
      await cp(contentAssets, distPublicDir, { recursive: true, force: true });
    } else {
      if (await pathExists(join(contentAssets, "icons"))) {
        await cp(
          join(contentAssets, "icons"),
          join(distPublicDir, "assets/icons"),
          { recursive: true, force: true },
        );
      }
      if (await pathExists(join(contentAssets, "screenshots"))) {
        await cp(
          join(contentAssets, "screenshots"),
          join(distPublicDir, "assets/screenshots"),
          { recursive: true, force: true },
        );
      }
      if (await pathExists(join(contentAssets, "fonts"))) {
        await cp(
          join(contentAssets, "fonts"),
          join(distPublicDir, "assets/fonts"),
          { recursive: true, force: true },
        );
      }
    }
  }

  // 3. Copy resource directory entries from contentRoot
  await copyResourceDirEntries(
    [
      "pages/resources",
      "pages/deps",
      "resources",
      "deps",
      "pages/assets",
      "pages/main/assets",
    ],
    distPublicDir,
    { baseDir: contentRoot },
  );

  // 4. Publish copy plan
  const publishPlan = getPublishCopyPlan({
    contentRoot,
    toolchainRoot,
    distPublicDir,
  });
  for (const plan of publishPlan) {
    await copyWithFallback(plan.sources, plan.dest, plan.opts || {});
  }

  // 5. Copy pages from contentRoot
  const contentPages = join(contentRoot, "pages");
  if (await pathExists(contentPages)) {
    await cp(contentPages, join(distPublicDir, "pages"), {
      recursive: true,
      force: true,
    });
  }

  const contentPagesMain = join(contentRoot, "pages/main");
  if (await pathExists(contentPagesMain)) {
    await cp(contentPagesMain, join(distPublicDir, "files/main"), {
      recursive: true,
      force: true,
    });
    await cp(contentPagesMain, join(distPublicDir, "static-main"), {
      recursive: true,
      force: true,
    });
  }

  // 6. Migrate & Copy .agents from contentRoot and toolchainRoot
  try {
    const { migrateLegacyWorkspaceLayout } =
      await import("../utils/migrate-skills.js");
    if (await pathExists(join(contentRoot, ".agents"))) {
      await migrateLegacyWorkspaceLayout(contentRoot);
    }
    if (
      contentRoot !== toolchainRoot &&
      (await pathExists(join(toolchainRoot, ".agents")))
    ) {
      await migrateLegacyWorkspaceLayout(toolchainRoot);
    }
  } catch {}

  const contentSkills = join(contentRoot, ".agents/skills");
  if (await pathExists(contentSkills)) {
    await cp(contentSkills, join(distPublicDir, ".agents/skills"), {
      recursive: true,
      force: true,
    });
  }

  const toolchainSkills = join(toolchainRoot, ".agents/skills");
  if (contentRoot !== toolchainRoot && (await pathExists(toolchainSkills))) {
    await cp(toolchainSkills, join(distPublicDir, ".agents/skills"), {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  }

  const contentTools = join(contentRoot, ".agents/tools");
  if (await pathExists(contentTools)) {
    await cp(contentTools, join(distPublicDir, ".agents/tools"), {
      recursive: true,
      force: true,
    });
  } else {
    const toolchainTools = join(toolchainRoot, ".agents/tools");
    if (await pathExists(toolchainTools)) {
      await cp(toolchainTools, join(distPublicDir, ".agents/tools"), {
        recursive: true,
        force: true,
      });
    }
  }

  const contentScripts = join(contentRoot, ".agents/scripts");
  if (await pathExists(contentScripts)) {
    await cp(contentScripts, join(distPublicDir, ".agents/scripts"), {
      recursive: true,
      force: true,
    });
  } else {
    const toolchainScripts = join(toolchainRoot, ".agents/scripts");
    if (await pathExists(toolchainScripts)) {
      await cp(toolchainScripts, join(distPublicDir, ".agents/scripts"), {
        recursive: true,
        force: true,
      });
    }
  }

  // 6b. Copy .well-known discovery files & generate/sync Agent Skills index
  const toolchainWellKnown = join(toolchainRoot, ".well-known");
  if (await pathExists(toolchainWellKnown)) {
    await cp(toolchainWellKnown, join(distPublicDir, ".well-known"), {
      recursive: true,
      force: true,
    });
  }

  const contentWellKnown = join(contentRoot, ".well-known");
  if (contentRoot !== toolchainRoot && (await pathExists(contentWellKnown))) {
    await cp(contentWellKnown, join(distPublicDir, ".well-known"), {
      recursive: true,
      force: true,
    });
  }

  const distSkillsDir = join(distPublicDir, ".agents/skills");
  if (await pathExists(distSkillsDir)) {
    try {
      const { generateSkillsIndex } =
        await import("../commands/skills-index.js");
      await generateSkillsIndex(distPublicDir, {
        metadataRoot: contentRoot,
        outDir: ".well-known/agent-skills",
        toolchainRoot,
        includeBundled: true,
      });
      // Also keep contentRoot/.well-known/agent-skills/index.json in sync if contentSkills exists
      if (await pathExists(contentSkills)) {
        try {
          await generateSkillsIndex(contentRoot, {
            toolchainRoot,
            includeBundled: true,
          });
        } catch {}
      }
    } catch (err) {
      console.warn("Notice: Failed to auto-generate agent-skills index:", err);
    }
  }

  // 7. Prerender DSD Shell & 8. Apply site-config
  const siteConfigCandidate = await findFirstExistingPath(
    getSiteConfigCandidates(contentRoot),
  );
  const siteConfigPath =
    siteConfigCandidate || join(contentRoot, "pages/site-config.json");

  // Allow shadow-claw.config.json to opt out of the skeleton overlay at build
  // time via settings.overridePrerenderSkeleton: false. The skeleton overlay is
  // controlled at runtime via the shadow-claw-override-prerender-skeleton meta tag
  // injected by applySiteConfig. Pre-rendering of main memory remains enabled so
  // pre-rendered DSD content is available on first paint.
  let effectivePrerenderMainMemory = prerenderMainMemory;
  let consumerSiteConfig: Record<string, any> | undefined;
  if (siteConfigCandidate) {
    try {
      consumerSiteConfig = JSON.parse(
        await readFile(siteConfigCandidate, "utf8"),
      ) as Record<string, any>;
    } catch {
      // Non-critical: ignore parse errors and keep the default.
    }
  }
  if (options.prerenderMainMemory === undefined && consumerSiteConfig) {
    if (consumerSiteConfig?.settings?.prerenderMainMemory === false) {
      effectivePrerenderMainMemory = false;
      log(
        "  site-config: prerenderMainMemory=false — pages DSD pre-rendering disabled.",
      );
    } else if (
      consumerSiteConfig?.settings?.overridePrerenderSkeleton === false
    ) {
      log(
        "  site-config: overridePrerenderSkeleton=false — skeleton overlay disabled.",
      );
    }
  }

  const indexPath = join(distPublicDir, "index.html");
  if (effectivePrerenderMainMemory && (await pathExists(contentPagesMain))) {
    await prerenderDsdShell({
      indexPath,
      sourcePath: contentPagesMain,
      prerenderPages,
      siteConfigPath,
    });
  } else {
    await prerenderDsdShell({
      indexPath,
      noSeed: true,
      siteConfigPath,
    });
  }

  // 9. Base href normalization & Production post-build
  const pagesOrigin = options.pagesOrigin || env.PAGES_ORIGIN;
  const basePath = isProduction
    ? resolveSiteBasePath({
        basePath: options.basePath || env.PAGES_BASE_PATH,
        pagesOrigin,
        siteUrl: consumerSiteConfig?.branding?.siteUrl,
        defaultBasePath: "/",
      })
    : options.basePath || env.PAGES_BASE_PATH || "/";

  try {
    await applySiteConfig(distPublicDir, siteConfigPath, {
      basePath,
      pagesOrigin,
      isProduction,
    });
  } catch {}

  try {
    let idxHtml = await readFile(indexPath, "utf8");
    idxHtml = patchBaseHref(idxHtml, basePath);

    let pkgVersion = "";
    try {
      const pkgPath = await findFirstExistingPath([
        join(contentRoot, "package.json"),
        join(toolchainRoot, "package.json"),
      ]);
      if (pkgPath) {
        const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
        pkgVersion = pkg.version || "";
      }
    } catch {}

    if (pkgVersion) {
      idxHtml = idxHtml.replace(
        /<meta\s+name="version"[^>]*>/,
        `<meta name="version" content="${pkgVersion}" />`,
      );

      for (const relPath of [
        ".well-known/mcp.json",
        ".well-known/mcp/server-card.json",
      ]) {
        const cardPath = join(distPublicDir, relPath);
        if (await pathExists(cardPath)) {
          try {
            const card = JSON.parse(await readFile(cardPath, "utf8"));
            if (card.version !== pkgVersion) {
              card.version = pkgVersion;
              await writeFile(
                cardPath,
                JSON.stringify(card, null, 2) + "\n",
                "utf8",
              );
            }
          } catch {}
        }
      }
    }
    await writeFile(indexPath, idxHtml, "utf8");

    const sharePath = join(distPublicDir, "share/share-target.html");
    if (await pathExists(sharePath)) {
      const shareHtml = await readFile(sharePath, "utf8");
      await writeFile(sharePath, patchBaseHref(shareHtml, basePath), "utf8");
    }
  } catch {}

  if (isProduction) {
    log("Running production post-build steps...");

    log(`  PAGES_ORIGIN   : ${pagesOrigin || "(relative ./)"}`);
    log(`  PAGES_BASE_PATH: ${basePath}`);

    if (pagesOrigin) {
      try {
        const manifestPath = join(distPublicDir, "manifest.json");
        const manifestStr = await readFile(manifestPath, "utf8");
        const manifestObj = JSON.parse(manifestStr);
        if (manifestObj.start_url) {
          manifestObj.start_url = pagesOrigin;
          await writeFile(
            manifestPath,
            JSON.stringify(manifestObj, null, 2),
            "utf8",
          );
        }
      } catch {}
    }

    await writeFile(join(distPublicDir, ".nojekyll"), "", "utf8");

    let meta = "";
    try {
      meta = execSync("git rev-parse HEAD", {
        cwd: contentRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      try {
        meta = execSync("git rev-parse HEAD", {
          cwd: toolchainRoot,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {}
    }

    if (meta) {
      const idxHtml = await readFile(indexPath, "utf8");
      await writeFile(
        indexPath,
        idxHtml.replace(
          /<meta\s+name="revision"[^>]*>/,
          `<meta name="revision" content="${meta}" />`,
        ),
        "utf8",
      );
    }
  }

  // 10. Prerender pretty paths
  const routesCandidate = await findFirstExistingPath(
    getRoutesCandidates(contentRoot),
  );
  const routesPath = routesCandidate || join(contentRoot, "pages/routes.json");
  const mainSourcePath = (await pathExists(contentPagesMain))
    ? contentPagesMain
    : join(toolchainRoot, "pages/main");
  await prerenderPrettyPaths({
    publicDir: distPublicDir,
    routesPath,
    sourcePath: mainSourcePath,
    prerenderPages,
    siteConfigPath,
    basePath,
    pagesOrigin,
  });

  // 11. Service Worker patch
  const swPath = join(distPublicDir, "service-worker.js");
  if (await pathExists(swPath)) {
    await patchServiceWorkerTrustedTypesFile(swPath, { logImpl: () => {} });
  }

  // 12. Pre-compress assets for production
  if (isProduction) {
    try {
      const { precompressAssets } =
        await import("../tools/precompress-assets.js");
      const result = await precompressAssets(distPublicDir, {
        silent: isQuiet,
      });
      if (!isQuiet && result.count > 0) {
        log(`Pre-compressed ${result.count} assets (.br and .gz).`);
      }
    } catch (err) {
      if (!isQuiet) {
        console.warn(
          "Notice: Asset pre-compression encountered an issue:",
          err,
        );
      }
    }
  }

  // 13. Single-file bundle post-processing
  if (options.singleFile) {
    if (!isQuiet) {
      log("Embedding pages and theme for single-file distribution...");
    }
    const idxPath = join(distPublicDir, "index.html");
    if (await pathExists(idxPath)) {
      let idxHtml = await readFile(idxPath, "utf8");

      // 1. Discover and embed theme CSS
      const themeCssCandidate = await findFirstExistingPath([
        join(mainSourcePath, "theme.css"),
        join(contentRoot, "pages/main/theme.css"),
        join(contentRoot, "pages/theme.css"),
        join(contentRoot, "theme.css"),
      ]);
      if (themeCssCandidate) {
        try {
          const themeCss = await readFile(themeCssCandidate, "utf8");
          if (themeCss.trim() && !idxHtml.includes('id="shadow-claw-theme"')) {
            const styleTag = `<style id="shadow-claw-theme">\n${themeCss.trim()}\n</style>`;
            idxHtml = insertBeforeClosingHead(idxHtml, `  ${styleTag}`);
          }
        } catch {}
      }

      // 2. Discover and embed markdown pages
      if (await pathExists(mainSourcePath)) {
        try {
          const pageSources = await collectPageSources(mainSourcePath);
          const scriptsToInject: string[] = [];
          for (const page of pageSources) {
            if (page.absolutePath && (await pathExists(page.absolutePath))) {
              const content = await readFile(page.absolutePath, "utf8");
              scriptsToInject.push(
                `<script type="text/markdown" data-shadow-claw-page="${page.displayPath}">\n${content}\n</script>`,
              );
            }
          }
          if (scriptsToInject.length > 0) {
            idxHtml = insertBeforeClosingHead(
              idxHtml,
              `  ${scriptsToInject.join("\n  ")}`,
            );
          }
        } catch {}
      }

      await writeFile(idxPath, idxHtml, "utf8");
    }
  }

  log("Build completed successfully.");
}

const isMainModule =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  runBuild().catch((error) => {
    console.error(error);
    exit(1);
  });
}
