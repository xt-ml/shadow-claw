import fs from "node:fs";
import path from "node:path";
import express from "express";
import type { Express } from "express";
import type { Logger } from "../logger.js";

interface RegisterCspReportRoutesOptions {
  logsDir: string;
  logger: Logger;
}

export function registerCspReportRoutes(
  app: Pick<Express, "post">,
  options: RegisterCspReportRoutesOptions,
): void {
  app.post(
    "/__cspreport",
    express.json({ type: ["application/json", "application/csp-report"] }),
    (req, res) => {
      try {
        fs.mkdirSync(options.logsDir, { recursive: true });

        const now = new Date();
        const isoString = now.toISOString();
        const fileIso = isoString.replace(/:/g, "-");
        const filename = `csp-reports__${fileIso}.log`;
        const filePath = path.join(options.logsDir, filename);

        const report = req.body || {};
        const line = `[${isoString}] [CSP-REPORT]: ${JSON.stringify(report)}\n`;

        fs.appendFileSync(filePath, line, "utf8");
        res.sendStatus(204);
      } catch (error) {
        options.logger.error(
          "DEFAULT",
          "Failed to write CSP report:",
          error instanceof Error ? error.message : String(error),
        );
        res.sendStatus(500);
      }
    },
  );
}
