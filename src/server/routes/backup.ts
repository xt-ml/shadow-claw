/**
 * ShadowClaw — Backup REST Routes
 *
 * Provides endpoints for uploading workspace files from connected clients
 * (e.g. iPad, remote browsers) to the server filesystem and tracking
 * backup manifests in SQLite.
 */

import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import type { Express, Request, Response, NextFunction } from "express";
import {
  getOrCreateControlToken,
  recordBackup,
  listBackups,
  deleteBackup,
} from "../client-registry.js";

export interface BackupRoutesOptions {
  backupsDir: string;
  token?: string;
  allowedOrigins?: Set<string>;
  corsMode?: "localhost" | "private" | "all";
}

function isSafeRelativePath(relPath: string): boolean {
  if (!relPath || typeof relPath !== "string") {
    return false;
  }
  const normalized = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, "");
  if (
    path.isAbsolute(relPath) ||
    relPath.startsWith("..") ||
    normalized !== relPath
  ) {
    return false;
  }
  return true;
}

function isSameOriginBrowser(
  req: Request,
  options?: BackupRoutesOptions,
): boolean {
  const host = req.headers.host || "127.0.0.1";
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const isTrustedUrl = (urlStr: string): boolean => {
    try {
      const parsed = new URL(urlStr);
      if (parsed.host === host) {
        return true;
      }

      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === "127.0.0.1" ||
        hostname === "localhost" ||
        hostname === "::1" ||
        hostname === "[::1]"
      ) {
        return true;
      }

      if (
        hostname === "github.com" ||
        hostname.endsWith(".github.io") ||
        hostname.endsWith(".pages.dev")
      ) {
        return true;
      }

      if (options?.corsMode === "all") {
        return true;
      }

      if (
        options?.allowedOrigins &&
        options.allowedOrigins.has(parsed.origin)
      ) {
        return true;
      }

      if (
        options?.corsMode === "private" &&
        /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)
      ) {
        return true;
      }
    } catch (_) {}
    return false;
  };

  if (origin && isTrustedUrl(origin)) {
    return true;
  }

  if (referer && isTrustedUrl(referer)) {
    return true;
  }

  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
    return true;
  }

  return false;
}

export function registerBackupRoutes(
  app: Express,
  options: BackupRoutesOptions,
): void {
  const { backupsDir } = options;
  const token = options.token || getOrCreateControlToken();

  // Authentication middleware
  const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const host = req.headers.host || "127.0.0.1";
    const parsedUrl = new URL(req.url, `http://${host}`);
    const queryToken = parsedUrl.searchParams.get("token");
    const headerToken = req.headers["x-control-token"];
    const authHeader = req.headers["authorization"];
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;

    const providedToken = queryToken || headerToken || bearerToken;

    const isAuthValid = providedToken
      ? providedToken === token
      : isSameOriginBrowser(req, options);

    if (!isAuthValid) {
      res.status(401).json({ error: "Unauthorized: Invalid control token" });
      return;
    }
    next();
  };

  /**
   * Upload a single file into a backup snapshot.
   */
  app.post(
    "/api/backup/upload",
    authMiddleware,
    (req: Request, res: Response) => {
      const {
        clientId,
        backupId,
        path: filePath,
        content,
        encoding,
      } = req.body || {};

      if (!clientId || !backupId || !filePath) {
        res
          .status(400)
          .json({ error: "clientId, backupId, and path are required" });
        return;
      }

      if (!isSafeRelativePath(filePath)) {
        res.status(400).json({ error: `Invalid path: ${filePath}` });
        return;
      }

      const clientDir = path.resolve(backupsDir, clientId, backupId);
      const targetFile = path.resolve(clientDir, filePath);

      // Guard against directory traversal
      if (
        !targetFile.startsWith(clientDir + path.sep) &&
        targetFile !== clientDir
      ) {
        res.status(400).json({ error: `Invalid path: ${filePath}` });
        return;
      }

      try {
        const parentDir = path.dirname(targetFile);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        const buffer =
          encoding === "base64"
            ? Buffer.from(content || "", "base64")
            : Buffer.from(content || "", "utf-8");

        fs.writeFileSync(targetFile, buffer);

        res.json({
          success: true,
          path: filePath,
          bytesWritten: buffer.length,
        });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to write file: ${err.message}` });
      }
    },
  );

  /**
   * Finalize and record a backup snapshot.
   */
  app.post(
    "/api/backup/complete",
    authMiddleware,
    (req: Request, res: Response) => {
      const { clientId, backupId, fileCount, totalBytes, manifest } =
        req.body || {};

      if (!clientId || !backupId) {
        res.status(400).json({ error: "clientId and backupId are required" });
        return;
      }

      try {
        const record = recordBackup({
          id: backupId,
          clientId,
          fileCount: Number(fileCount) || 0,
          totalBytes: Number(totalBytes) || 0,
          manifest,
        });

        res.json({
          success: true,
          backupId: record.id,
          clientId: record.clientId,
          timestamp: record.timestamp,
          fileCount: record.fileCount,
          totalBytes: record.totalBytes,
        });
      } catch (err: any) {
        res
          .status(500)
          .json({ error: `Failed to complete backup: ${err.message}` });
      }
    },
  );

  /**
   * List backups for a client.
   */
  app.get("/api/backup/list", authMiddleware, (req: Request, res: Response) => {
    const clientId = (req.query.clientId as string) || undefined;
    const backups = listBackups(clientId);
    res.json({ backups });
  });

  /**
   * Delete a backup snapshot.
   */
  app.delete(
    "/api/backup/:id",
    authMiddleware,
    (req: Request, res: Response) => {
      const backupId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const clientId =
        (req.query.clientId as string) || (req.body?.clientId as string);

      if (!backupId) {
        res.status(400).json({ error: "Backup id is required" });
        return;
      }

      try {
        if (clientId) {
          const snapshotDir = path.resolve(backupsDir, clientId, backupId);
          if (fs.existsSync(snapshotDir)) {
            fs.rmSync(snapshotDir, { recursive: true, force: true });
          }
        }

        deleteBackup(backupId, clientId);
        res.json({ success: true, deleted: backupId });
      } catch (err: any) {
        res
          .status(500)
          .json({ error: `Failed to delete backup: ${err.message}` });
      }
    },
  );
}
