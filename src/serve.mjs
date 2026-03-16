#!/usr/bin/env node

// dev server
import fs from "node:fs";
import path from "node:path";
import { argv, env, exit } from "node:process";
import { fileURLToPath } from "node:url";

import compression from "compression";
import cors from "cors";
import express from "express";
import expressUrlrewrite from "express-urlrewrite";
import tcpPortUsed from "tcp-port-used";

import {
  COPILOT_AZURE_OPENAI_ALLOWED_MODELS,
  DEFAULT_DEV_IP,
  DEFAULT_DEV_PORT,
} from "./config.mjs";

// get details for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- ARGUMENT PARSING ----------------
const args = argv.slice(2);
const isVerbose = args.includes("--verbose") || args.includes("-v");
const showHelp = args.includes("--help") || args.includes("-h");

/**
 * @param {string[]} argvArgs
 * @param {string[]} names
 *
 * @returns {string}
 */
function getArgValue(argvArgs, names) {
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

/**
 * @param {string[]} argvArgs
 * @param {string[]} names
 *
 * @returns {string[]}
 */
function getArgValues(argvArgs, names) {
  /** @type {string[]} */
  const values = [];

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

/**
 * @param {string} value
 *
 * @returns {string[]}
 */
function parseCsv(value) {
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
    "  node src/serve.mjs [port] [options]",
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
  env.SHADOWCLAW_CORS_ALLOWED_ORIGINS || "",
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

function log(level, ...messages) {
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
app.use((req, res, next) => {
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

  // Log incoming request immediately
  // We log all requests, including OPTIONS, to help debug CORS/PNA issues.
  log(
    LOG_LEVELS.DEFAULT,
    `--> ${req.method} ${req.originalUrl} ip=${clientIp} host=${host} origin=${origin}`,
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
      `<-- ${req.method} ${req.originalUrl} ${statusCode} (${duration}ms) allow-origin=${allowOrigin} allow-private-network=${allowPrivateNetwork}`,
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
app.use((req, res, next) => {
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
      const isGithubPages = hostname === "xt-ml.github.io";
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

// enable compression
app.use(compression());

// parse JSON bodies (increased limit for large proxy payloads)
app.use(express.json({ limit: "1000mb" }));

// ---------------- SHARED PROXY LOGIC ----------------
async function handleProxyRequest(
  _,
  res,
  { targetUrl, method, headers, body },
) {
  // --- PROXY LOGGING START ---
  log(
    LOG_LEVELS.DEFAULT,
    `[Proxy] Forwarding ${method} request to: ${targetUrl}`,
  );

  if (isVerbose) {
    log(
      LOG_LEVELS.VERBOSE,
      `[Proxy] Upstream Headers:`,
      JSON.stringify(headers, null, 2),
    );

    if (body) {
      // Log length or snippet to avoid flooding console with massive payloads
      const bodyPreview =
        typeof body === "string" && body.length > 100
          ? `${body.substring(0, 100)}... (${body.length} chars)`
          : `(Buffer or Object, Length: ${body.length || "N/A"})`;

      log(LOG_LEVELS.VERBOSE, `[Proxy] Body Preview:`, bodyPreview);
    }
  }
  // --- PROXY LOGGING END ---

  try {
    // Validate URL
    let target;

    try {
      target = new URL(targetUrl);
    } catch {
      res.status(400).json({ error: "Invalid URL" });

      return;
    }

    // Sanitize Headers (Shared Logic)
    const safeHeaders = { ...headers };
    delete safeHeaders.host;
    delete safeHeaders.origin;
    delete safeHeaders.referer;
    delete safeHeaders["accept-encoding"];
    delete safeHeaders["content-length"];
    delete safeHeaders.connection;

    // Perform Upstream Request
    const upstream = await fetch(target.toString(), {
      method,
      headers: safeHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : body,
    });

    // Send Response (Shared Logic)
    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      // Drop hop-by-hop headers
      if (
        lower === "content-encoding" ||
        lower === "transfer-encoding" ||
        lower === "content-length" ||
        lower === "connection"
      ) {
        return;
      }

      res.setHeader(key, value);
    });

    res.setHeader("Access-Control-Allow-Origin", "*");

    const buf = Buffer.from(await upstream.arrayBuffer());

    res.send(buf);
  } catch (err) {
    console.error("Proxy error:", err);

    res.status(500).json({ error: "Proxy request failed" });
  }
}

/**
 * @param {string | string[] | undefined} headerValue
 *
 * @returns {string}
 */
function getFirstHeaderValue(headerValue) {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || "";
  }

  return typeof headerValue === "string" ? headerValue : "";
}

/**
 * @param {string} authorizationHeader
 *
 * @returns {string}
 */
function extractBearerToken(authorizationHeader) {
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : "";
}

// ---------------- PROXY ENDPOINT (JSON Based) ----------------
app.all("/proxy", async (req, res) => {
  // Extract URL
  const urlFromQuery =
    typeof req.query.url === "string" ? req.query.url : undefined;

  const urlFromBody =
    req.body && typeof req.body.url === "string" ? req.body.url : undefined;

  const target = urlFromBody || urlFromQuery;

  if (!target) {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }

  // Extract Method & Headers (Allows override via body)
  const method =
    (req.body && typeof req.body.method === "string" && req.body.method) ||
    req.method;
  const normalizedMethod = method.toUpperCase();

  const incomingHeaders =
    (req.body && req.body.headers && typeof req.body.headers === "object"
      ? req.body.headers
      : req.headers) || {};

  // Extract Body (String from JSON)
  // Note: This assumes body-parser middleware has run.
  let body;
  if (req.body && typeof req.body.body === "string") {
    body = req.body.body;
  }

  // Delegate to shared handler
  await handleProxyRequest(req, res, {
    targetUrl: target,
    method: normalizedMethod,
    headers: incomingHeaders,
    body,
  });
});

// ---------------- COPILOT / AZURE AI INFERENCE PROXY ----------------
app.post("/copilot-proxy/azure-openai/chat/completions", async (req, res) => {
  const allowedModels = new Set(COPILOT_AZURE_OPENAI_ALLOWED_MODELS);
  const endpoint = (
    env.COPILOT_AZURE_OPENAI_ENDPOINT || "https://models.inference.ai.azure.com"
  ).replace(/\/$/, "");

  const targetUrl = `${endpoint}/chat/completions`;
  const serverApiKey =
    env.COPILOT_AZURE_OPENAI_API_KEY || env.API_KEY || undefined;
  const defaultModel = env.COPILOT_AZURE_OPENAI_MODEL || undefined;

  const requestBody =
    req.body && typeof req.body === "object" ? { ...req.body } : {};

  if (!requestBody.model && defaultModel) {
    requestBody.model = defaultModel;
  }

  if (
    typeof requestBody.model !== "string" ||
    !allowedModels.has(requestBody.model)
  ) {
    return res.status(400).json({
      error: `Model '${String(requestBody.model || "")}' is not allowed. Allowed models: ${COPILOT_AZURE_OPENAI_ALLOWED_MODELS.join(", ")}.`,
    });
  }

  const clientApiKey = getFirstHeaderValue(req.headers["api-key"]);
  const clientAuthorization = getFirstHeaderValue(req.headers.authorization);
  const resolvedApiKey =
    clientApiKey ||
    extractBearerToken(clientAuthorization) ||
    serverApiKey ||
    "";

  const incomingHeaders = { ...req.headers };
  delete incomingHeaders["api-key"];
  delete incomingHeaders.authorization;

  if (resolvedApiKey) {
    incomingHeaders["api-key"] = resolvedApiKey;
    incomingHeaders.authorization = `Bearer ${resolvedApiKey}`;
  }

  await handleProxyRequest(req, res, {
    targetUrl,
    method: "POST",
    headers: incomingHeaders,
    body: JSON.stringify(requestBody),
  });
});

// ---------------- ISOMORPHIC-GIT PROXY (Stream Based) ----------------
app.all(/^\/git-proxy\/(.*)/, async (req, res) => {
  // Construct URL from Path
  const pathParams = req.params[0];
  const queryString =
    Object.keys(req.query).length > 0
      ? "?" + new URLSearchParams(req.query).toString()
      : "";

  const targetUrlString = "https://" + pathParams + queryString;

  // Read Raw Body Stream
  // We must do this before calling the helper because Git sends binary data
  // that standard body parsers (like express.json) might skip or corrupt.
  const bodyBuffers = [];
  for await (const chunk of req) {
    bodyBuffers.push(chunk);
  }

  const rawBody = Buffer.concat(bodyBuffers);

  // Delegate to shared handler
  await handleProxyRequest(req, res, {
    targetUrl: targetUrlString,
    method: req.method,
    headers: req.headers, // Forward headers as-is
    body: rawBody.length > 0 ? rawBody : undefined,
  });
});

// rewrite rule to remove index.html
app.use(expressUrlrewrite(/^(.+)\/index\.html$/, "$1/"));

app.use((req, res, next) => {
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

  const filePath = path.join(__dirname, path.sep, "..", path.sep, req.url);
  fs.stat(filePath, (err, stats) => {
    if (err) {
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

// serve static files from the 'src' directory
app.use(
  express.static(path.join(__dirname, path.sep, "..", path.sep), {
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
