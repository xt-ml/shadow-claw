import { defineConfig } from "rolldown";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

/**
 * Standalone Rolldown config for compiling src/cli to dist/cli.
 * Used by `npm run build:cli` and called automatically before `npm test`.
 * All Node built-ins and npm dependencies are kept external so that the
 * compiled output can be run directly by Node without bundling them.
 */
export default defineConfig({
  input: {
    cli: "src/cli/cli.ts",
    "build/build": "src/cli/build/build.ts",
    "tools/version": "src/cli/tools/version.ts",
    "tools/assert-version-bump": "src/cli/tools/assert-version-bump.ts",
    "prerender/dsd-shell/prerender-dsd-shell":
      "src/cli/prerender/dsd-shell/prerender-dsd-shell.ts",
    "tools/patch-service-worker-trusted-types":
      "src/cli/tools/patch-service-worker-trusted-types.ts",
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
    /^node:.*/,
    // npm dependencies used by the CLI — kept external so they resolve from
    // node_modules at runtime (works both for local dev and `npm install -g`).
    "commander",
    "express",
    "cors",
    "compression",
    "express-urlrewrite",
    "tcp-port-used",
    "web-push",
    "isomorphic-git",
    "gray-matter",
    "just-bash",
    "electron",
    "@aws-sdk/client-bedrock",
    "@aws-sdk/client-bedrock-runtime",
    "@aws-sdk/credential-providers",
    "@google/genai",
    "@huggingface/transformers",
    "@mcp-b/webmcp-polyfill",
    "@mcp-b/webmcp-types",
    "node-datachannel",
    "peer",
    "smart-buffer",
    "imapflow",
    "nodemailer",
    "marked",
    "dompurify",
  ],
  platform: "node",
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
  },
  transform: {
    tsconfig: true,
    target: "esnext",
    sourceMap: !isProduction,
  },
});
