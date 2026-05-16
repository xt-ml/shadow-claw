import type { NextFunction, Request, Response } from "express";

import { applyCspReportOnlyHeader } from "../../security/csp.js";

export function createCspReportOnlyMiddleware() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    applyCspReportOnlyHeader(res);
    next();
  };
}
