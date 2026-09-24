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
  "^assert$": "assert",
  "^buffer$": "buffer",
  "^crypto$": "crypto-browserify",
  "^node:assert$": "assert",
  "^node:buffer$": "buffer",
  "^node:crypto$": "crypto-browserify",
  "^node:path$": "path-browserify",
  "^node:stream$": "stream-browserify",
  "^node:util$": "util",
  "^node:zlib$": "browserify-zlib",
  "^path$": "path-browserify",
  "^process$": "process",
  "^stream$": "stream-browserify",
  "^util$": "util",
  "^zlib$": "browserify-zlib",
  "node:crypto": "crypto-browserify",
  "node:stream": "stream-browserify",
  "node:zlib": "browserify-zlib",
  crypto: "crypto-browserify",
  stream: "stream-browserify",
  zlib: "browserify-zlib",
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

function patchGrayMatterEvalPlugin() {
  return {
    name: "patch-gray-matter-direct-eval",
    transform(code, id) {
      if (!id.includes("node_modules/gray-matter/lib/engines.js")) {
        return null;
      }

      const replaced = code.replace(
        /return\s+eval\(str\)\s*\|\|\s*\{\s*\};/u,
        "return (0, eval)(str) || {};",
      );

      if (replaced === code) {
        return null;
      }

      return { code: replaced, map: null };
    },
  };
}

function replacePrerenderMainMemoryPlugin() {
  return {
    name: "replace-prerender-main-memory",
    transform(code) {
      if (!code.includes("__PRERENDER_MAIN_MEMORY__")) {
        return null;
      }

      const val =
        process.env.PRERENDER_MAIN_MEMORY !== "false" ? "true" : "false";
      const replaced = code.replace(
        /(?<!declare\s+const\s+)__PRERENDER_MAIN_MEMORY__/g,
        val,
      );
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
            const { prerenderDsdShell } =
              await import("./dist/cli/prerender/dsd-shell/prerender-dsd-shell.js");
            const { patchServiceWorkerTrustedTypesFile } =
              await import("./dist/cli/tools/patch-service-worker-trusted-types.js");

            const prerenderMainMemory =
              process.env.PRERENDER_MAIN_MEMORY !== "false";
            await prerenderDsdShell({
              indexPath: "dist/public/index.html",
              sourcePath: "pages/main",
              noSeed: !prerenderMainMemory,
            });

            // build the service worker
            await execAsync("npm run -s build:service-worker");

            // Post-process the generated service worker so its importScripts calls use
            // TrustedScriptURL values in Trusted Types report-only environments.
            await patchServiceWorkerTrustedTypesFile(
              "dist/public/service-worker.js",
            );
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
      replacePrerenderMainMemoryPlugin(),
      patchGrayMatterEvalPlugin(),
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

/**
 * Automatically discovers library entry points across src/components and src/utils.
 * Eliminates the need to manually list dozens of individual component and utility files.
 */
export function getLibraryEntries(rootDir = __dirname) {
  const entries = {
    index: "src/index.ts",
    "components/index": "src/components/index.ts",
  };

  const shadowClawElementPath = join(
    rootDir,
    "src/components/shadow-claw-element.ts",
  );
  if (fs.existsSync(shadowClawElementPath)) {
    entries["components/shadow-claw-element"] =
      "src/components/shadow-claw-element.ts";
  }

  const componentDirs = [
    "src/components",
    "src/components/common",
    "src/components/settings",
  ];

  for (const relDir of componentDirs) {
    const absDir = join(rootDir, relDir);
    if (!fs.existsSync(absDir)) continue;
    for (const item of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (
        item.isDirectory() &&
        (item.name.startsWith("shadow-claw-") || item.name === "shadow-claw")
      ) {
        const relFilePath = `${relDir}/${item.name}/${item.name}.ts`;
        const absFilePath = join(rootDir, relFilePath);
        if (fs.existsSync(absFilePath)) {
          entries[`components/${item.name}`] = relFilePath;
          if (relDir.includes("/common")) {
            entries[`components/common/${item.name}`] = relFilePath;
          } else if (relDir.includes("/settings")) {
            entries[`components/settings/${item.name}`] = relFilePath;
          }
        }
      }
    }
  }

  const utilsDir = join(rootDir, "src/utils");
  if (fs.existsSync(utilsDir)) {
    for (const item of fs.readdirSync(utilsDir, { withFileTypes: true })) {
      if (
        item.isFile() &&
        item.name.endsWith(".ts") &&
        !item.name.endsWith(".test.ts") &&
        !item.name.endsWith(".d.ts")
      ) {
        const utilName = item.name.replace(/\.ts$/, "");
        entries[`utils/${utilName}`] = `src/utils/${item.name}`;
      }
    }
  }

  return entries;
}

export const libraryEntries = getLibraryEntries();

export const libraryConfig = {
  input: libraryEntries,
  output: {
    dir: "dist/lib",
    entryFileNames: "[name].js",
    chunkFileNames: "[name]-[hash].js",
    format: "esm",
    sourcemap: !isProduction,
    codeSplitting: true,
    minify: false,
  },
  ...commonResolve("browser"),
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
      codeSplitting: true,
      minify: isProduction,
    },
    ...commonResolve("browser", [
      copy({
        targets: [
          {
            src: "index.html",
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
          },
          {
            src: "index.css",
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
                to: join("dist/public", "index.css"),
              });

              return result.css;
            },
          },
          { src: "manifest.json", dest: "dist/public" },
          {
            src: "404.html",
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
          },
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
          {
            src: "src/components/shadow-claw-file-viewer/iframe-storage-bridge.js",
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
      codeSplitting: true,
      minify: isProduction,
    },
    ...commonResolve("browser", [aliasTurndownPlugin()]),
  },
  // Transformers.js Model Worker
  {
    input: "src/worker/utils/transformers-js.worker.ts",
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
      /\.node$/,
      "@aws-sdk/client-bedrock",
      "@aws-sdk/client-bedrock-runtime",
      "@aws-sdk/credential-providers",
      "express",
      "compression",
      "cors",
      "express-urlrewrite",
      "tcp-port-used",
      "web-push",
      "@mongodb-js/zstd",
      "node-liblzma",
      "electron",
    ],
    ...commonResolve("node"),
  },
  // Headless CLI Agent
  {
    input: "src/worker/headless-agent.ts",
    output: {
      dir: "dist",
      entryFileNames: "headless-agent.js",
      format: "esm",
      sourcemap: !isProduction,
      codeSplitting: false,
      minify: isProduction,
    },
    external: [
      /\.node$/,
      /^node:.*/,
      "@aws-sdk/client-bedrock",
      "@aws-sdk/client-bedrock-runtime",
      "@aws-sdk/credential-providers",
      "@google/genai",
      "@huggingface/transformers",
      "gray-matter",
      "isomorphic-git",
      "just-bash",
      "@mongodb-js/zstd",
      "node-liblzma",
      "express",
      "electron",
    ],
    ...commonResolve("node"),
  },
  // CLI Commands
  {
    input: {
      cli: "src/cli/cli.ts",
      "build/build": "src/cli/build/build.ts",
      "tools/version": "src/cli/tools/version.ts",
      "tools/assert-version-bump": "src/cli/tools/assert-version-bump.ts",
    },
    output: {
      dir: "dist/cli",
      entryFileNames: "[name].js",
      chunkFileNames: "chunk-[hash].js",
      format: "esm",
      sourcemap: !isProduction,
      codeSplitting: true,
      minify: isProduction,
    },
    external: [
      /\.node$/,
      /^node:.*/,
      "commander",
      "@mongodb-js/zstd",
      "node-liblzma",
      "express",
      "cors",
      "compression",
      "isomorphic-git",
      "@mcp-b/webmcp-polyfill",
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
