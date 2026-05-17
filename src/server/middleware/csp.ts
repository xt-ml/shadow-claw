import type { NextFunction, Request, Response } from "express";

import { applyCspReportOnlyHeader } from "../../security/csp.js";

function shouldIncludeTrustedTypes(userAgent: string): boolean {
  return !/\bfirefox\//i.test(userAgent);
}

export function createCspReportOnlyMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userAgent = req.get("user-agent") ?? "";

    applyCspReportOnlyHeader(res, {
      includeTrustedTypes: shouldIncludeTrustedTypes(userAgent),
    });

    next();
  };
}
