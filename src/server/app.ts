import fs from "node:fs";
import path from "node:path";
import express from "express";
import compression from "compression";
import type { Express } from "express";

import { registerProxyRoutes } from "./proxy.js";
import { registerOAuthRoutes } from "./routes/oauth.js";
import { registerActivityLogRoutes } from "./routes/activity-log.js";

import { openPushStore } from "../notifications/push-store.js";
import {
  broadcastPush,
  registerPushRoutes,
} from "../notifications/push-routes.js";
import {
  getEnabledScheduledTasks,
  openTaskScheduleStore,
  updateScheduledTaskLastRun,
} from "../notifications/task-schedule-store.js";
import { registerTaskScheduleRoutes } from "../notifications/task-schedule-routes.js";
import { ServerTaskScheduler } from "../notifications/task-scheduler-server.js";

import type { ServerConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createRequestLoggerMiddleware } from "./middleware/request-logger.js";
import { createPnaMiddleware } from "./middleware/pna.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { registerStaticFilesMiddleware } from "./middleware/static-files.js";

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
