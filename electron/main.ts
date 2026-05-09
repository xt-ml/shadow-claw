import {
  app,
  BrowserWindow,
  Menu,
  nativeTheme,
  powerSaveBlocker,
  session,
} from "electron";

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

import express from "express";
import expressUrlrewrite from "express-urlrewrite";

import {
  broadcastPush,
  registerPushRoutes,
} from "../src/notifications/push-routes.js";
import { openPushStore } from "../src/notifications/push-store.js";
import { registerTaskScheduleRoutes } from "../src/notifications/task-schedule-routes.js";
import {
  getEnabledScheduledTasks,
  openTaskScheduleStore,
  updateScheduledTaskLastRun,
} from "../src/notifications/task-schedule-store.js";
import { ServerTaskScheduler } from "../src/notifications/task-scheduler-server.js";

import { registerOAuthRoutes } from "../src/server/routes/oauth.js";
import { registerProxyRoutes } from "../src/server/proxy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the root directory for serving static files.
// In built context: __dirname = dist/electron, so dist/public exists
// Check for dist/public relative to __dirname
const distPublicPath = path.resolve(__dirname, "..", "public");
const isDist = fs.existsSync(distPublicPath);
const ROOT = isDist ? distPublicPath : path.resolve(__dirname, "..");

const PORT = 8888;

let mainWindow: BrowserWindow | null = null;
let server: http.Server | null = null;
let powerBlockerId: number | null = null;

/**
 * Start an in-process Express server that serves static files
 * and registers the shared proxy routes.
 */
function startServer(databaseDir: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = express();

    // JSON body parser (large limit for proxy payloads)
    srv.use(express.json({ limit: "1000mb" }));

    // Proxy routes shared with serve.js
    registerProxyRoutes(srv);

    // OAuth callback + token exchange routes
    registerOAuthRoutes(srv);

    // Push notification routes
    openPushStore(path.join(databaseDir, "push-subscriptions.db"));
    registerPushRoutes(srv);

    // Server-side scheduled tasks
    openTaskScheduleStore(path.join(databaseDir, "scheduled-tasks.db"));
    registerTaskScheduleRoutes(srv);

    const serverScheduler = new ServerTaskScheduler({
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
    serverScheduler.start();

    // URL rewrite: strip trailing index.html
    srv.use(expressUrlrewrite(/^(.+)\/index\.html$/, "$1/"));

    // Static files from the project root
    srv.use(express.static(ROOT, { etag: true }));

    // SPA fallback — serve index.html for unmatched routes
    srv.use((_req, res) => {
      res.sendFile(path.join(ROOT, "index.html"));
    });

    server = srv.listen(PORT, "127.0.0.1", () => {
      const addr = server?.address();
      if (!addr) {
        return;
      }

      const port = typeof addr === "object" ? addr.port : PORT;
      console.log(`Electron server listening on http://127.0.0.1:${port}`);
      resolve(port);
    });

    server?.on("error", reject);
  });
}

function createWindow(port: number) {
  const isDark = nativeTheme.shouldUseDarkColors;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    title: "ShadowClaw",
    icon: path.join(ROOT, "assets", "icons", "512.png"),
    autoHideMenuBar: true,
    backgroundColor: isDark ? "#111111" : "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function updateBackgroundColor() {
  if (!mainWindow) {
    return;
  }

  const bg = nativeTheme.shouldUseDarkColors ? "#111111" : "#ffffff";
  mainWindow.setBackgroundColor(bg);
}

app.whenReady().then(async () => {
  const userAgent = process.env.SHADOWCLAW_USER_AGENT || "ShadowClaw/1.0";
  app.userAgentFallback = userAgent;
  session.defaultSession.setUserAgent(userAgent);

  // Store database files in user-writable directory
  // On Linux: ~/.config/shadowclaw
  // On macOS: ~/Library/Application Support/shadowclaw
  // On Windows: %APPDATA%/shadowclaw
  const databaseDir = path.join(app.getPath("userData"), "database");
  await mkdir(databaseDir, { recursive: true });

  const port = (await startServer(databaseDir)) as number;
  createWindow(port);

  // Prevent the OS from sleeping/dimming while the app is running,
  // so scheduled tasks fire on time.
  powerBlockerId = powerSaveBlocker.start("prevent-app-suspension");

  nativeTheme.on("updated", updateBackgroundColor);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (powerBlockerId != null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
  }

  if (server) {
    server.close();
    server = null;
  }
});
