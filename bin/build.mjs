#!/usr/bin/env node

import { execSync } from "node:child_process";
import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chdir, env, exit, argv } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

chdir(projectRoot);

/**
 * Runs a shell command synchronously and logs it.
 *
 * @param {string} command
 * @param {import("node:child_process").ExecSyncOptions} [options]
 *
 * @returns {Promise<void>}
 */
async function run(command, options = {}) {
  console.log(`> ${command}`);
  try {
    execSync(command, { stdio: "inherit", ...options });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    exit(1);
  }
}

async function main() {
  const isProduction = env.NODE_ENV === "production";
  const copyAllAssets = env.COPY_ALL_ASSETS === "true";
  const prerenderPages = env.PRERENDER_PAGES || "all";
  const prerenderMainMemory =
    env.PRERENDER_MAIN_MEMORY !== "false" &&
    prerenderPages !== "none" &&
    prerenderPages !== "0";

  // npm run -s build:clean
  await run("npm run -s build:clean");

  // mkdir -p dist/public/assets
  await mkdir("dist/public/assets", { recursive: true });

  if (copyAllAssets) {
    // cp -R assets dist/public/
    await cp("assets", "dist/public", { recursive: true });
  } else {
    // cp -R assets/icons dist/public/assets/
    await cp("assets/icons", "dist/public/assets/icons", { recursive: true });
    // cp -R assets/screenshots dist/public/assets/
    await cp("assets/screenshots", "dist/public/assets/screenshots", {
      recursive: true,
    });

    // [[ -d assets/fonts ]] && cp -R assets/fonts dist/public/assets/
    try {
      await cp("assets/fonts", "dist/public/assets/fonts", { recursive: true });
    } catch (e) {
      // fonts directory might not exist, which is fine
    }
  }

  // Copy template-specific custom assets and root resources
  const resourceDirs = [
    "pages/resources",
    "pages/deps",
    "resources",
    "deps",
    "pages/assets",
    "pages/main/assets",
  ];
  for (const resDir of resourceDirs) {
    try {
      const entries = await readdir(resDir, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = join(resDir, entry.name);
        const destPath = join("dist/public", entry.name);
        if (entry.isDirectory()) {
          await cp(srcPath, destPath, { recursive: true, force: true });
        } else if (entry.isFile()) {
          await cp(srcPath, destPath, { force: true });
        }
      }
    } catch (e) {}
  }

  const copyWithFallback = async (sources, dest, opts = {}) => {
    const candidates = Array.isArray(sources) ? sources : [sources];
    for (const candidate of candidates) {
      try {
        await stat(candidate);
        await cp(candidate, dest, opts);
        return true;
      } catch {}
    }
    return false;
  };

  const copyWithFallbackPath = async (candidates) => {
    for (const candidate of candidates) {
      try {
        await stat(candidate);
        return candidate;
      } catch {}
    }
    return null;
  };

  // publish documentation (template can override via pages/ or resources/)
  await copyWithFallback(
    [
      "pages/resources/README.md",
      "pages/deps/README.md",
      "resources/README.md",
      "deps/README.md",
      "pages/README.md",
      "README.md",
    ],
    "dist/public/README.md",
  );
  try {
    await cp("e2e/README.md", "dist/public/e2e/README.md");
  } catch {}
  await copyWithFallback(
    [
      "pages/resources/docs",
      "pages/deps/docs",
      "resources/docs",
      "deps/docs",
      "pages/docs",
      "docs",
    ],
    "dist/public/docs",
    { recursive: true },
  );

  // publish index-friendly documentation
  await copyWithFallback(
    [
      "pages/resources/AGENTS.md",
      "pages/deps/AGENTS.md",
      "resources/AGENTS.md",
      "deps/AGENTS.md",
      "pages/AGENTS.md",
      "AGENTS.md",
    ],
    "dist/public/AGENTS.md",
  );
  await copyWithFallback(
    [
      "pages/resources/llms.txt",
      "pages/deps/llms.txt",
      "resources/llms.txt",
      "deps/llms.txt",
      "pages/llms.txt",
      "llms.txt",
    ],
    "dist/public/llms.txt",
  );

  // publish robots.txt
  await copyWithFallback(
    [
      "pages/resources/robots.txt",
      "pages/deps/robots.txt",
      "resources/robots.txt",
      "deps/robots.txt",
      "pages/robots.txt",
      "robots.txt",
    ],
    "dist/public/robots.txt",
  );

  // publish sitemap.xml
  await copyWithFallback(
    [
      "pages/resources/sitemap.xml",
      "pages/deps/sitemap.xml",
      "resources/sitemap.xml",
      "deps/sitemap.xml",
      "pages/sitemap.xml",
      "pages/main/sitemap.xml",
      "sitemap.xml",
    ],
    "dist/public/sitemap.xml",
  );

  // publish sitemap.txt
  await copyWithFallback(
    [
      "pages/resources/sitemap.txt",
      "pages/deps/sitemap.txt",
      "resources/sitemap.txt",
      "deps/sitemap.txt",
      "pages/sitemap.txt",
      "pages/main/sitemap.txt",
      "sitemap.txt",
    ],
    "dist/public/sitemap.txt",
  );

  // publish 404.html
  await copyWithFallback(
    [
      "pages/resources/404.html",
      "pages/deps/404.html",
      "resources/404.html",
      "deps/404.html",
      "pages/404.html",
      "pages/main/404.html",
      "404.html",
    ],
    "dist/public/404.html",
  );

  // publish manifest.json
  await copyWithFallback(
    [
      "pages/resources/manifest.json",
      "pages/deps/manifest.json",
      "resources/manifest.json",
      "deps/manifest.json",
      "pages/manifest.json",
      "pages/main/manifest.json",
      "manifest.json",
    ],
    "dist/public/manifest.json",
  );

  // publish favicon.svg
  await copyWithFallback(
    [
      "pages/resources/assets/icons/favicon.svg",
      "pages/deps/assets/icons/favicon.svg",
      "resources/assets/icons/favicon.svg",
      "deps/assets/icons/favicon.svg",
      "pages/resources/assets/favicon.svg",
      "pages/resources/favicon.svg",
      "pages/deps/favicon.svg",
      "resources/favicon.svg",
      "deps/favicon.svg",
      "pages/favicon.svg",
      "pages/main/favicon.svg",
      "assets/icons/favicon.svg",
    ],
    "dist/public/favicon.svg",
  );

  // publish favicon.ico
  await copyWithFallback(
    [
      "pages/resources/assets/icons/favicon.ico",
      "pages/deps/assets/icons/favicon.ico",
      "resources/assets/icons/favicon.ico",
      "deps/assets/icons/favicon.ico",
      "pages/resources/assets/favicon.ico",
      "pages/resources/favicon.ico",
      "pages/deps/favicon.ico",
      "resources/favicon.ico",
      "deps/favicon.ico",
      "pages/favicon.ico",
      "pages/main/favicon.ico",
      "assets/icons/favicon.ico",
    ],
    "dist/public/favicon.ico",
  );

  // publish pages directory for lazy routing manifests
  try {
    await cp("pages", "dist/public/pages", { recursive: true });
  } catch (e) {
    // pages directory might not exist
  }

  // publish pages/main as files/main and static-main so workspace files and assets can be resolved
  try {
    await cp("pages/main", "dist/public/files/main", { recursive: true });
  } catch (e) {
    // pages/main directory might not exist
  }

  try {
    await cp("pages/main", "dist/public/static-main", { recursive: true });
  } catch (e) {
    // pages/main directory might not exist
  }

  await run("npm run -s rolldown");

  // Render static DSD shell into index.html for no-JS and first paint.
  // Pages content seeding from pages/main/ is configurable via PRERENDER_PAGES (default "1" for current page).
  if (prerenderMainMemory) {
    await run(
      `node bin/prerender-dsd-shell.mjs dist/public/index.html pages/main --prerender-pages=${prerenderPages}`,
    );
  } else {
    await run(
      "node bin/prerender-dsd-shell.mjs dist/public/index.html --no-seed",
    );
  }

  // Apply declarative site configuration (branding, metadata, manifest, theme).
  // site-config.json is optional — the script exits cleanly when absent.
  const siteConfigCandidate = await copyWithFallbackPath([
    "pages/resources/site-config.json",
    "pages/deps/site-config.json",
    "resources/site-config.json",
    "deps/site-config.json",
    "pages/site-config.json",
    "site-config.json",
  ]);
  const siteConfigPath = siteConfigCandidate || "pages/site-config.json";
  try {
    await run(`node bin/apply-site-config.mjs dist/public ${siteConfigPath}`);
  } catch {
    // site-config.json not present or apply failed — not fatal
  }

  if (isProduction) {
    // Production only replacements
    console.log("Running production post-build steps...");

    // Allow forks and content-only deployments to inject their own GitHub Pages
    // coordinates via environment variables. Defaults preserve the canonical
    // xt-ml/shadow-claw deployment so existing behaviour is unchanged.
    const pagesOrigin = env.PAGES_ORIGIN;
    const basePath = env.PAGES_BASE_PATH ?? "/shadow-claw/";

    console.log(`  PAGES_ORIGIN   : ${pagesOrigin || "(relative ./)"}`);
    console.log(`  PAGES_BASE_PATH: ${basePath}`);

    // Update start_url in dist/public/manifest.json if PAGES_ORIGIN is set
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

    // Replace base href in index.html
    await run(
      `echo 'base href="${basePath}"' | node bin/file-search-replace.mjs 'base href="/"' "dist/public/index.html"`,
    );

    // node bin/touch-nojekyll.mjs
    await run("node bin/touch-nojekyll.mjs");

    // npm run -s build:pkg:meta "$(npm run -s build:pkg:get:meta)"
    const meta = execSync("npm run -s build:pkg:get:meta", {
      encoding: "utf8",
    }).trim();
    await run(`npm run -s build:pkg:meta "${meta}"`);
  }

  // Prerender static pages for pretty paths defined in pages/routes.json (if present)
  const routesCandidate = await copyWithFallbackPath([
    "pages/resources/routes.json",
    "pages/deps/routes.json",
    "resources/routes.json",
    "deps/routes.json",
    "pages/routes.json",
    "routes.json",
  ]);
  const routesPath = routesCandidate || "pages/routes.json";
  await run(
    `node bin/prerender-pretty-paths.mjs dist/public ${routesPath} pages/main --prerender-pages=${prerenderPages}`,
  );

  // build the service worker (all environments)
  await run("npm run -s build:service-worker");

  // Post-process the generated service worker so its importScripts calls use
  // TrustedScriptURL values in Trusted Types report-only environments.
  await run("node bin/patch-service-worker-trusted-types.mjs");

  console.log("Build completed successfully.");
}

main().catch((error) => {
  console.error(error);
  exit(1);
});
