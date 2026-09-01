import type { Request, Response, NextFunction } from "express";
import type { Logger } from "../logger.js";

export function createPnaMiddleware(logger: Logger, verbose: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    const isPnaExplicit =
      req.headers["access-control-request-private-network"] === "true";
    const hasOrigin = Boolean(req.headers.origin);

    if (isPnaExplicit || hasOrigin) {
      if (verbose && isPnaExplicit) {
        logger.log("VERBOSE", `[PNA] Allowing Private Network Access`);
      }

      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }

    next();
  };
}
