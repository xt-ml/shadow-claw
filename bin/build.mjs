#!/usr/bin/env node

import { execSync } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chdir, env, exit } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

chdir(projectRoot);

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

  // npm run -s rollup
  await run("npm run -s rollup");

  // npm run -s tsc
  await run("npm run -s tsc");

  if (isProduction) {
    // Production only replacements
    console.log("Running production post-build steps...");

    // Replace dev URL with production URL in manifest.json
    await run(
      'echo "https://xt-ml.github.io/shadow-claw/" | node bin/file-search-replace.mjs "http://localhost:8888" "dist/public/manifest.json"',
    );

    // Replace base href in index.html
    await run(
      'echo "base href=\\"/shadow-claw/\\"" | node bin/file-search-replace.mjs "base href=\\"/\\"" "dist/public/index.html"',
    );

    // node bin/touch-nojekyll.mjs
    await run("node bin/touch-nojekyll.mjs");

    // npm run -s build:pkg:meta "$(npm run -s build:pkg:get:meta)"
    const meta = execSync("npm run -s build:pkg:get:meta", {
      encoding: "utf8",
    }).trim();
    await run(`npm run -s build:pkg:meta "${meta}"`);
  }

  // build the service worker (all environments)
  await run("npm run -s build:service-worker");

  console.log("Build completed successfully.");
}

main().catch((error) => {
  console.error(error);
  exit(1);
});
