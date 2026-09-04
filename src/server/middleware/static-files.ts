import fs from "node:fs";
import path from "node:path";
import express from "express";
import expressUrlrewrite from "express-urlrewrite";
import type { Request, Response, NextFunction, Express } from "express";

const SPA_ROUTE_PREFIXES = new Set([
  "chat",
  "files",
  "pages",
  "tasks",
  "settings",
  "tools",
  "channels",
]);

function isSpaShellRequest(req: Request, pathname: string): boolean {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }

  const headers = req.headers || {};
  const fetchDest = String(headers["sec-fetch-dest"] || "").toLowerCase();
  if (fetchDest && fetchDest !== "document") {
    return false;
  }

  const fetchMode = String(headers["sec-fetch-mode"] || "").toLowerCase();
  const fetchUser = String(headers["sec-fetch-user"] || "").toLowerCase();
  const isNavigationFetch =
    fetchDest === "document" || fetchMode === "navigate" || fetchUser === "?1";

  const accept = String(headers.accept || "");
  if (!isNavigationFetch && !accept.includes("text/html")) {
    return false;
  }

  const normalized = pathname.replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return false;
  }

  const firstSegment = normalized.split("/", 1)[0] || "";

  return SPA_ROUTE_PREFIXES.has(firstSegment);
}

const ALLOWED_ROOT_DOT_DIRS = new Set([".well-known", ".agents"]);

function isAllowedDotFileRequest(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const dotSegments = segments.filter(
    (segment) => segment.length > 0 && segment.startsWith("."),
  );

  if (dotSegments.length === 0) {
    return true;
  }

  if (dotSegments.length !== 1) {
    return false;
  }

  const singleDot = dotSegments[0];
  if (!ALLOWED_ROOT_DOT_DIRS.has(singleDot)) {
    return false;
  }

  return segments[0] === singleDot || segments[1] === singleDot;
}

function hasAllowedDotSegment(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return (
    (segments.length > 0 && ALLOWED_ROOT_DOT_DIRS.has(segments[0])) ||
    (segments.length > 1 && ALLOWED_ROOT_DOT_DIRS.has(segments[1]))
  );
}

export function registerStaticFilesMiddleware(app: Express, rootPath: string) {
  app.use(expressUrlrewrite(/^(.+)\/index\.html$/, "$1/"));

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

    const requestPath = new URL(req.originalUrl, "http://localhost").pathname;
    if (!isAllowedDotFileRequest(requestPath)) {
      next();
      return;
    }

    const sendFileOptions = hasAllowedDotSegment(requestPath)
      ? { dotfiles: "allow" as const }
      : undefined;

    const isWebVMAsset =
      requestPath.startsWith("/assets/v86.9pfs/") ||
      requestPath.startsWith("/assets/v86.ext2/");

    if (isWebVMAsset) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "no-cache");
    }

    const urlPathname = new URL(req.url || "/", "http://localhost").pathname;
    const filePath = path.join(rootPath, urlPathname);
    fs.stat(filePath, (err, stats) => {
      if (err || !stats) {
        if (isSpaShellRequest(req, requestPath)) {
          res.sendFile(path.join(rootPath, "index.html"));

          return;
        }

        // Check if request has a subpath prefix matching a root file (e.g. /shadow-claw/index.js -> /index.js)
        const strippedSegmentPath = requestPath.replace(/^\/[^/]+/, "");
        if (strippedSegmentPath) {
          const strippedFilePath = path.join(rootPath, strippedSegmentPath);
          try {
            if (
              fs.existsSync(strippedFilePath) &&
              fs.statSync(strippedFilePath).isFile()
            ) {
              const strippedOptions = hasAllowedDotSegment(strippedSegmentPath)
                ? { dotfiles: "allow" as const }
                : undefined;
              if (strippedOptions) {
                res.sendFile(strippedFilePath, strippedOptions);
              } else {
                res.sendFile(strippedFilePath);
              }

              return;
            }
          } catch {}
        }

        if (requestPath.startsWith("/files/main/")) {
          const fallbackPath = path.resolve(
            "pages/main",
            requestPath.slice("/files/main/".length),
          );
          fs.stat(fallbackPath, (fallbackErr, fallbackStats) => {
            if (!fallbackErr && fallbackStats && fallbackStats.isFile()) {
              res.sendFile(fallbackPath);

              return;
            }

            next();
          });

          return;
        }

        if (requestPath.startsWith("/static-main/")) {
          const fallbackPath = path.resolve(
            "pages/main",
            requestPath.slice("/static-main/".length),
          );
          fs.stat(fallbackPath, (fallbackErr, fallbackStats) => {
            if (!fallbackErr && fallbackStats && fallbackStats.isFile()) {
              res.sendFile(fallbackPath);

              return;
            }

            next();
          });

          return;
        }

        if (requestPath.startsWith("/pages/")) {
          const fallbackPath = path.resolve(
            "pages",
            requestPath.slice("/pages/".length),
          );
          fs.stat(fallbackPath, (fallbackErr, fallbackStats) => {
            if (!fallbackErr && fallbackStats && fallbackStats.isFile()) {
              res.sendFile(fallbackPath);

              return;
            }

            next();
          });

          return;
        }

        next();

        return;
      }

      if (stats.isDirectory()) {
        const indexPath = path.join(filePath, "index.html");
        fs.access(indexPath, fs.constants.F_OK, (err2) => {
          if (!err2) {
            if (sendFileOptions) {
              res.sendFile(indexPath, sendFileOptions);
            } else {
              res.sendFile(indexPath);
            }
          } else {
            next();
          }
        });
      } else {
        if (sendFileOptions) {
          res.sendFile(filePath, sendFileOptions);
        } else {
          res.sendFile(filePath);
        }
      }
    });
  });

  app.use(express.static(rootPath, { etag: true }));
}
