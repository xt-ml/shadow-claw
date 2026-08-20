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

  // Copy template-specific custom assets from pages/assets or pages/main/assets if present
  try {
    await cp("pages/assets", "dist/public/assets", {
      recursive: true,
      force: true,
    });
  } catch (e) {}
  try {
    await cp("pages/main/assets", "dist/public/assets", {
      recursive: true,
      force: true,
    });
  } catch (e) {}

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

  // publish documentation (template can override via pages/)
  await copyWithFallback(
    ["pages/README.md", "README.md"],
    "dist/public/README.md",
  );
  try {
    await cp("e2e/README.md", "dist/public/e2e/README.md");
  } catch {}
  await copyWithFallback(["pages/docs", "docs"], "dist/public/docs", {
    recursive: true,
  });

  // publish index-friendly documentation
  await copyWithFallback(
    ["pages/AGENTS.md", "AGENTS.md"],
    "dist/public/AGENTS.md",
  );
  await copyWithFallback(
    ["pages/llms.txt", "llms.txt"],
    "dist/public/llms.txt",
  );

  // publish robots.txt
  await copyWithFallback(
    ["pages/robots.txt", "robots.txt"],
    "dist/public/robots.txt",
  );

  // publish sitemap.xml
  await copyWithFallback(
    ["pages/sitemap.xml", "pages/main/sitemap.xml", "sitemap.xml"],
    "dist/public/sitemap.xml",
  );

  // publish 404.html
  await copyWithFallback(
    ["pages/404.html", "pages/main/404.html", "404.html"],
    "dist/public/404.html",
  );

  // publish manifest.json
  await copyWithFallback(
    ["pages/manifest.json", "pages/main/manifest.json", "manifest.json"],
    "dist/public/manifest.json",
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

  // Apply declarative site configuration (branding, metadata, manifest, theme).
  // site-config.json is optional — the script exits cleanly when absent.
  try {
    await run(
      "node bin/apply-site-config.mjs dist/public pages/site-config.json",
    );
  } catch {
    // site-config.json not present or apply failed — not fatal
  }

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

  if (isProduction) {
    // Production only replacements
    console.log("Running production post-build steps...");

    // Allow forks and content-only deployments to inject their own GitHub Pages
    // coordinates via environment variables.  Defaults preserve the canonical
    // xt-ml/shadow-claw deployment so existing behaviour is unchanged.
    const pagesOrigin =
      env.PAGES_ORIGIN ?? "https://xt-ml.github.io/shadow-claw/";
    const basePath = env.PAGES_BASE_PATH ?? "/shadow-claw/";

    console.log(`  PAGES_ORIGIN   : ${pagesOrigin}`);
    console.log(`  PAGES_BASE_PATH: ${basePath}`);

    // Replace dev URL with production URL in manifest.json
    await run(
      `echo "${pagesOrigin}" | node bin/file-search-replace.mjs "http://localhost:8888" "dist/public/manifest.json"`,
    );

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
  await run(
    `node bin/prerender-pretty-paths.mjs dist/public pages/routes.json pages/main --prerender-pages=${prerenderPages}`,
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
