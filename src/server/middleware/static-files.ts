import fs from "node:fs";
import path from "node:path";
import express from "express";
import expressUrlrewrite from "express-urlrewrite";
import type { Request, Response, NextFunction, Express } from "express";

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
        return next();
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
