import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join, posix, relative } from "node:path";

import { insertBeforeClosingHead } from "../../prerender/utils/insert-before-closing-head.js";

const HASHED_CHUNK_RE = /-[A-Za-z0-9_-]{8}\.js$/;
const IMPORT_MAP_SCRIPT_RE =
  /[ \t]*<script\b[^>]*\btype=["']?importmap["']?[^>]*>[\s\S]*?<\/script>\r?\n?/giu;
const FIRST_MODULE_SCRIPT_RE = /<script\b[^>]*\btype=["']?module["']?[^>]*>/iu;

function normalizeBasePath(basePath = "/"): string {
  let normalized = (basePath || "/").trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (!normalized.endsWith("/")) {
    normalized = `${normalized}/`;
  }
  return normalized;
}

/**
 * Collects stable (non-hashed) `.js` entry module paths relative to `dist/lib`.
 */
export async function collectLibEntryPaths(libDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        if (HASHED_CHUNK_RE.test(entry.name)) {
          continue;
        }
        const relPath = relative(libDir, fullPath).replace(/\\/g, "/");
        results.push(relPath);
      }
    }
  }

  await walk(libDir);
  results.sort();
  return results;
}

/**
 * Builds an import map pointing `shadow-claw` package specifiers to local `/lib/` bundles.
 */
export function buildLocalLibImportMap(
  basePath = "/",
  entryRelPaths: string[] = [],
): Record<string, string> {
  const libBase = posix.join(normalizeBasePath(basePath), "lib/");
  const imports: Record<string, string> = {
    "shadow-claw": `${libBase}index.js`,
    "shadow-claw/": libBase,
    "shadow-claw/components": `${libBase}components/index.js`,
    "shadow-claw/components/": `${libBase}components/`,
    "shadow-claw/utils": `${libBase}utils/index.js`,
    "shadow-claw/utils/": `${libBase}utils/`,
    "shadow-claw/signals": `${libBase}utils/signals.js`,
  };

  for (const rawRel of entryRelPaths) {
    const rel = rawRel.replace(/^\/+/, "");
    if (!rel.endsWith(".js") || rel === "index.js") {
      continue;
    }
    if (rel === "components/index.js" || rel === "utils/index.js") {
      continue;
    }

    const withExt = `shadow-claw/${rel}`;
    const withoutExt = withExt.replace(/\.js$/, "");
    imports[withoutExt] = `${libBase}${rel}`;
    imports[withExt] = `${libBase}${rel}`;
  }

  return imports;
}

/**
 * Builds an import map pointing `shadow-claw` package specifiers to CDN `/dist/lib/` bundles.
 */
export function buildCdnLibImportMap(cdnBase: string): Record<string, string> {
  const cleanCdn = cdnBase.replace(/\/+$/, "");
  const libBase = `${cleanCdn}/dist/lib/`;
  return {
    "shadow-claw": `${libBase}index.js`,
    "shadow-claw/": `${cleanCdn}/`,
    "shadow-claw/components": `${libBase}components/index.js`,
    "shadow-claw/components/": `${libBase}components/`,
    "shadow-claw/utils": `${libBase}utils/index.js`,
    "shadow-claw/utils/": `${libBase}utils/`,
    "shadow-claw/signals": `${libBase}utils/signals.js`,
  };
}

export interface InjectLibImportMapOptions {
  kind?: "local" | "cdn";
  nonce?: string;
}

/**
 * Injects or replaces `<script type="importmap">` in HTML, always placed before
 * the first `<script type="module">` element in `<head>` (or before `</head>`).
 */
export function injectLibImportMap(
  html: string,
  imports: Record<string, string>,
  options: InjectLibImportMapOptions = {},
): string {
  const kindAttr =
    options.kind === "cdn" ? "" : ' data-shadow-claw-importmap="local"';
  const nonceAttr = options.nonce ? ` nonce="${options.nonce}"` : "";
  const formattedJson = JSON.stringify({ imports }, null, 2)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

  const importMapTag = [
    `  <script type="importmap"${kindAttr}${nonceAttr}>`,
    formattedJson,
    `  </script>`,
  ].join("\n");

  const stripped = html.replace(IMPORT_MAP_SCRIPT_RE, "");

  const moduleMatch = FIRST_MODULE_SCRIPT_RE.exec(stripped);
  const headCloseIdx = stripped.search(/<\/head>/iu);

  if (
    moduleMatch &&
    moduleMatch.index !== undefined &&
    (headCloseIdx === -1 || moduleMatch.index < headCloseIdx)
  ) {
    return (
      stripped.slice(0, moduleMatch.index) +
      importMapTag +
      "\n" +
      stripped.slice(moduleMatch.index)
    );
  }

  return insertBeforeClosingHead(stripped, importMapTag);
}

export interface CopyLibToPublicOptions {
  isProduction?: boolean;
}

/**
 * Copies runtime `.js` modules from `dist/lib` into `dist/public/lib`,
 * omitting TypeScript declaration artifacts (`.d.ts`, `.d.ts.map`) and
 * omitting `.js.map` source maps in production builds.
 */
export async function copyLibToPublic(
  srcLibDir: string,
  destLibDir: string,
  options: CopyLibToPublicOptions = {},
): Promise<void> {
  const isProduction = Boolean(options.isProduction);
  await rm(destLibDir, { recursive: true, force: true });
  await mkdir(destLibDir, { recursive: true });
  await cp(srcLibDir, destLibDir, {
    recursive: true,
    force: true,
    filter: (src) => {
      if (src.endsWith(".d.ts") || src.endsWith(".d.ts.map")) {
        return false;
      }
      if (isProduction && src.endsWith(".js.map")) {
        return false;
      }
      return true;
    },
  });
}
