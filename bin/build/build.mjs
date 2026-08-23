#!/usr/bin/env node

import { execSync } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
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
const projectRoot = join(__dirname, "../..");

chdir(projectRoot);

async function run(command, options = {}) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit", ...options });
}

export async function runBuild() {
  const { isProduction, copyAllAssets, prerenderPages, prerenderMainMemory } =
    resolveBuildFlags(env);

  await run("npm run -s build:clean");
  await mkdir("dist/public/assets", { recursive: true });

  if (copyAllAssets) {
    await cp("assets", "dist/public", { recursive: true });
  } else {
    await cp("assets/icons", "dist/public/assets/icons", { recursive: true });
    await cp("assets/screenshots", "dist/public/assets/screenshots", {
      recursive: true,
    });
    try {
      await cp("assets/fonts", "dist/public/assets/fonts", { recursive: true });
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
    await cp("skills", "dist/public/skills", { recursive: true });
  } catch {}

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
    console.log("Running production post-build steps...");

    const pagesOrigin = env.PAGES_ORIGIN;
    const basePath = env.PAGES_BASE_PATH ?? "/shadow-claw/";

    console.log(`  PAGES_ORIGIN   : ${pagesOrigin || "(relative ./)"}`);
    console.log(`  PAGES_BASE_PATH: ${basePath}`);

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

    const meta = execSync("npm run -s build:pkg:get:meta", {
      encoding: "utf8",
    }).trim();
    await run(`npm run -s build:pkg:meta "${meta}"`);
  }

  const routesCandidate = await findFirstExistingPath(getRoutesCandidates());
  const routesPath = routesCandidate || "pages/routes.json";
  await run(
    `node bin/prerender-pretty-paths/prerender-pretty-paths.mjs dist/public ${routesPath} pages/main --prerender-pages=${prerenderPages}`,
  );

  await run("npm run -s build:service-worker");
  await run("node bin/patch-service-worker-trusted-types.mjs");

  console.log("Build completed successfully.");
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
