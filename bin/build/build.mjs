#!/usr/bin/env node

import { execSync } from "node:child_process";
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { chdir, env, exit } from "node:process";
import { fileURLToPath } from "node:url";

import { copyResourceDirEntries } from "./utils/copy-resource-dir-entries.mjs";
import { copyWithFallback } from "./utils/copy-with-fallback.mjs";
import { findFirstExistingPath } from "./utils/find-first-existing-path.mjs";
import { getPublishCopyPlan } from "./utils/get-publish-copy-plan.mjs";
import { getRoutesCandidates } from "./utils/get-routes-candidates.mjs";
import { getSiteConfigCandidates } from "./utils/get-site-config-candidates.mjs";
import { resolveBuildFlags } from "./utils/resolve-build-flags.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../..");

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function runBuild(options = {}) {
  const isQuiet =
    options.quiet ?? (process.env.NODE_ENV === "test" && !process.env.VERBOSE);
  const defaultStdio =
    options.stdio ??
    (process.env.NODE_ENV === "test" && !process.env.VERBOSE
      ? "pipe"
      : "inherit");

  const log = (...args) => {
    if (!isQuiet) {
      console.log(...args);
    }
  };

  async function run(command, runOptions = {}) {
    if (!isQuiet && !runOptions.quiet) {
      console.log(`> ${command}`);
    }
    const stdio = runOptions.stdio ?? defaultStdio;
    execSync(command, { stdio, ...runOptions });
  }

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

  if (isInRepo) {
    chdir(projectRoot);

    await run("node bin/rimraf.mjs dist/public");
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

    try {
      await cp("pages/main", "dist/public/static-main", { recursive: true });
    } catch {}

    try {
      await cp(".agents/skills", "dist/public/.agents/skills", {
        recursive: true,
      });
    } catch {}

    try {
      await cp(".agents/tools", "dist/public/.agents/tools", {
        recursive: true,
      });
    } catch {}

    try {
      await cp(".agents/scripts", "dist/public/.agents/scripts", {
        recursive: true,
      });
    } catch {}

    // Generate / sync Agent Skills Discovery index (.well-known/agent-skills/index.json)
    if (await pathExists(".agents/skills")) {
      try {
        const { generateSkillsIndex } =
          await import("../commands/skills-index.mjs");
        await generateSkillsIndex(projectRoot);
        if (await pathExists(".well-known/agent-skills/index.json")) {
          await cp(".well-known", "dist/public/.well-known", {
            recursive: true,
            force: true,
          });
        }
      } catch (err) {
        console.warn(
          "Notice: Failed to auto-generate agent-skills index:",
          err,
        );
      }
    } else if (await pathExists(".well-known")) {
      try {
        await cp(".well-known", "dist/public/.well-known", {
          recursive: true,
          force: true,
        });
      } catch {}
    }

    await run("npm run -s rolldown");

    if (prerenderMainMemory) {
      await run(
        `node bin/prerender-dsd-shell/prerender-dsd-shell.mjs dist/public/index.html pages/main --prerender-pages=${prerenderPages}`,
      );
    } else {
      await run(
        "node bin/prerender-dsd-shell/prerender-dsd-shell.mjs dist/public/index.html --no-seed",
      );
    }

    const siteConfigCandidate = await findFirstExistingPath(
      getSiteConfigCandidates(),
    );
    const siteConfigPath = siteConfigCandidate || "pages/site-config.json";
    try {
      await run(`node bin/site-config/apply.mjs dist/public ${siteConfigPath}`);
    } catch {}

    if (isProduction) {
      log("Running production post-build steps...");

      const pagesOrigin = options.pagesOrigin || env.PAGES_ORIGIN;
      const basePath =
        options.basePath || (env.PAGES_BASE_PATH ?? "/shadow-claw/");

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

      await run(
        `echo 'base href="${basePath}"' | node bin/file-search-replace.mjs 'base href="/"' "dist/public/index.html"`,
      );
      await run("node bin/touch-nojekyll.mjs");

      let meta = "";
      try {
        meta = execSync("npm run -s build:pkg:get:meta", {
          encoding: "utf8",
        }).trim();
      } catch {}
      if (meta) {
        await run(`npm run -s build:pkg:meta "${meta}"`);
      }
    }

    const routesCandidate = await findFirstExistingPath(getRoutesCandidates());
    const routesPath = routesCandidate || "pages/routes.json";
    await run(
      `node bin/prerender-pretty-paths/prerender-pretty-paths.mjs dist/public ${routesPath} pages/main --prerender-pages=${prerenderPages}`,
    );

    await run("npm run -s build:service-worker");
    await run("node bin/patch-service-worker-trusted-types.mjs");

    log("Build completed successfully.");
    return;
  }

  // --- CLI / EXTERNAL CONSUMER MODE ---
  const outDir = options.outDir || "dist/public";
  const distPublicDir = resolve(contentRoot, outDir);

  await mkdir(distPublicDir, { recursive: true });
  await mkdir(join(distPublicDir, "assets"), { recursive: true });

  // 1. Ensure core toolchain bundle is available in toolchainRoot
  const toolchainDist = join(toolchainRoot, "dist/public");
  const toolchainBuilt = await pathExists(join(toolchainDist, "index.js"));
  if (!toolchainBuilt) {
    log("Building ShadowClaw core toolchain...");
    await run("npm run -s build:clean", { cwd: toolchainRoot });
    await run("npm run -s rolldown", { cwd: toolchainRoot });
  }

  // Copy base distribution into target
  await cp(toolchainDist, distPublicDir, { recursive: true });

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

  // 6. Copy .agents from contentRoot (fallback to toolchainRoot)
  const contentSkills = join(contentRoot, ".agents/skills");
  if (await pathExists(contentSkills)) {
    await cp(contentSkills, join(distPublicDir, ".agents/skills"), {
      recursive: true,
      force: true,
    });
  } else {
    const toolchainSkills = join(toolchainRoot, ".agents/skills");
    if (await pathExists(toolchainSkills)) {
      await cp(toolchainSkills, join(distPublicDir, ".agents/skills"), {
        recursive: true,
        force: true,
      });
    }
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

  // 6b. Generate / sync Agent Skills Discovery index (.well-known/agent-skills/index.json)
  if (await pathExists(contentSkills)) {
    try {
      const { generateSkillsIndex } =
        await import("../commands/skills-index.mjs");
      await generateSkillsIndex(contentRoot);
      const rootWellKnownIndex = join(
        contentRoot,
        ".well-known/agent-skills/index.json",
      );
      if (await pathExists(rootWellKnownIndex)) {
        await cp(
          join(contentRoot, ".well-known"),
          join(distPublicDir, ".well-known"),
          {
            recursive: true,
            force: true,
          },
        );
      }
    } catch (err) {
      console.warn("Notice: Failed to auto-generate agent-skills index:", err);
      const contentWellKnown = join(contentRoot, ".well-known");
      if (await pathExists(contentWellKnown)) {
        await cp(contentWellKnown, join(distPublicDir, ".well-known"), {
          recursive: true,
          force: true,
        });
      }
    }
  } else {
    const contentWellKnown = join(contentRoot, ".well-known");
    if (await pathExists(contentWellKnown)) {
      await cp(contentWellKnown, join(distPublicDir, ".well-known"), {
        recursive: true,
        force: true,
      });
    } else {
      const toolchainWellKnown = join(toolchainRoot, ".well-known");
      if (await pathExists(toolchainWellKnown)) {
        await cp(toolchainWellKnown, join(distPublicDir, ".well-known"), {
          recursive: true,
          force: true,
        });
      }
    }
  }

  // 7. Prerender DSD Shell
  const dsdScript = join(
    toolchainRoot,
    "bin/prerender-dsd-shell/prerender-dsd-shell.mjs",
  );
  const indexPath = join(distPublicDir, "index.html");
  if (prerenderMainMemory && (await pathExists(contentPagesMain))) {
    await run(
      `node "${dsdScript}" "${indexPath}" "${contentPagesMain}" --prerender-pages=${prerenderPages}`,
    );
  } else {
    await run(`node "${dsdScript}" "${indexPath}" --no-seed`);
  }

  // 8. Apply site-config
  const siteConfigScript = join(toolchainRoot, "bin/site-config/apply.mjs");
  const siteConfigCandidate = await findFirstExistingPath(
    getSiteConfigCandidates(contentRoot),
  );
  const siteConfigPath =
    siteConfigCandidate || join(contentRoot, "pages/site-config.json");
  try {
    await run(
      `node "${siteConfigScript}" "${distPublicDir}" "${siteConfigPath}"`,
    );
  } catch {}

  // 9. Base href normalization & Production post-build
  const defaultBasePath = isProduction
    ? options.basePath || env.PAGES_BASE_PATH || "/"
    : options.basePath || "/";
  const basePath = defaultBasePath;

  try {
    const idxHtml = await readFile(indexPath, "utf8");
    const updatedHtml = idxHtml.replace(
      /<base\s+href="[^"]*"\s*\/?>/i,
      `<base href="${basePath}" />`,
    );
    await writeFile(indexPath, updatedHtml, "utf8");
  } catch {}

  if (isProduction) {
    log("Running production post-build steps...");

    const pagesOrigin = options.pagesOrigin || env.PAGES_ORIGIN;
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
      }).trim();
    } catch {
      try {
        meta = execSync("git rev-parse HEAD", {
          cwd: toolchainRoot,
          encoding: "utf8",
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
  const prettyPathsScript = join(
    toolchainRoot,
    "bin/prerender-pretty-paths/prerender-pretty-paths.mjs",
  );
  const routesCandidate = await findFirstExistingPath(
    getRoutesCandidates(contentRoot),
  );
  const routesPath = routesCandidate || join(contentRoot, "pages/routes.json");
  const mainSourcePath = (await pathExists(contentPagesMain))
    ? contentPagesMain
    : join(toolchainRoot, "pages/main");
  await run(
    `node "${prettyPathsScript}" "${distPublicDir}" "${routesPath}" "${mainSourcePath}" --prerender-pages=${prerenderPages}`,
  );

  // 11. Service Worker patch
  const patchSwScript = join(
    toolchainRoot,
    "bin/patch-service-worker-trusted-types.mjs",
  );
  const swPath = join(distPublicDir, "service-worker.js");
  if (await pathExists(swPath)) {
    await run(`node "${patchSwScript}" "${swPath}"`);
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
