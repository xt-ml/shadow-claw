import fs from "node:fs";
import path from "node:path";
import { argv, env, exit } from "node:process";
import { fileURLToPath } from "node:url";

import compression from "compression";
import cors from "cors";
import express from "express";
import expressUrlrewrite from "express-urlrewrite";
import tcpPortUsed from "tcp-port-used";

import { DEFAULT_DEV_IP, DEFAULT_DEV_PORT } from "../config.js";
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
import { registerOAuthRoutes } from "./oauth-routes.js";
import { getFirstHeaderValue, registerProxyRoutes } from "./proxy.js";

import type { NextFunction, Request, Response } from "express";

// get details for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the root directory for serving static files.
const srcRootPath = path.join(__dirname, "..");
const distPublicPath = path.join(__dirname, "public");
const isDist = fs.existsSync(distPublicPath);
const rootPath = isDist ? distPublicPath : srcRootPath;

// Determine project root (one level up from src or dist)
const projectRoot = isDist ? __dirname : path.join(__dirname, "..");
const databaseDir = path.join(projectRoot, "database");

// Ensure database directory exists
if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

// Parse args
const args = argv.slice(2);
const isVerbose = args.includes("--verbose") || args.includes("-v");
const showHelp = args.includes("--help") || args.includes("-h");

function getArgValue(argvArgs: string[], names: string[]): string {
  for (let i = 0; i < argvArgs.length; i++) {
    const arg = argvArgs[i];

    for (const name of names) {
      if (arg === name) {
        const next = argvArgs[i + 1];
        if (typeof next === "string" && !next.startsWith("-")) {
          return next;
        }

        return "";
      }

      const prefix = `${name}=`;
      if (arg.startsWith(prefix)) {
        return arg.slice(prefix.length).trim();
      }
    }
  }

  return "";
}

function getArgValues(argvArgs: string[], names: string[]): string[] {
  const values: string[] = [];

  for (let i = 0; i < argvArgs.length; i++) {
    const arg = argvArgs[i];

    for (const name of names) {
      if (arg === name) {
        const next = argvArgs[i + 1];
        if (typeof next === "string" && !next.startsWith("-")) {
          values.push(next.trim());
        }

        continue;
      }

      const prefix = `${name}=`;
      if (arg.startsWith(prefix)) {
        values.push(arg.slice(prefix.length).trim());
      }
    }
  }

  return values.filter(Boolean);
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printHelp() {
  const lines = [
    "ShadowClaw dev server",
    "",
    "Usage:",
    "  npm start -- [port] [options]",
    "  node dist/server.js [port] [options]",
    "",
    "Options:",
    "  -h, --help                         Show this help and exit",
    "  -v, --verbose                      Enable verbose request/proxy logging",
    "  --host, --ip, --bind-ip <host>     Bind host/IP (CLI overrides env)",
    "  --cors-mode <mode>                 CORS policy: localhost | private | all",
    "  --cors-allow-origin <origin>       Add explicit allowed origin (repeatable)",
    "                                     Also accepts comma-separated values",
    "",
    "Environment:",
    "  SHADOWCLAW_USER_AGENT              User agent string to use when making HTTP requests",
    "  SHADOWCLAW_DEV_IP                  Bind host/IP fallback",
    "  SHADOWCLAW_HOST                    Alternate bind host/IP fallback",
    "  DEV_IP                             Legacy bind host/IP fallback",
    "  HOST                               Generic bind host/IP fallback",
    "  SHADOWCLAW_CORS_MODE               localhost | private | all",
    "  SHADOWCLAW_CORS_ALLOWED_ORIGINS    Comma-separated explicit origins",
    "",
    `Defaults:`,
    `  port=${DEFAULT_DEV_PORT}`,
    `  host=${DEFAULT_DEV_IP}`,
    "  cors-mode=localhost",
  ];

  console.log(lines.join("\n"));
}

// Filter out flags to find the port
const portArg = args.find((arg) => !arg.startsWith("-") && !isNaN(Number(arg)));
let port = Number(portArg) || DEFAULT_DEV_PORT;

const cliHost = getArgValue(args, ["--host", "--ip", "--bind-ip"]);
const envHost =
  env.SHADOWCLAW_DEV_IP || env.SHADOWCLAW_HOST || env.DEV_IP || env.HOST || "";
const bindHost = (cliHost || envHost || DEFAULT_DEV_IP).trim();

const cliCorsMode = getArgValue(args, ["--cors-mode"]).toLowerCase();
const envCorsMode = (env.SHADOWCLAW_CORS_MODE || "").toLowerCase().trim();
const corsMode = (cliCorsMode || envCorsMode || "localhost").trim();
const allowedOriginArgs = getArgValues(args, ["--cors-allow-origin"]);
const allowedOriginsFromArgs = allowedOriginArgs.flatMap(parseCsv);
const allowedOriginsFromEnv = parseCsv(
  env.SHADOWCLAW_CORS_ALLOWED_ORIGINS || "https://xt-ml.github.io",
);

const configuredAllowedOrigins = [
  ...allowedOriginsFromEnv,
  ...allowedOriginsFromArgs,
];

if (showHelp) {
  printHelp();

  exit(0);
}

if (port < 1024 || port > 65535) {
  console.error("Port must be between 1024 and 65535.");

  exit(1);
}

if (!bindHost) {
  console.error(
    "Bind host cannot be empty. Use --host <value> or set SHADOWCLAW_DEV_IP.",
  );

  exit(1);
}

if (!["localhost", "private", "all"].includes(corsMode)) {
  console.error(
    "Invalid CORS mode. Use --cors-mode localhost|private|all or SHADOWCLAW_CORS_MODE.",
  );

  exit(1);
}

// ---------------- LOGGING SETUP ----------------
const LOG_LEVELS = {
  DEFAULT: "DEFAULT",
  VERBOSE: "VERBOSE",
};

function log(level: string, ...messages: any[]): void {
  if (level === LOG_LEVELS.DEFAULT || isVerbose) {
    const timestamp = new Date().toISOString();
    const prefix = level === LOG_LEVELS.VERBOSE ? "[VERBOSE]" : "[LOG]";

    console.log(`[${timestamp}] ${prefix}`, ...messages);
  }
}

// create an express application
const app = express();

// define an ip address
const ipAddr = bindHost;

// ---------------- REQUEST LOGGER MIDDLEWARE (Moved to top) ----------------
// We place this before CORS so we can log the request arrival even if CORS blocks it.
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const forwardedFor = getFirstHeaderValue(req.headers["x-forwarded-for"]);
  const clientIp =
    forwardedFor || req.socket?.remoteAddress || req.ip || "unknown";

  const origin = getFirstHeaderValue(req.headers.origin) || "-";
  const host = getFirstHeaderValue(req.headers.host) || "-";
  const requestedMethod =
    getFirstHeaderValue(req.headers["access-control-request-method"]) || "-";

  const requestedHeaders =
    getFirstHeaderValue(req.headers["access-control-request-headers"]) || "-";

  const requestedPrivateNetwork =
    getFirstHeaderValue(
      req.headers["access-control-request-private-network"],
    ) || "-";

  const redactedUrl = req.originalUrl.replace(
    /\/telegram\/(?:bot|file\/bot)[^/]+\//,
    (match) =>
      match.startsWith("/telegram/file/")
        ? "/telegram/file/bot[REDACTED]/"
        : "/telegram/bot[REDACTED]/",
  );

  // Log incoming request immediately
  // We log all requests, including OPTIONS, to help debug CORS/PNA issues.
  log(
    LOG_LEVELS.DEFAULT,
    `--> ${req.method} ${redactedUrl} ip=${clientIp} host=${host} origin=${origin}`,
  );

  if (req.method === "OPTIONS") {
    log(
      LOG_LEVELS.DEFAULT,
      `    [Preflight] request-method=${requestedMethod} request-headers=${requestedHeaders} private-network=${requestedPrivateNetwork}`,
    );
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const allowOrigin = res.getHeader("access-control-allow-origin") || "-";
    const allowPrivateNetwork =
      res.getHeader("access-control-allow-private-network") || "-";

    // Basic log for all routes
    log(
      LOG_LEVELS.DEFAULT,
      `<-- ${req.method} ${redactedUrl} ${statusCode} (${duration}ms) allow-origin=${allowOrigin} allow-private-network=${allowPrivateNetwork}`,
    );

    // Verbose details
    if (isVerbose) {
      log(LOG_LEVELS.VERBOSE, `    Query:`, req.query);

      // Note: req.body might not be populated yet if CORS blocked the request
      // before body parsing, but we try to log it if available.
      if (req.body && Object.keys(req.body).length > 0) {
        log(LOG_LEVELS.VERBOSE, `    Body keys:`, Object.keys(req.body));
      }
    }
  });

  next();
});

// ---------------- PRIVATE NETWORK ACCESS (PNA) SUPPORT ----------------
// Chrome requires 'Access-Control-Allow-Private-Network: true' when a public site
// (like github.io) tries to access a private network (like localhost).
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.headers["access-control-request-private-network"] === "true") {
    if (isVerbose) {
      log(LOG_LEVELS.VERBOSE, `[PNA] Allowing Private Network Access`);
    }

    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }

  next();
});

// enable CORS
const CORS_CONFIG = {
  mode: corsMode,
  // Explicit origin allowlist has highest priority and can be provided
  // through SHADOWCLAW_CORS_ALLOWED_ORIGINS or --cors-allow-origin.
  allowedOrigins: new Set(configuredAllowedOrigins),
};

const CORS_EXPOSED_HEADERS = [
  "Content-Range",
  "Accept-Ranges",
  "Content-Length",
  "Content-Type",
  "ETag",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (no Origin header)
      if (!origin) {
        if (isVerbose) {
          log(LOG_LEVELS.VERBOSE, `[CORS] Allowed (No Origin header)`);
        }

        return callback(null, true);
      }

      // Flag: All origins (*)
      if (CORS_CONFIG.mode === "all") {
        if (isVerbose) {
          log(LOG_LEVELS.VERBOSE, `[CORS] Allowed (All Origins flag)`);
        }

        return callback(null, true);
      }

      if (CORS_CONFIG.allowedOrigins.size > 0) {
        if (CORS_CONFIG.allowedOrigins.has(origin)) {
          if (isVerbose) {
            log(LOG_LEVELS.VERBOSE, `[CORS] Allowed (Explicit allowlist)`);
          }

          return callback(null, true);
        }
      }

      let hostname = "";
      try {
        hostname = new URL(origin).hostname;
      } catch {
        log(LOG_LEVELS.DEFAULT, `[CORS BLOCK] Invalid Origin URL: ${origin}`);

        return callback(new Error("Invalid Origin"));
      }

      const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";
      const isGithubPages = hostname === "github.com";
      const isPrivateIp =
        /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname);

      if (isLoopback || isGithubPages) {
        if (isVerbose) {
          log(LOG_LEVELS.VERBOSE, `[CORS] Allowed (Known host match)`);
        }

        return callback(null, true);
      }

      if (CORS_CONFIG.mode === "private" && isPrivateIp) {
        if (isVerbose) {
          log(LOG_LEVELS.VERBOSE, `[CORS] Allowed (Private IP mode)`);
        }

        return callback(null, true);
      }

      const policyLabel =
        CORS_CONFIG.mode === "private"
          ? "Private/LAN mode policy"
          : "Localhost only policy";

      // Reject other origins
      log(
        LOG_LEVELS.DEFAULT,
        `[CORS BLOCK] Origin not allowed (${policyLabel}): ${origin}`,
      );

      return callback(
        new Error(
          CORS_CONFIG.mode === "private"
            ? "Private network policy"
            : "Localhost only",
        ),
      );
    },
    exposedHeaders: CORS_EXPOSED_HEADERS,
  }),
);

// enable compression — but skip SSE streams so chunks flush in real time
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

// parse JSON bodies (increased limit for large proxy payloads)
app.use(express.json({ limit: "1000mb" }));

// ---------------- PROXY ROUTES (shared with Electron) ----------------
registerProxyRoutes(app, { verbose: isVerbose });

// ---------------- OAUTH ROUTES ----------------
registerOAuthRoutes(app);

// ---------------- PUSH NOTIFICATION ROUTES ----------------
openPushStore(path.join(databaseDir, "push-subscriptions.db"));
registerPushRoutes(app);

// ---------------- SERVER-SIDE SCHEDULED TASKS ----------------
openTaskScheduleStore(path.join(databaseDir, "scheduled-tasks.db"));
registerTaskScheduleRoutes(app);

const serverScheduler = new ServerTaskScheduler({
  getEnabledTasks: getEnabledScheduledTasks,
  updateLastRun: updateScheduledTaskLastRun,
  broadcastTaskTrigger: (task) =>
    broadcastPush({
      type: "scheduled-task",
      taskId: task.id,
      groupId: task.groupId,
      prompt: task.prompt,
      isScript: task.isScript,
    }),
});
serverScheduler.start();

// rewrite rule to remove index.html
app.use(expressUrlrewrite(/^(.+)\/index\.html$/, "$1/"));

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestPath = new URL(req.originalUrl, "http://localhost").pathname;
  const isWebVMAsset =
    requestPath.startsWith("/assets/v86.9pfs/") ||
    requestPath.startsWith("/assets/v86.ext2/");

  if (isWebVMAsset) {
    // WebVM chunk files are immutable content-addressed assets; allow the
    // browser HTTP cache to absorb repeated 9p demand-load reads in dev.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "no-cache");
  }

  const filePath = path.join(rootPath, req.url);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats) {
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

// serve static files from the root directory
app.use(
  express.static(rootPath, {
    etag: true,
  }),
);

const isPortUsed = await tcpPortUsed.check(port, ipAddr);
if (isPortUsed) {
  console.error(
    `Port ${port} is currently being used. Try passing a different port as the first argument.`,
  );

  exit(1);
}

// start the server
app.listen(port, ipAddr, () => {
  console.log(`Server running at http://${ipAddr}:${port}`);

  if (ipAddr === DEFAULT_DEV_IP) {
    console.log(
      `Bind host source: default (${DEFAULT_DEV_IP}). Use --host/--ip or SHADOWCLAW_DEV_IP to override.`,
    );
  } else if (cliHost) {
    console.log(`Bind host source: CLI (${ipAddr})`);
  } else {
    console.log(`Bind host source: env (${ipAddr})`);
  }

  console.log(
    `CORS mode: ${CORS_CONFIG.mode}${CORS_CONFIG.allowedOrigins.size > 0 ? " (with explicit allowlist)" : ""}`,
  );

  if (CORS_CONFIG.allowedOrigins.size > 0) {
    console.log(
      `CORS allowlist origins: ${Array.from(CORS_CONFIG.allowedOrigins).join(", ")}`,
    );
  }

  if (isVerbose) {
    console.log("Verbose logging enabled.");
  }
});
