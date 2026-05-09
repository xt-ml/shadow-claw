import type { Request, Response, NextFunction } from "express";
import { getFirstHeaderValue } from "../utils/proxy-helpers.js";
import type { Logger } from "../logger.js";

export function createRequestLoggerMiddleware(
  logger: Logger,
  verbose: boolean,
) {
  return (req: Request, res: Response, next: NextFunction) => {
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

    logger.log(
      "DEFAULT",
      `--> ${req.method} ${redactedUrl} ip=${clientIp} host=${host} origin=${origin}`,
    );

    if (req.method === "OPTIONS") {
      logger.log(
        "DEFAULT",
        `    [Preflight] request-method=${requestedMethod} request-headers=${requestedHeaders} private-network=${requestedPrivateNetwork}`,
      );
    }

    res.on("finish", () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const allowOrigin = res.getHeader("access-control-allow-origin") || "-";
      const allowPrivateNetwork =
        res.getHeader("access-control-allow-private-network") || "-";

      logger.log(
        "DEFAULT",
        `<-- ${req.method} ${redactedUrl} ${statusCode} (${duration}ms) allow-origin=${allowOrigin} allow-private-network=${allowPrivateNetwork}`,
      );

      if (verbose) {
        logger.log("VERBOSE", `    Query:`, req.query);
        if (req.body && Object.keys(req.body).length > 0) {
          logger.log("VERBOSE", `    Body keys:`, Object.keys(req.body));
        }
      }
    });

    next();
  };
}
