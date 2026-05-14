import fs from "node:fs";
import path from "node:path";

import type { Express } from "express";

interface RegisterActivityLogRoutesOptions {
  logsDir: string;
}

interface ActivityLogPayload {
  groupId?: string;
  level?: string;
  label?: string;
  message?: string;
  timestamp?: string;
  sessionStartedAt?: string;
}

function sanitizeGroupId(groupId: string): string {
  return groupId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function toFilenameIso(value: string): string {
  return value.replace(/:/g, "-");
}

function toIsoOrNow(value: string | undefined): string {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

export function registerActivityLogRoutes(
  app: Pick<Express, "post">,
  options: RegisterActivityLogRoutesOptions,
): void {
  app.post("/activity-log", (req, res) => {
    const payload = (req.body || {}) as ActivityLogPayload;
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";

    if (!message) {
      res.status(400).json({ error: "Missing activity log message" });

      return;
    }

    try {
      fs.mkdirSync(options.logsDir, { recursive: true });

      const sessionIso = toIsoOrNow(payload.sessionStartedAt);
      const fileIso = toFilenameIso(sessionIso);
      const groupId =
        typeof payload.groupId === "string" ? payload.groupId.trim() : "";

      const filename = groupId
        ? `${sanitizeGroupId(groupId)}__${fileIso}.log`
        : `${fileIso}.log`;

      const filePath = path.join(options.logsDir, filename);
      const lineTimestamp = toIsoOrNow(payload.timestamp);
      const level =
        typeof payload.level === "string" && payload.level
          ? payload.level
          : "info";
      const label =
        typeof payload.label === "string" && payload.label
          ? ` ${payload.label}`
          : "";
      const groupSegment = groupId ? ` [${groupId}]` : "";

      const line = `[${lineTimestamp}] [${level}]${groupSegment}${label}: ${message}\n`;
      fs.appendFileSync(filePath, line, "utf8");

      res.status(200).json({ ok: true, file: filename });
    } catch (error) {
      res.status(500).json({
        error: "Failed to write activity log",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
