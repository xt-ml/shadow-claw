import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  collectPrecacheShellChunks,
  isHashedJsChunk,
} from "./collect-precache-shell-chunks.js";

interface PrecacheEntry {
  url: string;
  revision?: string | null;
}

const WORKSPACE_DIGEST_DIRS = [
  ".agents/scripts",
  ".agents/tools",
  ".agents/skills",
];

async function collectFilesRecursively(
  dirPath: string,
  baseDir: string,
  results: string[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await collectFilesRecursively(fullPath, baseDir, results);
    } else if (entry.isFile()) {
      results.push(relative(baseDir, fullPath).replace(/\\/g, "/"));
    }
  }
}

/**
 * Computes a deterministic digest over workspace runtime assets (`.agents/*`
 * and `static-main-manifest.json`) so changes to consumer scripts/tools/skills
 * invalidate the precached `index.html` revision even when HTML is identical.
 */
export async function computeDistWorkspaceDigest(
  distPublicDir: string,
): Promise<string> {
  const fileRelPaths: string[] = [];

  for (const relDir of WORKSPACE_DIGEST_DIRS) {
    await collectFilesRecursively(
      join(distPublicDir, relDir),
      distPublicDir,
      fileRelPaths,
    );
  }

  try {
    const manifestStat = await stat(
      join(distPublicDir, "static-main-manifest.json"),
    );
    if (manifestStat.isFile()) {
      fileRelPaths.push("static-main-manifest.json");
    }
  } catch {
    // static-main-manifest.json is optional
  }

  if (fileRelPaths.length === 0) {
    return "";
  }

  fileRelPaths.sort();
  const hash = createHash("sha256");
  for (const relPath of fileRelPaths) {
    const bytes = await readFile(join(distPublicDir, relPath));
    hash.update(relPath);
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }

  return hash.digest("hex");
}

function findPrecacheArrayBounds(
  source: string,
): { start: number; end: number } | null {
  const callMarker = "precacheAndRoute(";
  const callIdx = source.indexOf(callMarker);
  if (callIdx === -1) {
    return null;
  }

  let i = callIdx + callMarker.length;
  while (i < source.length && /\s/.test(source[i])) {
    i++;
  }
  if (source[i] !== "[") {
    return null;
  }

  const start = i;
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0) {
        return { start, end: i };
      }
    }
  }

  return null;
}

function parsePrecacheArrayLiteral(rawArray: string): PrecacheEntry[] | null {
  let out = "";
  let quote: string | null = null;
  let escaped = false;
  let lastDelimiter = "";

  for (let i = 0; i < rawArray.length; i++) {
    const ch = rawArray[i];
    if (quote) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"') {
      quote = '"';
      out += ch;
      lastDelimiter = "";
      continue;
    }

    if (
      (lastDelimiter === "{" || lastDelimiter === ",") &&
      /[A-Za-z_$]/.test(ch)
    ) {
      const rest = rawArray.slice(i);
      const keyMatch = rest.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*:/);
      if (keyMatch) {
        out += JSON.stringify(keyMatch[1]);
        i += keyMatch[1].length - 1;
        lastDelimiter = "";
        continue;
      }
    }

    out += ch;
    if (ch === "{" || ch === ",") {
      lastDelimiter = ch;
    } else if (!/\s/.test(ch)) {
      lastDelimiter = "";
    }
  }

  try {
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const INDEX_REVISION_STMT_RE =
  /self\.__SHADOWCLAW_PRECACHE_INDEX_REVISION__\s*=\s*"[^"]*";?/;

async function buildPrecacheEntry(
  distPublicDir: string,
  entryUrl: string,
  cleanUrl: string,
  workspaceDigest: string,
): Promise<PrecacheEntry | null> {
  const targetPath = join(distPublicDir, cleanUrl);
  try {
    const targetStat = await stat(targetPath);
    if (!targetStat.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  if (isHashedJsChunk(cleanUrl)) {
    return {
      url: entryUrl,
      revision: null,
    };
  }

  const fileBytes = await readFile(targetPath);
  const md5 = createHash("md5").update(fileBytes);
  if (cleanUrl === "index.html" && workspaceDigest) {
    md5.update(workspaceDigest);
  }

  return {
    url: entryUrl,
    revision: md5.digest("hex"),
  };
}

/**
 * Updates `precacheAndRoute([...])` revisions inside `service-worker.js` using
 * the actual files in `distPublicDir` (plus `computeDistWorkspaceDigest` for
 * `index.html`), merges core shell/sidebar/settings chunks, removes entries
 * whose files do not exist, and stamps the active `index.html` revision.
 */
export async function syncServiceWorkerPrecacheRevisions(
  distPublicDir: string,
  swPath: string = join(distPublicDir, "service-worker.js"),
): Promise<boolean> {
  let source: string;
  try {
    source = await readFile(swPath, "utf8");
  } catch {
    return false;
  }

  const bounds = findPrecacheArrayBounds(source);
  if (!bounds) {
    return false;
  }

  const entries = parsePrecacheArrayLiteral(
    source.slice(bounds.start, bounds.end + 1),
  );
  if (!entries) {
    return false;
  }

  const workspaceDigest = await computeDistWorkspaceDigest(distPublicDir);
  const shellChunks = await collectPrecacheShellChunks(distPublicDir);
  const seenUrls = new Set<string>();
  const nextEntries: PrecacheEntry[] = [];
  let indexRevision = "";

  for (const entry of entries) {
    if (!entry || typeof entry.url !== "string" || !entry.url.trim()) {
      continue;
    }

    const cleanUrl = entry.url.replace(/^\/+/, "");
    if (seenUrls.has(cleanUrl)) {
      continue;
    }

    const nextEntry = await buildPrecacheEntry(
      distPublicDir,
      entry.url,
      cleanUrl,
      workspaceDigest,
    );
    if (!nextEntry) {
      continue;
    }

    seenUrls.add(cleanUrl);
    nextEntries.push(nextEntry);
    if (cleanUrl === "index.html" && typeof nextEntry.revision === "string") {
      indexRevision = nextEntry.revision;
    }
  }

  for (const chunkUrl of shellChunks) {
    const cleanUrl = chunkUrl.replace(/^\/+/, "");
    if (seenUrls.has(cleanUrl)) {
      continue;
    }

    const nextEntry = await buildPrecacheEntry(
      distPublicDir,
      chunkUrl,
      cleanUrl,
      workspaceDigest,
    );
    if (!nextEntry) {
      continue;
    }

    seenUrls.add(cleanUrl);
    nextEntries.push(nextEntry);
  }

  const nextArray = JSON.stringify(nextEntries);
  let nextSource =
    source.slice(0, bounds.start) + nextArray + source.slice(bounds.end + 1);

  if (indexRevision) {
    const revisionStmt = `self.__SHADOWCLAW_PRECACHE_INDEX_REVISION__=${JSON.stringify(indexRevision)};`;
    if (INDEX_REVISION_STMT_RE.test(nextSource)) {
      nextSource = nextSource.replace(INDEX_REVISION_STMT_RE, revisionStmt);
    } else {
      nextSource = `${nextSource}\n${revisionStmt}`;
    }
  }

  if (nextSource === source) {
    return false;
  }

  await writeFile(swPath, nextSource, "utf8");
  return true;
}
