import compression from "compression";
import express from "express";
import fs from "node:fs";
import path from "node:path";

import {
  broadcastPush,
  registerPushRoutes,
} from "../subsystems/notifications/push-routes.js";
import { openPushStore } from "../subsystems/notifications/push-store.js";

import { registerTaskScheduleRoutes } from "../subsystems/notifications/task-schedule-routes.js";
import {
  getEnabledScheduledTasks,
  openTaskScheduleStore,
  updateScheduledTaskLastRun,
} from "../subsystems/notifications/task-schedule-store.js";
import { ServerTaskScheduler } from "../subsystems/notifications/task-scheduler-server.js";

import { createLogger } from "./logger.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { createCspReportOnlyMiddleware } from "./middleware/csp.js";
import { createPnaMiddleware } from "./middleware/pna.js";
import { createRequestLoggerMiddleware } from "./middleware/request-logger.js";

import { registerStaticFilesMiddleware } from "./middleware/static-files.js";
import { registerProxyRoutes } from "./proxy.js";
import { registerActivityLogRoutes } from "./routes/activity-log.js";
import { registerCspReportRoutes } from "./routes/csp-report.js";
import { registerOAuthRoutes } from "./routes/oauth.js";

import type { Express } from "express";
import type { ServerConfig } from "./config.js";

export function createApp(config: ServerConfig): {
  app: Express;
  scheduler: ServerTaskScheduler;
} {
  const app = express();
  const logger = createLogger(config.verbose);
  const { verbose } = config;

  // ---------------- REQUEST LOGGER MIDDLEWARE ----------------
  app.use(createRequestLoggerMiddleware(logger, verbose));

  // ---------------- PRIVATE NETWORK ACCESS (PNA) SUPPORT ----------------
  app.use(createPnaMiddleware(logger, verbose));

  // ---------------- CORS ----------------
  app.use(createCorsMiddleware(config, logger, verbose));

  // ---------------- SECURITY HEADERS (REPORT-ONLY) ----------------
  app.use(createCspReportOnlyMiddleware());

  // ---------------- PARSERS & COMPRESSION ----------------
  app.use(
    compression({
      filter(req, res) {
        if (res.getHeader("Content-Type") === "text/event-stream") {
          return false;
        }

        return compression.filter(req, res);
      },
    }),
  );

  app.use(express.json({ limit: "1000mb" }));

  // ---------------- PROXY ROUTES ----------------
  registerProxyRoutes(app, { verbose });

  // ---------------- OAUTH ROUTES ----------------
  registerOAuthRoutes(app);

  // ---------------- ACTIVITY LOG ROUTES ----------------
  registerActivityLogRoutes(app, {
    logsDir: path.resolve(config.databaseDir, "..", ".cache", "logs"),
  });

  // ---------------- CSP REPORT ROUTES ----------------
  registerCspReportRoutes(app, {
    logsDir: path.resolve(config.databaseDir, "..", ".cache", "logs"),
    logger,
  });

  // ---------------- DATABASE & PUSH / TASKS ----------------
  if (!fs.existsSync(config.databaseDir)) {
    fs.mkdirSync(config.databaseDir, { recursive: true });
  }

  openPushStore(path.join(config.databaseDir, "push-subscriptions.db"));
  registerPushRoutes(app);

  openTaskScheduleStore(path.join(config.databaseDir, "scheduled-tasks.db"));
  registerTaskScheduleRoutes(app);

  const scheduler = new ServerTaskScheduler({
    getEnabledTasks: getEnabledScheduledTasks,
    updateLastRun: updateScheduledTaskLastRun,
    broadcastTaskTrigger: (task) =>
      broadcastPush({
        type: "scheduled-task",
        taskId: task.id,
        groupId: task.groupId,
        prompt: task.prompt,
      }),
  });

  // ---------------- STATIC FILES ----------------
  registerStaticFilesMiddleware(app, config.rootPath);

  return { app, scheduler };
}
