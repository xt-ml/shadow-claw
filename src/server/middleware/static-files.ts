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

  const fetchDest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();
  if (fetchDest && fetchDest !== "document") {
    return false;
  }

  const fetchMode = String(req.headers["sec-fetch-mode"] || "").toLowerCase();
  const fetchUser = String(req.headers["sec-fetch-user"] || "").toLowerCase();
  const isNavigationFetch =
    fetchDest === "document" || fetchMode === "navigate" || fetchUser === "?1";

  const accept = String(req.headers.accept || "");
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

export function registerStaticFilesMiddleware(app: Express, rootPath: string) {
  app.use(expressUrlrewrite(/^(.+)\/index\.html$/, "$1/"));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestPath = new URL(req.originalUrl, "http://localhost").pathname;
    const isWebVMAsset =
      requestPath.startsWith("/assets/v86.9pfs/") ||
      requestPath.startsWith("/assets/v86.ext2/");

    if (isWebVMAsset) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "no-cache");
    }

    const filePath = path.join(rootPath, req.url);
    fs.stat(filePath, (err, stats) => {
      if (err || !stats) {
        if (isSpaShellRequest(req, requestPath)) {
          res.sendFile(path.join(rootPath, "index.html"));

          return;
        }

        next();

        return;
      }

      if (stats.isDirectory()) {
        const indexPath = path.join(filePath, "index.html");
        fs.access(indexPath, fs.constants.F_OK, (err2) => {
          if (!err2) {
            res.sendFile(indexPath);
          } else {
            next();
          }
        });
      } else {
        res.sendFile(filePath);
      }
    });
  });

  app.use(express.static(rootPath, { etag: true }));
}
