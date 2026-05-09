import { env, exit } from "node:process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { DEFAULT_DEV_IP, DEFAULT_DEV_PORT } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerConfig {
  port: number;
  bindHost: string;
  corsMode: "localhost" | "private" | "all";
  allowedOrigins: Set<string>;
  verbose: boolean;
  rootPath: string;
  databaseDir: string;
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
    );

  program.parse();

  const options = program.opts();
  const args = program.args;

  // Root path detection
  const srcRootPath = path.join(__dirname, "..");
  const distPublicPath = path.join(__dirname, "public");
  const isDist = fs.existsSync(distPublicPath);
  const rootPath = isDist ? distPublicPath : srcRootPath;

  // Project root detection
  const projectRoot = isDist
    ? path.join(__dirname, "..") // from dist/
    : path.join(__dirname, "..", ".."); // from src/server/

  const envDatabaseDir = (env.SHADOWCLAW_DATABASE_DIR || "").trim();
  const databaseDir = envDatabaseDir
    ? path.resolve(projectRoot, envDatabaseDir)
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

  return {
    port,
    bindHost,
    corsMode: corsMode as "localhost" | "private" | "all",
    allowedOrigins: new Set(configuredAllowedOrigins),
    verbose: options.verbose || false,
    rootPath,
    databaseDir,
  };
}
