import type { Express, Request, Response } from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export interface ModelCacheRouteOptions {
  cacheDir: string;
  transformersCacheDir?: string;
  additionalTransformersCacheDirs?: string[];
  shared?: boolean;
  allowUpstreamFetch?: boolean;
  fetchFn?: typeof fetch;
}

const VALID_HF_SUBPATH_RE =
  /^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)\/resolve\/([a-zA-Z0-9._-]+)\/(.+)$/;

function parseSafeHfSubpath(rawSubpath: string): {
  org: string;
  repo: string;
  revision: string;
  fileSegments: string[];
  normalizedSubpath: string;
} | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawSubpath);
  } catch {
    return null;
  }

  const trimmed = decoded.replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("\0") || trimmed.includes("\\")) {
    return null;
  }

  const match = VALID_HF_SUBPATH_RE.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, org, repo, revision, filePart] = match;
  if (
    org === "." ||
    org === ".." ||
    repo === "." ||
    repo === ".." ||
    revision === "." ||
    revision === ".."
  ) {
    return null;
  }

  const fileSegments = filePart.split("/");
  if (
    fileSegments.length === 0 ||
    fileSegments.some((s) => !s || s === "." || s === "..")
  ) {
    return null;
  }

  return {
    org,
    repo,
    revision,
    fileSegments,
    normalizedSubpath: `${org}/${repo}/resolve/${revision}/${fileSegments.join("/")}`,
  };
}

function resolveInsideRoot(rootDir: string, segments: string[]): string | null {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(root, ...segments);
  const rel = path.relative(root, candidate);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return candidate;
}

async function computeCacheStats(
  dir: string,
): Promise<{ fileCount: number; totalBytes: number }> {
  let fileCount = 0;
  let totalBytes = 0;

  async function walk(cur: string): Promise<void> {
    let entries;
    try {
      entries = await fsp.readdir(cur, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (
        entry.isFile() &&
        !entry.name.endsWith(".part") &&
        !entry.name.endsWith(".tmp")
      ) {
        try {
          const st = await fsp.stat(full);
          fileCount += 1;
          totalBytes += st.size;
        } catch {}
      }
    }
  }

  await walk(dir);
  return { fileCount, totalBytes };
}

function sendDiskFile(
  req: Request,
  res: Response,
  filePath: string,
  size: number,
  headOnly: boolean,
): void {
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Content-Type", "application/octet-stream");

  const rangeHeader = req.headers.range;
  if (typeof rangeHeader === "string" && rangeHeader.startsWith("bytes=")) {
    const [startRaw, endRaw] = rangeHeader.slice(6).split("-");
    const start = startRaw ? Number.parseInt(startRaw, 10) : 0;
    const end =
      endRaw !== undefined && endRaw !== ""
        ? Math.min(Number.parseInt(endRaw, 10), size - 1)
        : size - 1;

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      start >= size
    ) {
      res.status(416).setHeader("Content-Range", `bytes */${size}`).end();
      return;
    }

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", String(end - start + 1));

    if (headOnly) {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
    return;
  }

  res.status(200);
  res.setHeader("Content-Length", String(size));
  if (headOnly) {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

/**
 * Registers shared Hugging Face model cache mirror routes:
 * - `GET /model-cache/status`
 * - `HEAD /model-cache/hf/*`
 * - `GET /model-cache/hf/*`
 */
export function registerModelCacheRoutes(
  app: Express,
  options: ModelCacheRouteOptions,
): void {
  const rootCacheDir = path.resolve(options.cacheDir);
  const extraDirs = [
    ...(options.transformersCacheDir ? [options.transformersCacheDir] : []),
    ...(options.additionalTransformersCacheDirs || []),
  ]
    .map((d) => path.resolve(d))
    .filter((d, i, arr) => arr.indexOf(d) === i);
  const allowUpstreamFetch = options.allowUpstreamFetch !== false;
  const fetchImpl = options.fetchFn || globalThis.fetch;

  app.get("/model-cache/status", async (_req: Request, res: Response) => {
    const stats = await computeCacheStats(rootCacheDir);
    res.json({
      cacheDir: rootCacheDir,
      shared: Boolean(options.shared),
      ...stats,
    });
  });

  const handleHfRequest = async (req: Request, res: Response) => {
    const isHead = req.method.toUpperCase() === "HEAD";
    const prefix = "/model-cache/hf/";
    const idx = req.originalUrl.indexOf(prefix);
    const rawWithQuery =
      idx >= 0 ? req.originalUrl.slice(idx + prefix.length) : "";
    const [rawSubpath, queryString] = rawWithQuery.split("?");

    const parsed = parseSafeHfSubpath(rawSubpath);
    if (!parsed) {
      res.status(400).json({ error: "Invalid model cache path" });
      return;
    }

    const primaryPath = resolveInsideRoot(rootCacheDir, [
      "hf",
      parsed.org,
      parsed.repo,
      "resolve",
      parsed.revision,
      ...parsed.fileSegments,
    ]);
    if (!primaryPath) {
      res.status(400).json({ error: "Invalid model cache path" });
      return;
    }

    const candidates = [primaryPath];
    for (const extraDir of extraDirs) {
      const cliCandidate = resolveInsideRoot(extraDir, [
        parsed.org,
        parsed.repo,
        ...parsed.fileSegments,
      ]);
      if (cliCandidate) {
        candidates.push(cliCandidate);
      }
    }

    for (const candidate of candidates) {
      let st: fs.Stats | null = null;
      try {
        st = await fsp.stat(candidate);
      } catch {}

      if (st && st.isFile() && st.size > 0) {
        sendDiskFile(req, res, candidate, st.size, isHead);
        return;
      }
    }

    if (isHead || !allowUpstreamFetch || typeof fetchImpl !== "function") {
      res.status(404).json({ error: "Model file not found in shared cache" });
      return;
    }

    const upstreamUrl = `https://huggingface.co/${parsed.normalizedSubpath}${queryString ? `?${queryString}` : ""}`;
    try {
      const upstreamRes = await fetchImpl(upstreamUrl, {
        headers:
          typeof req.headers.range === "string"
            ? { Range: req.headers.range }
            : undefined,
      });

      if (!upstreamRes.ok || !upstreamRes.body) {
        res.status(upstreamRes.status || 502).json({
          error: `Upstream model fetch failed: ${upstreamRes.status}`,
        });
        return;
      }

      const contentLength = upstreamRes.headers.get("content-length");
      const contentType =
        upstreamRes.headers.get("content-type") || "application/octet-stream";

      res.status(upstreamRes.status);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", contentType);
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      const isFullResponse = upstreamRes.status === 200;
      const partPath = `${primaryPath}.part`;
      let fileStream: fs.WriteStream | null = null;

      if (isFullResponse) {
        await fsp.mkdir(path.dirname(primaryPath), { recursive: true });
        fileStream = fs.createWriteStream(partPath);
      }

      const reader = upstreamRes.body.getReader();
      let pendingChunk: Uint8Array | null = null;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (value && value.byteLength > 0) {
            const copy = new Uint8Array(value);
            if (fileStream) {
              fileStream.write(copy);
            }
            if (pendingChunk) {
              res.write(pendingChunk);
            }
            pendingChunk = copy;
          }
        }
        if (fileStream) {
          await new Promise<void>((resolve, reject) => {
            fileStream!.once("error", reject);
            fileStream!.end(() => resolve());
          });
          await fsp.rename(partPath, primaryPath);
        }
        if (pendingChunk) {
          res.write(pendingChunk);
        }
        res.end();
      } catch (streamErr) {
        if (fileStream) {
          fileStream.destroy();
          await fsp.unlink(partPath).catch(() => {});
        }
        if (!res.headersSent) {
          res.status(502).json({
            error:
              streamErr instanceof Error
                ? streamErr.message
                : String(streamErr),
          });
        } else {
          res.end();
        }
      }
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).json({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  app.head("/model-cache/hf/{*subpath}", handleHfRequest);
  app.get("/model-cache/hf/{*subpath}", handleHfRequest);
}
