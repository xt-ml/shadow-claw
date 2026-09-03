import { env, exit } from "node:process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { DEFAULT_DEV_IP, DEFAULT_DEV_PORT } from "../config/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerConfig {
  port: number;
  bindHost: string;
  corsMode: "localhost" | "private" | "all";
  allowedOrigins: Set<string>;
  verbose: boolean;
  peerjs: boolean;
  rootPath: string;
  cacheDir?: string;
  databaseDir: string;
  /**
   * When true the private-IP SSRF block in /proxy is disabled,
   * allowing requests to loopback, RFC-1918, and link-local addresses.
   * Controlled by --allow-private-proxy (or SHADOWCLAW_ALLOW_PRIVATE_PROXY=1).
   */
  /**
   * Optional control token override for authenticating control-plane commands.
   */
  controlToken?: string;
  allowPrivateProxy: boolean;
  https: boolean;
  certPath?: string;
  keyPath?: string;
  sslDir: string;
  serveStatic?: boolean;
}

export function parseConfig(): ServerConfig {
  const program = new Command();

  program
    .name("shadow-claw")
    .description("ShadowClaw Dev Server")
    .argument("[port]", "Port to listen on")
    .option("-v, --verbose", "Enable verbose request/proxy logging", false)
    .option("--host <host>", "Bind host/IP")
    .option("--ip <host>", "Bind host/IP (alias)")
    .option("--bind-ip <host>", "Bind host/IP (alias)")
    .option(
      "--cors-mode <mode>",
      "CORS policy: localhost | private | all",
      "localhost",
    )
    .option(
      "--cors-allow-origin <origin>",
      "Explicit allowed origins (repeatable)",
      (value, previous: string[]) => {
        return previous.concat(value.split(",").map((s) => s.trim()));
      },
      [],
    )
    .option("--peerjs", "Enable built-in PeerJS signaling server", false)
    .option(
      "--allow-private-proxy",
      "Allow the /proxy endpoint to reach private/loopback addresses (disables SSRF block)",
      false,
    )
    .option("--root-path <path>", "Directory containing static assets to serve")
    .option(
      "--database-dir <path>",
      "Directory where SQLite databases are stored",
    )
    .option(
      "--cache-dir <path>",
      "Directory where cache and databases are stored",
    )
    .option(
      "--control-token <token>",
      "Secret token for control-plane authentication",
    )
    .option("--https", "Enable HTTPS dev server", false)
    .option("--cert <path>", "Path to existing TLS certificate file")
    .option("--key <path>", "Path to existing TLS private key file")
    .option(
      "--ssl-dir <path>",
      "Directory for TLS certificate generation/storage",
    )
    .option(
      "--no-static",
      "Disable static file and UI serving (services-only mode)",
    );

  program.parse();

  const options = program.opts();
  const args = program.args;

  // Root path detection
  const envRootPath = (
    env.SHADOWCLAW_ROOT_PATH ||
    env.SHADOWCLAW_PUBLIC_DIR ||
    ""
  ).trim();
  const srcRootPath = path.join(__dirname, "..");
  const distPublicPath = path.join(__dirname, "public");
  const isDist = fs.existsSync(distPublicPath);
  const detectedRootPath = isDist ? distPublicPath : srcRootPath;
  const rootPath = options.rootPath
    ? path.resolve(options.rootPath)
    : envRootPath
      ? path.resolve(envRootPath)
      : detectedRootPath;

  // Project root detection
  const projectRoot = isDist
    ? path.join(__dirname, "..") // from dist/
    : path.join(__dirname, "..", ".."); // from src/server/

  const envCacheDir = (env.SHADOWCLAW_CACHE_DIR || "").trim();
  const cacheDir = options.cacheDir
    ? path.resolve(options.cacheDir)
    : envCacheDir
      ? path.resolve(projectRoot, envCacheDir)
      : undefined;

  const envDatabaseDir = (env.SHADOWCLAW_DATABASE_DIR || "").trim();
  const databaseDir = options.databaseDir
    ? path.resolve(options.databaseDir)
    : envDatabaseDir
      ? path.resolve(projectRoot, envDatabaseDir)
      : cacheDir
        ? path.join(cacheDir, "database")
        : path.join(projectRoot, "database");

  // Port logic
  let port = DEFAULT_DEV_PORT;
  if (args[0]) {
    port = parseInt(args[0], 10);
  }

  if (port < 1024 || port > 65535) {
    console.error("Port must be between 1024 and 65535.");
    exit(1);
  }

  // Host logic
  const envHost =
    env.SHADOWCLAW_DEV_IP ||
    env.SHADOWCLAW_HOST ||
    env.DEV_IP ||
    env.HOST ||
    "";
  const bindHost = (
    options.host ||
    options.ip ||
    options.bindIp ||
    envHost ||
    DEFAULT_DEV_IP
  ).trim();

  if (!bindHost) {
    console.error(
      "Bind host cannot be empty. Use --host <value> or set SHADOWCLAW_DEV_IP.",
    );
    exit(1);
  }

  // CORS logic
  const envCorsMode = (env.SHADOWCLAW_CORS_MODE || "").toLowerCase().trim();
  const corsMode = (options.corsMode || envCorsMode || "localhost").trim();

  if (!["localhost", "private", "all"].includes(corsMode)) {
    console.error(
      "Invalid CORS mode. Use --cors-mode localhost|private|all or SHADOWCLAW_CORS_MODE.",
    );
    exit(1);
  }

  const allowedOriginsFromEnv = (
    env.SHADOWCLAW_CORS_ALLOWED_ORIGINS || "https://xt-ml.github.io"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const configuredAllowedOrigins = [
    ...allowedOriginsFromEnv,
    ...options.corsAllowOrigin,
  ];

  // PeerJS signaling server
  const peerjs =
    options.peerjs ||
    ["1", "true", "yes"].includes(
      (env.SHADOWCLAW_PEERJS || "").toLowerCase().trim(),
    );

  // Allow-private-proxy
  const allowPrivateProxy =
    options.allowPrivateProxy ||
    ["1", "true", "yes"].includes(
      (env.SHADOWCLAW_ALLOW_PRIVATE_PROXY || "").toLowerCase().trim(),
    );

  // Control Token
  const envControlToken = (env.SHADOWCLAW_CONTROL_TOKEN || "").trim();
  const controlToken = options.controlToken
    ? options.controlToken.trim()
    : envControlToken || undefined;

  // HTTPS & TLS logic
  const https =
    Boolean(options.https) ||
    ["1", "true", "yes"].includes(
      (env.SHADOWCLAW_HTTPS || "").toLowerCase().trim(),
    );

  const envCert = (env.SHADOWCLAW_TLS_CERT || env.SHADOWCLAW_CERT || "").trim();
  const certPath = options.cert
    ? path.resolve(options.cert)
    : envCert
      ? path.resolve(envCert)
      : undefined;

  const envKey = (env.SHADOWCLAW_TLS_KEY || env.SHADOWCLAW_KEY || "").trim();
  const keyPath = options.key
    ? path.resolve(options.key)
    : envKey
      ? path.resolve(envKey)
      : undefined;

  const envSslDir = (
    env.SHADOWCLAW_SSL_DIR ||
    env.SHADOWCLAW_TLS_DIR ||
    ""
  ).trim();
  const sslDir = options.sslDir
    ? path.resolve(options.sslDir)
    : envSslDir
      ? path.resolve(projectRoot, envSslDir)
      : cacheDir
        ? path.join(cacheDir, "tls")
        : path.resolve(databaseDir, "..", ".cache", "tls");

  // Static assets serving logic
  const envServeStatic =
    env.SHADOWCLAW_SERVE_STATIC !== undefined
      ? !["0", "false", "no"].includes(
          env.SHADOWCLAW_SERVE_STATIC.toLowerCase().trim(),
        )
      : !["1", "true", "yes"].includes(
          (env.SHADOWCLAW_SERVICES_ONLY || "").toLowerCase().trim(),
        );
  const serveStatic =
    options.static !== undefined ? Boolean(options.static) : envServeStatic;

  return {
    port,
    bindHost,
    corsMode: corsMode as "localhost" | "private" | "all",
    allowedOrigins: new Set(configuredAllowedOrigins),
    verbose: options.verbose || false,
    peerjs,
    rootPath,
    cacheDir,
    databaseDir,
    controlToken,
    allowPrivateProxy,
    https,
    certPath,
    keyPath,
    sslDir,
    serveStatic,
  };
}
