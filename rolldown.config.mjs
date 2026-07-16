import fs from "node:fs";
import { exec } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import cssnano from "cssnano";
import htmlnano from "htmlnano";
import postcss from "postcss";

import copy from "rollup-plugin-copy";

import { defineConfig } from "rolldown";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === "production";

const aliasEntries = {
  "^node:zlib$": "browserify-zlib",
  "^zlib$": "browserify-zlib",
  "node:zlib": "browserify-zlib",
  zlib: "browserify-zlib",
  "node:stream": "stream-browserify",
  stream: "stream-browserify",
  "^node:stream$": "stream-browserify",
  "^stream$": "stream-browserify",
  "^node:path$": "path-browserify",
  "^path$": "path-browserify",
  "^node:util$": "util",
  "^util$": "util",
  "^node:buffer$": "buffer",
  "^buffer$": "buffer",
  "^node:crypto$": "crypto-browserify",
  "^crypto$": "crypto-browserify",
  "node:crypto": "crypto-browserify",
  crypto: "crypto-browserify",
  "^node:assert$": "assert",
  "^assert$": "assert",
  "^process$": "process",
  "^isomorphic-git$": resolve(
    __dirname,
    "node_modules/isomorphic-git/index.js",
  ),
};

const baseResolve = {
  alias: Object.fromEntries(
    Object.entries(aliasEntries).map(([k, v]) => [k, [v]]),
  ),
  extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
  aliasFields: [["browser"]],
};

function aliasTurndownPlugin() {
  return {
    name: "alias-turndown-for-worker",
    resolveId(source) {
      if (source === "turndown") {
        return resolve(__dirname, "node_modules/turndown/lib/turndown.es.js");
      }

      if (source === "@mixmark-io/domino") {
        return resolve(
          __dirname,
          "node_modules/@mixmark-io/domino/lib/index.js",
        );
      }

      return null;
    },
    transform(code, id) {
      if (id.includes("turndown") && id.endsWith("turndown.es.js")) {
        return {
          code:
            "import _domino_import from '@mixmark-io/domino';\n" +
            code.replace(
              "var domino = require('@mixmark-io/domino');",
              "var domino = _domino_import;",
            ),
          map: null,
        };
      }

      return null;
    },
  };
}

/**
 * Replaces bare `global` identifier references in node_modules CJS source files
 * with `globalThis`, before rolldown wraps them in __commonJSMin.
 *
 * This is the direct rolldown equivalent of what rollup-plugin-polyfill-node does
 * via @rollup/plugin-inject: it detects unbound `global` usage (e.g. `global.crypto`
 * in randombytes/browser.js, crypto-browserify deps, etc.) and rewrites it so the
 * bundle does not throw "ReferenceError: global is not defined" in browser contexts.
 *
 * The regex replaces `global` as a standalone word boundary, excluding:
 *   - `global:` — object property keys
 *   - `.global` — already-qualified member expressions (e.g. window.global)
 *   - Strings/comments are not parsed; this is intentional: these packages are
 *     known-safe CJS shims whose only real use of `global` is the Node.js global.
 */
function injectGlobalShimPlugin() {
  return {
    name: "inject-global-shim",
    transform(code, id) {
      // Only process CJS JS files inside node_modules
      if (!id.includes("node_modules") || !id.endsWith(".js")) {
        return null;
      }

      // Fast-path: skip files with no `global` references at all
      if (!code.includes("global")) {
        return null;
      }

      // Replace `global` as a standalone identifier, but NOT:
      //   - preceded by `.`  (e.g. window.global, exports.global)
      // Note: we don't exclude `global:` because `{ globalThis: ... }` is harmless
      // and excluding it breaks ternary operators like `? global : window`.
      const replaced = code.replace(/(?<![.\w$])\bglobal\b/g, "globalThis");
      if (replaced === code) {
        return null;
      }

      return { code: replaced, map: null };
    },
  };
}

const execAsync = promisify(exec);
let swBuildTimeout;
function swWatchPlugin() {
  return {
    name: "sw-watch-plugin",
    writeBundle() {
      if (process.argv.includes("--watch") || process.argv.includes("-w")) {
        if (swBuildTimeout) {
          clearTimeout(swBuildTimeout);
        }

        swBuildTimeout = setTimeout(async () => {
          try {
            // Render static DSD shell into index.html for no-JS and first paint.
            console.log(
              "Running post-build steps (prerender & service worker)...",
            );
            const prerenderMainMemory =
              process.env.PRERENDER_MAIN_MEMORY !== "false";
            if (prerenderMainMemory) {
              await execAsync(
                "node bin/prerender-dsd-shell.mjs dist/public/index.html main",
              );
            } else {
              await execAsync(
                "node bin/prerender-dsd-shell.mjs dist/public/index.html --no-seed",
              );
            }

            // build the service worker
            await execAsync("npm run -s build:service-worker");

            // Post-process the generated service worker so its importScripts calls use
            // TrustedScriptURL values in Trusted Types report-only environments.
            await execAsync("node bin/patch-service-worker-trusted-types.mjs");
            console.log("Post-build steps completed successfully.");
          } catch (err) {
            console.error("Post-build steps failed:", err);
          }
        }, 500);
      }
    },
  };
}

const commonResolve = (platform = "browser", extraPlugins = []) => {
  const resolveConfig =
    platform === "browser"
      ? baseResolve
      : {
          alias: {},
          extensions: baseResolve.extensions,
          aliasFields: baseResolve.aliasFields,
        };

  return {
    platform,
    resolve: resolveConfig,
    commonjs: true,
    plugins: [
      ...(platform === "browser" ? [injectGlobalShimPlugin()] : []),
      rolldownImportAttributes(),
      swWatchPlugin(),
      ...extraPlugins,
    ],
    transform: {
      tsconfig: true,
      target: "esnext",
      sourceMap: !isProduction,
      inject: {
        process: "process",
        Buffer: ["buffer", "Buffer"],
      },
    },
  };
};

const configs = [
  // Early Bootstrap Script
  {
    input: "src/core/theme-init.ts",
    output: {
      file: "dist/public/theme-init.js",
      format: "iife",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
      name: "ShadowClawThemeInit",
    },
    ...commonResolve("browser"),
  },
  // Frontend
  {
    input: "src/core/index.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "index.js",
      format: "esm",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    ...commonResolve("browser", [
      copy({
        targets: [
          { src: "index.html", dest: "dist/public" },
          { src: "index.css", dest: "dist/public" },
          { src: "manifest.json", dest: "dist/public" },
          { src: "404.html", dest: "dist/public" },
          {
            src: ["src/**/*.css"],
            dest: "dist/public",
            transform: async (contents, sourcePath) => {
              if (!isProduction) {
                return contents;
              }

              const result = await postcss([
                cssnano({
                  preset: ["default", { discardComments: { removeAll: true } }],
                }),
              ]).process(contents.toString(), {
                from: sourcePath,
                to: join("dist/public", sourcePath.replace(/^src\//, "")),
              });

              return result.css;
            },
            rename: (_, __, fullPath) => fullPath.replace(/^src\//, ""),
          },
          {
            src: ["src/**/*.html"],
            dest: "dist/public",
            transform: async (contents) => {
              if (!isProduction) {
                return contents;
              }

              const result = await htmlnano.process(contents.toString(), {
                collapseWhitespace: "conservative",
                removeComments: true,
              });

              return result.html;
            },
            rename: (_, __, fullPath) => fullPath.replace(/^src\//, ""),
          },
          {
            src: "node_modules/pdfjs-dist/build/pdf.worker.mjs",
            dest: "dist/public",
            rename: "pdf.worker.js",
          },
          {
            src: "src/components/shadow-claw-file-viewer/file-viewer-preview-bridge.js",
            dest: "dist/public/assets",
          },
          { src: "src/subsystems/channels/bindings", dest: "dist/public" },
        ],
        copyOnce: true,
      }),
    ]),
  },
  // Agent Web Worker
  {
    input: "src/worker/worker.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "agent.worker.js",
      format: "esm",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    ...commonResolve("browser", [aliasTurndownPlugin()]),
  },
  // Transformers.js Model Worker
  {
    input: "src/worker/transformers-js.worker.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "transformers-js.worker.js",
      format: "esm",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    ...commonResolve("browser"),
  },
  // Service Worker Init
  {
    input: "src/service-worker/init.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "service-worker/init.js",
      format: "esm",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    ...commonResolve("browser"),
  },
  // Service Worker Push Handler
  {
    input: "src/service-worker/push-handler.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "service-worker/push-handler.js",
      format: "iife",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    ...commonResolve("browser"),
  },
  // Service Worker Fetch Proxy
  {
    input: "src/service-worker/fetch-proxy.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "service-worker/fetch-proxy.js",
      format: "iife",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    ...commonResolve("browser"),
  },
  // Service Worker Share Target
  {
    input: "src/service-worker/share-target.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "service-worker/share-target.js",
      format: "iife",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    ...commonResolve("browser", [
      aliasTurndownPlugin(),
      copy({
        targets: [{ src: "share/**/*", dest: "dist/public/share" }],
        copyOnce: true,
      }),
    ]),
  },
  // Server
  {
    input: "src/server/server.ts",
    output: {
      dir: "dist",
      entryFileNames: "server.js",
      format: "esm",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    external: [
      "@aws-sdk/client-bedrock",
      "@aws-sdk/client-bedrock-runtime",
      "@aws-sdk/credential-providers",
      "express",
      "compression",
      "cors",
      "express-urlrewrite",
      "tcp-port-used",
      "web-push",
      "electron",
    ],
    ...commonResolve("node"),
  },
  // Electron Main Process
  {
    input: "electron/main.ts",
    output: {
      dir: "dist/electron",
      entryFileNames: "main.cjs",
      format: "cjs",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    external: ["electron", "express", "express-urlrewrite", "web-push"],
    ...commonResolve("node"),
  },
];

function rolldownImportAttributes() {
  return {
    name: "rolldown-import-attributes",

    // process files immediately upon discovery
    load(id) {
      if (id.endsWith(".html")) {
        const rawContent = fs.readFileSync(id, "utf-8");
        const escaped = rawContent.replace(/`/g, "\\`").replace(/\${/g, "\\${");

        return {
          code: `
            const doc = new DOMParser().parseFromString(\`${escaped}\`, 'text/html');
            const templateEl = doc.querySelector('template');
            let elements = [];
            if (templateEl) {
              elements = Array.from(templateEl.content.children);
            } else {
              elements = Array.from(doc.head.children).concat(Array.from(doc.body.children));
            }

            export default elements;
          `,
          moduleType: "js",
          // no sourcemap
          map: { mappings: "" },
        };
      }

      if (id.endsWith(".css")) {
        const rawContent = fs.readFileSync(id, "utf-8");
        const escaped = rawContent.replace(/`/g, "\\`").replace(/\${/g, "\\${");

        return {
          code: `
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(\`${escaped}\`);
            export default sheet;
          `,
          moduleType: "js",
          // no sourcemap
          map: { mappings: "" },
        };
      }

      // use native parsing pipeline for normal JS, TS, etc.

      return null;
    },
  };
}

export default defineConfig(configs);
