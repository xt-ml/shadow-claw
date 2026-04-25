import { builtinModules } from "node:module";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

import copy from "rollup-plugin-copy";
import esbuild from "rollup-plugin-esbuild";
import polyfills from "rollup-plugin-polyfill-node";

import cssnano from "cssnano";
import htmlnano from "htmlnano";
import postcss from "postcss";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === "production";

const onwarn = (warning, warn) => {
  if (
    warning.code === "CIRCULAR_DEPENDENCY" &&
    warning.message.includes("node_modules")
  ) {
    return;
  }

  warn(warning);
};

const commonPlugins = (tsconfig) => [
  alias({
    entries: [
      { find: /^node:zlib$/, replacement: "browserify-zlib" },
      { find: /^zlib$/, replacement: "browserify-zlib" },
      { find: /^node:stream$/, replacement: "stream-browserify" },
      { find: /^stream$/, replacement: "stream-browserify" },
      { find: /^node:path$/, replacement: "path-browserify" },
      { find: /^path$/, replacement: "path-browserify" },
      { find: /^node:util$/, replacement: "util" },
      { find: /^util$/, replacement: "util" },
      { find: /^node:buffer$/, replacement: "buffer" },
      { find: /^buffer$/, replacement: "buffer" },
      { find: /^node:assert$/, replacement: "assert" },
      { find: /^assert$/, replacement: "assert" },
      { find: /^process$/, replacement: "process" },
      {
        find: /^isomorphic-git$/,
        replacement: resolve(__dirname, "node_modules/isomorphic-git/index.js"),
      },
      {
        find: "isomorphic-git/http/web",
        replacement: resolve(
          __dirname,
          "node_modules/isomorphic-git/http/web/index.js",
        ),
      },
    ],
  }),
  nodeResolve({
    browser: true,
    preferBuiltins: false,
    exportConditions: ["import", "browser", "default"],
  }),
  commonjs(),
  polyfills(),
  json(),
  esbuild({
    include: /\.[jt]s$/, // handle .mjs via alias or just let it pass
    exclude: /node_modules/,
    sourceMap: !isProduction,
    minify: false, // terser // terser
    target: "esnext",
    tsconfig,
    loaders: {
      ".mjs": "js",
    },
  }),
  inject({
    process: "process",
    Buffer: ["buffer", "Buffer"],
  }),
  isProduction && terser(),
];

const configs = [
  // Frontend
  {
    input: "src/index.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "index.js",
      format: "esm",
      sourcemap: !isProduction,
      inlineDynamicImports: true,
    },
    onwarn,
    plugins: [
      ...commonPlugins("./tsconfig.json"),
      copy({
        targets: [
          { src: "index.html", dest: "dist/public" },
          { src: "index.css", dest: "dist/public" },
          { src: "manifest.json", dest: "dist/public" },
          { src: "404.html", dest: "dist/public" },
          { src: "service-worker/**/*", dest: "dist/public/service-worker" },
          {
            src: ["src/**/*.css"],
            dest: "dist/public",
            transform: async (contents, sourcePath) => {
              if (!isProduction) {
                return contents;
              }

              const result = await postcss([
                cssnano({
                  preset: [
                    "default",
                    {
                      discardComments: { removeAll: true },
                    },
                  ],
                }),
              ]).process(contents.toString(), {
                from: sourcePath,
                to: path.join("dist/public", path.relative("src", sourcePath)),
              });

              return result.css;
            },
            rename: (_, __, fullPath) => path.relative("src", fullPath),
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
            rename: (_, __, fullPath) => path.relative("src", fullPath),
          },
          {
            src: "node_modules/pdfjs-dist/build/pdf.worker.mjs",
            dest: "dist/public",
            rename: "pdf.worker.js",
          },
        ],
        copyOnce: true,
      }),
    ],
  },
  // Agent Web Worker
  {
    input: "src/worker/worker.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "agent.worker.js",
      format: "esm",
      sourcemap: !isProduction,
      inlineDynamicImports: true,
    },
    onwarn,
    plugins: [...commonPlugins("./tsconfig.agent.worker.json")],
  },
  // Service Worker Init
  {
    input: "src/service-worker/init.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "service-worker/init.js",
      format: "esm",
      sourcemap: !isProduction,
      inlineDynamicImports: true,
    },
    onwarn,
    plugins: [...commonPlugins("./tsconfig.service.worker.json")],
  },
  // Service Worker Push Handler
  {
    input: "src/service-worker/push-handler.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "service-worker/push-handler.js",
      format: "esm",
      sourcemap: !isProduction,
      inlineDynamicImports: true,
    },
    onwarn,
    plugins: [...commonPlugins("./tsconfig.service.worker.json")],
  },
  // Service Worker Fetch Proxy
  {
    input: "src/service-worker/fetch-proxy.ts",
    output: {
      dir: "dist/public",
      entryFileNames: "service-worker/fetch-proxy.js",
      format: "esm",
      sourcemap: !isProduction,
      inlineDynamicImports: true,
    },
    onwarn,
    plugins: [...commonPlugins("./tsconfig.service.worker.json")],
  },
  // Server
  {
    input: "src/server/server.ts",
    output: {
      dir: "dist",
      entryFileNames: "server.js",
      format: "esm",
      sourcemap: !isProduction,
      inlineDynamicImports: true,
    },
    onwarn,
    external: [
      ...builtinModules,
      ...builtinModules.map((m) => `node:${m}`),
      "express",
      "compression",
      "cors",
      "express-urlrewrite",
      "tcp-port-used",
      "web-push",
      "electron",
    ],
    plugins: [
      nodeResolve({
        preferBuiltins: true,
      }),
      commonjs(),
      json(),
      esbuild({
        target: "node20",
        minify: false, // terser
        tsconfig: "./tsconfig.server.json",
      }),
      isProduction && terser(),
    ],
  },
  // Electron Main Process
  {
    input: "electron/main.ts",
    output: {
      dir: "dist/electron",
      entryFileNames: "main.cjs",
      format: "cjs",
      sourcemap: !isProduction,
      inlineDynamicImports: true,
    },
    onwarn,
    external: [
      ...builtinModules,
      ...builtinModules.map((m) => `node:${m}`),
      "electron",
      "express",
      "express-urlrewrite",
      "web-push",
      // add other native deps if needed
    ],
    plugins: [
      nodeResolve({
        preferBuiltins: true,
      }),
      commonjs(),
      json(),
      esbuild({
        target: "node20",
        minify: false,
        tsconfig: "./tsconfig.server.json",
      }),
      isProduction && terser(),
    ],
  },
];

export default configs;
