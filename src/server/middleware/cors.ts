import cors from "cors";
import type { Logger } from "../logger.js";

export interface CorsConfig {
  corsMode: "localhost" | "private" | "all";
  allowedOrigins: Set<string>;
}

const CORS_EXPOSED_HEADERS = [
  "Content-Range",
  "Accept-Ranges",
  "Content-Length",
  "Content-Type",
  "ETag",
];

export function createCorsMiddleware(
  config: CorsConfig,
  logger: Logger,
  verbose: boolean,
) {
  return cors({
    origin(origin, callback) {
      if (!origin) {
        if (verbose) {
          logger.log("VERBOSE", `[CORS] Allowed (No Origin header)`);
        }

        return callback(null, true);
      }

      if (config.corsMode === "all") {
        if (verbose) {
          logger.log("VERBOSE", `[CORS] Allowed (All Origins flag)`);
        }

        return callback(null, true);
      }

      if (config.allowedOrigins.size > 0 && config.allowedOrigins.has(origin)) {
        if (verbose) {
          logger.log("VERBOSE", `[CORS] Allowed (Explicit allowlist)`);
        }

        return callback(null, true);
      }

      let hostname = "";
      try {
        hostname = new URL(origin).hostname;
      } catch {
        logger.error("DEFAULT", `[CORS BLOCK] Invalid Origin URL: ${origin}`);

        return callback(new Error("Invalid Origin"));
      }

      const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";
      const isGithubPages =
        hostname === "github.com" || hostname.endsWith(".github.io");
      const isPrivateIp =
        /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname);

      if (isLoopback || isGithubPages) {
        if (verbose) {
          logger.log("VERBOSE", `[CORS] Allowed (Known host match)`);
        }

        return callback(null, true);
      }

      if (config.corsMode === "private" && isPrivateIp) {
        if (verbose) {
          logger.log("VERBOSE", `[CORS] Allowed (Private IP mode)`);
        }

        return callback(null, true);
      }

      const policyLabel =
        config.corsMode === "private"
          ? "Private/LAN mode policy"
          : "Localhost only policy";
      logger.error(
        "DEFAULT",
        `[CORS BLOCK] Origin not allowed (${policyLabel}): ${origin}`,
      );

      return callback(
        new Error(
          config.corsMode === "private"
            ? "Private network policy"
            : "Localhost only",
        ),
      );
    },
    exposedHeaders: CORS_EXPOSED_HEADERS,
  });
}
