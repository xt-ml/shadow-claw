import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const HASHED_CHUNK_RE = /^[^/]+-[A-Za-z0-9_-]{8}\.js$/;
const EXCLUDED_PRECACHE_CHUNK_RE =
  /^(?:webllm-|transformers-|pdf\.worker\.js$|agent\.worker\.js$|transformers-js\.worker\.js$|workbox-|shadow-claw-pdf-viewer-|shadow-claw-terminal-|v86)/;

const STATIC_LOCAL_JS_IMPORT_RE =
  /\b(?:import|export)\s*(?:[^"';()`]*?\s*from\s*)?["']\.\/([^"'/\s]+\.js)["']/g;
const DYNAMIC_LOCAL_JS_IMPORT_RE =
  /\bimport\s*\(\s*["'`]\.\/([^"'`/\s]+\.js)["'`]\s*\)/g;

const SHELL_ROOT_RE = /^shadow-claw-[A-Za-z0-9_-]{8}\.js$/;
const SETTINGS_ROOT_RE = /^shadow-claw-settings-[A-Za-z0-9_-]{8}\.js$/;
const PAGES_ROOT_RE = /^shadow-claw-pages-[A-Za-z0-9_-]{8}\.js$/;

/**
 * Returns true if `relPath` is a top-level content-hashed Rolldown JS chunk
 * (excluding Workbox's own runtime bundle).
 */
export function isHashedJsChunk(relPath: string): boolean {
  const normalized = relPath.replace(/^\/+/, "");
  return HASHED_CHUNK_RE.test(normalized) && !/^workbox-/.test(normalized);
}

/**
 * Returns true if `relPath` belongs to a heavy optional runtime, worker,
 * Workbox library, or excluded optional viewer/terminal chunk.
 */
export function isExcludedPrecacheChunk(relPath: string): boolean {
  const normalized = relPath.replace(/^\/+/, "");
  return EXCLUDED_PRECACHE_CHUNK_RE.test(normalized);
}

function extractMatches(source: string, pattern: RegExp): string[] {
  pattern.lastIndex = 0;
  const seen = new Set<string>();
  for (const match of source.matchAll(pattern)) {
    const fileName = match[1];
    if (fileName) {
      seen.add(fileName);
    }
  }
  return [...seen];
}

/**
 * Extracts unique top-level relative JS files referenced by static `import` or
 * `export ... from` statements in ESM bundle source.
 */
export function extractStaticLocalJsImports(source: string): string[] {
  return extractMatches(source, STATIC_LOCAL_JS_IMPORT_RE);
}

/**
 * Extracts unique top-level relative JS files referenced by dynamic `import("./...")`
 * expressions in ESM bundle source.
 */
export function extractDynamicLocalJsImports(source: string): string[] {
  return extractMatches(source, DYNAMIC_LOCAL_JS_IMPORT_RE);
}

function shouldFollowDynamicImports(fileName: string): boolean {
  return (
    fileName === "index.js" ||
    SHELL_ROOT_RE.test(fileName) ||
    SETTINGS_ROOT_RE.test(fileName) ||
    PAGES_ROOT_RE.test(fileName)
  );
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

/**
 * Walks the compiled frontend module graph starting from `index.js` in
 * `distPublicDir` to collect the core shell, sidebar tabs, and settings
 * sub-panel chunks needed for an atomic precache snapshot.
 */
export async function collectPrecacheShellChunks(
  distPublicDir: string,
): Promise<string[]> {
  if (!(await isRegularFile(join(distPublicDir, "index.js")))) {
    return [];
  }

  const queue: string[] = ["index.js"];
  const visited = new Set<string>();
  const discovered = new Set<string>();

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file) || isExcludedPrecacheChunk(file)) {
      continue;
    }

    const fullPath = join(distPublicDir, file);
    if (!(await isRegularFile(fullPath))) {
      continue;
    }

    visited.add(file);
    if (file !== "index.js") {
      discovered.add(file);
    }

    const source = await readFile(fullPath, "utf8");
    for (const dep of extractStaticLocalJsImports(source)) {
      if (!visited.has(dep) && !isExcludedPrecacheChunk(dep)) {
        queue.push(dep);
      }
    }

    if (shouldFollowDynamicImports(file)) {
      for (const dep of extractDynamicLocalJsImports(source)) {
        if (!visited.has(dep) && !isExcludedPrecacheChunk(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  return [...discovered].sort();
}
