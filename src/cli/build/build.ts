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

import { DEFAULT_MAIN_GROUP_INDEX_CONTENT } from "../../storage/default-index-content.mjs";
import { DEFAULT_MAIN_GROUP_MEMORY_CONTENT } from "../../storage/default-memory-content.mjs";
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

async function resolveShadowClawPackageVersion(
  contentRoot: string,
  toolchainRoot?: string,
): Promise<string> {
  const candidatePaths = [
    toolchainRoot ? join(toolchainRoot, "package.json") : "",
    join(projectRoot, "package.json"),
    join(contentRoot, "package.json"),
  ].filter(Boolean);

  for (const p of candidatePaths) {
    if (await pathExists(p)) {
      try {
        const pkg = JSON.parse(await readFile(p, "utf8"));
        if (pkg.name === "shadow-claw" && pkg.version) {
          return pkg.version;
        }
      } catch {}
    }
  }

  const contentPkgPath = join(contentRoot, "package.json");
  if (await pathExists(contentPkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(contentPkgPath, "utf8"));
      const depVer =
        pkg.dependencies?.["shadow-claw"] ||
        pkg.devDependencies?.["shadow-claw"];
      if (typeof depVer === "string" && depVer.trim()) {
        const cleaned = depVer.replace(/^[~^>=<v\s]+/, "");
        if (cleaned) {
          return cleaned;
        }
      }
    } catch {}
  }

  return "latest";
}

interface EmbedSingleFileBundleOptions {
  indexPath: string;
  mainSourcePath: string;
  contentRoot: string;
  toolchainRoot?: string;
  cdnBase?: string;
  isQuiet?: boolean;
  log: (...args: any[]) => void;
}

async function embedSingleFileBundle(
  options: EmbedSingleFileBundleOptions,
): Promise<void> {
  const {
    indexPath,
    mainSourcePath,
    contentRoot,
    toolchainRoot,
    cdnBase: explicitCdnBase,
    isQuiet,
    log,
  } = options;
  if (!isQuiet) {
    log(
      "Embedding pages, theme, and CDN runtime for single-file distribution...",
    );
  }
  if (await pathExists(indexPath)) {
    let idxHtml = await readFile(indexPath, "utf8");

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
            const isMemory = /^memory\.(md|markdown)$/iu.test(page.displayPath);
            const isDefaultMemory =
              isMemory &&
              content.trim() === DEFAULT_MAIN_GROUP_MEMORY_CONTENT.trim();
            const isDefaultIndex =
              page.displayPath === "index.html" &&
              content.trim() === DEFAULT_MAIN_GROUP_INDEX_CONTENT.trim();

            if (isDefaultMemory || isDefaultIndex) {
              scriptsToInject.push(
                `<!-- prettier-ignore -->\n  <script type="text/markdown" data-shadow-claw-page="${page.displayPath}"></script>`,
              );
            } else {
              scriptsToInject.push(
                `<!-- prettier-ignore -->\n  <script type="text/markdown" data-shadow-claw-page="${page.displayPath}">${content}</script>`,
              );
            }
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

    // 3. Resolve CDN base and runtime asset base
    let cdnBase = explicitCdnBase || env.SHADOWCLAW_CDN;
    if (!cdnBase) {
      const pkgVersion = await resolveShadowClawPackageVersion(
        contentRoot,
        toolchainRoot,
      );
      cdnBase = `https://cdn.jsdelivr.net/npm/shadow-claw@${pkgVersion}`;
    }
    cdnBase = cdnBase.replace(/\/+$/, "");
    const assetBase = `${cdnBase}/dist/public/`;

    // 4. Inject or update <meta name="shadow-claw-asset-base">
    if (idxHtml.includes('name="shadow-claw-asset-base"')) {
      idxHtml = idxHtml.replace(
        /<meta\s+name="shadow-claw-asset-base"[^>]*>/i,
        `<meta name="shadow-claw-asset-base" content="${assetBase}" />`,
      );
    } else if (/<base\s+href="[^"]*"\s*\/?>/i.test(idxHtml)) {
      idxHtml = idxHtml.replace(
        /(<base\s+href="[^"]*"\s*\/?>)/i,
        `$1\n    <meta name="shadow-claw-asset-base" content="${assetBase}" />`,
      );
    } else {
      idxHtml = insertBeforeClosingHead(
        idxHtml,
        `  <meta name="shadow-claw-asset-base" content="${assetBase}" />`,
      );
    }

    // 5. Rewrite local scripts and stylesheets to CDN URLs
    // Rewrite theme-init.js
    idxHtml = idxHtml.replace(
      /<script\s+src="[^"]*?theme-init\.js"><\/script>/gi,
      `<script src="${assetBase}theme-init.js"></script>`,
    );

    // Rewrite index.css
    idxHtml = idxHtml.replace(
      /<link\b([^>]*?)href="[^"]*?index\.css"([^>]*?)\/?>/gi,
      `<link$1href="${assetBase}index.css"$2 />`,
    );

    // Rewrite manifest.json
    idxHtml = idxHtml.replace(
      /<link\b([^>]*?)href="[^"]*?manifest\.json"([^>]*?)\/?>/gi,
      `<link$1href="${assetBase}manifest.json"$2 />`,
    );

    // Rewrite favicon / touch icons
    idxHtml = idxHtml.replace(
      /<link\b([^>]*?)href="(?:\.\/|\/)?assets\/icons\/favicon\.ico"([^>]*?)\/?>/gi,
      `<link$1href="${assetBase}assets/icons/favicon.ico"$2 />`,
    );
    idxHtml = idxHtml.replace(
      /<link\b([^>]*?)href="(?:\.\/|\/)?assets\/icons\/180\.png"([^>]*?)\/?>/gi,
      `<link$1href="${assetBase}assets/icons/180.png"$2 />`,
    );

    // 6. Remove local module entry scripts: index.js and service-worker/init.js
    idxHtml = idxHtml.replace(
      /\s*<script\s+type="module"\s+src="(?:\.\/|\/)?index\.js"><\/script>/gi,
      "",
    );
    idxHtml = idxHtml.replace(
      /\s*<script\s+type="module"\s+src="(?:\.\/|\/)?service-worker\/init\.js"><\/script>/gi,
      "",
    );

    // 7. Inject importmap and module import before </head> if not already present (or update if already present)
    if (idxHtml.includes('<script type="importmap">')) {
      idxHtml = idxHtml.replace(
        /"shadow-claw":\s*"[^"]*?\/dist\/lib\/index\.js"/g,
        `"shadow-claw": "${cdnBase}/dist/lib/index.js"`,
      );
      idxHtml = idxHtml.replace(
        /"shadow-claw\/":\s*"[^"]*?"/g,
        `"shadow-claw/": "${cdnBase}/"`,
      );
    } else {
      const importMapAndModule = [
        `  <!-- Import Map -->`,
        `  <script type="importmap">`,
        `    {`,
        `      "imports": {`,
        `        "shadow-claw": "${cdnBase}/dist/lib/index.js",`,
        `        "shadow-claw/": "${cdnBase}/"`,
        `      }`,
        `    }`,
        `  </script>`,
        `  <!-- ShadowClaw Library Module -->`,
        `  <script type="module">`,
        `    import "shadow-claw";`,
        `  </script>`,
      ].join("\n");
      idxHtml = insertBeforeClosingHead(idxHtml, importMapAndModule);
    }

    // 8. Inject DOM dedent script for embedded markdown scripts if indented by formatters
    if (!idxHtml.includes('data-shadow-claw-dedent="true"')) {
      const dedentScript = [
        `  <!-- Dedent embedded markdown scripts if indented by formatters (e.g. Prettier) -->`,
        `  <script data-shadow-claw-dedent="true">`,
        `    for (const el of document.querySelectorAll('script[type="text/markdown"][data-shadow-claw-page]')) {`,
        `      const text = el.textContent || '';`,
        `      const m = text.match(/^\\r?\\n([ \\t]+)/);`,
        `      if (m) {`,
        `        const indent = m[1].length;`,
        `        const regex = new RegExp(\`^[ \\\\t]{1,\${indent}}\`, 'gm');`,
        `        el.textContent = text.replace(/^\\r?\\n/, '').replace(regex, '').replace(/\\r?\\n[ \\t]*$/, '\\n');`,
        `      }`,
        `    }`,
        `  </script>`,
      ].join("\n");
      idxHtml = insertBeforeClosingHead(idxHtml, dedentScript);
    }

    // 9. Inject self-healing OPFS cleanup script for stale pre-seeded files if not already present
    if (!idxHtml.includes('data-shadow-claw-opfs-cleanup="true"')) {
      const opfsCleanupScript = [
        `  <!-- Self-heal stale pre-seeded OPFS files with leading whitespace before frontmatter -->`,
        `  <script data-shadow-claw-opfs-cleanup="true">`,
        `    (async () => {`,
        `      try {`,
        `        if (!navigator.storage?.getDirectory) return;`,
        `        const root = await navigator.storage.getDirectory();`,
        `        const scDir = await root.getDirectoryHandle("shadowclaw", { create: false }).catch(() => null);`,
        `        if (!scDir) return;`,
        `        const groupsDir = await scDir.getDirectoryHandle("groups", { create: false }).catch(() => null);`,
        `        if (!groupsDir) return;`,
        `        for await (const [, grp] of groupsDir.entries()) {`,
        `          if (grp.kind !== "directory") continue;`,
        `          async function cleanDir(dir) {`,
        `            for await (const [name, handle] of dir.entries()) {`,
        `              if (handle.kind === "directory") {`,
        `                await cleanDir(handle);`,
        `              } else if (handle.kind === "file") {`,
        `                try {`,
        `                  const file = await handle.getFile();`,
        `                  const text = await file.text();`,
        `                  if (/^(?:\\r?\\n)+[ \\t]*---/.test(text) || /^[ \\t]+---/.test(text)) {`,
        `                    await dir.removeEntry(name);`,
        `                  }`,
        `                } catch {}`,
        `              }`,
        `            }`,
        `          }`,
        `          await cleanDir(grp);`,
        `        }`,
        `      } catch {}`,
        `    })();`,
        `  </script>`,
      ].join("\n");
      idxHtml = insertBeforeClosingHead(idxHtml, opfsCleanupScript);
    }

    await writeFile(indexPath, idxHtml, "utf8");
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
  cdn?: string;
}

export async function runBuild(options: RunBuildOptions = {}): Promise<void> {
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    const isQuiet =
      options.quiet ??
      (process.env.NODE_ENV === "test" && !process.env.VERBOSE);
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
    } else if (options.isProduction === false) {
      process.env.NODE_ENV = "development";
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
        await cp("assets/icons", "dist/public/assets/icons", {
          recursive: true,
        });
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
          isProduction,
          singleFile: options.singleFile,
        });
      } else {
        await prerenderDsdShell({
          indexPath: "dist/public/index.html",
          noSeed: true,
          siteConfigPath,
          isProduction,
          singleFile: options.singleFile,
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
          await writeFile(
            sharePath,
            patchBaseHref(shareHtml, basePath),
            "utf8",
          );
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

      const routesCandidate = await findFirstExistingPath(
        getRoutesCandidates(),
      );
      const routesPath = routesCandidate || "pages/routes.json";
      await prerenderPrettyPaths({
        publicDir: "dist/public",
        routesPath,
        sourcePath: "pages/main",
        prerenderPages,
        siteConfigPath,
        basePath,
        pagesOrigin,
        isProduction,
        singleFile: options.singleFile,
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

      if (options.singleFile) {
        await embedSingleFileBundle({
          indexPath: "dist/public/index.html",
          mainSourcePath: "pages/main",
          contentRoot,
          toolchainRoot,
          cdnBase: options.cdn,
          isQuiet,
          log,
        });
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

    // 2. Ensure default toolchain assets (icons, screenshots, fonts) are available
    const toolchainAssets = join(toolchainRoot, "assets");
    if (contentRoot !== toolchainRoot && (await pathExists(toolchainAssets))) {
      const toolchainIcons = join(toolchainAssets, "icons");
      if (await pathExists(toolchainIcons)) {
        await cp(toolchainIcons, join(distPublicDir, "assets/icons"), {
          recursive: true,
          force: false,
          errorOnExist: false,
        });
      }
      const toolchainScreenshots = join(toolchainAssets, "screenshots");
      if (await pathExists(toolchainScreenshots)) {
        await cp(
          toolchainScreenshots,
          join(distPublicDir, "assets/screenshots"),
          {
            recursive: true,
            force: false,
            errorOnExist: false,
          },
        );
      }
      const toolchainFonts = join(toolchainAssets, "fonts");
      if (await pathExists(toolchainFonts)) {
        await cp(toolchainFonts, join(distPublicDir, "assets/fonts"), {
          recursive: true,
          force: false,
          errorOnExist: false,
        });
      }
    }

    // 2b. Copy/merge assets from contentRoot
    const contentAssets = join(contentRoot, "assets");
    if (await pathExists(contentAssets)) {
      if (copyAllAssets) {
        await cp(contentAssets, distPublicDir, {
          recursive: true,
          force: true,
        });
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
        console.warn(
          "Notice: Failed to auto-generate agent-skills index:",
          err,
        );
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
        isProduction,
        singleFile: options.singleFile,
      });
    } else {
      await prerenderDsdShell({
        indexPath,
        noSeed: true,
        siteConfigPath,
        isProduction,
        singleFile: options.singleFile,
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
    const routesPath =
      routesCandidate || join(contentRoot, "pages/routes.json");
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
      isProduction,
      singleFile: options.singleFile,
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
      await embedSingleFileBundle({
        indexPath: join(distPublicDir, "index.html"),
        mainSourcePath,
        contentRoot,
        toolchainRoot,
        cdnBase: options.cdn,
        isQuiet,
        log,
      });
    }

    log("Build completed successfully.");
  } finally {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  }
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
