import type { NextFunction, Request, Response } from "express";

import {
  buildCspReportOnlyValue,
  type CspOptions,
} from "../../security/csp.js";

function shouldIncludeTrustedTypes(userAgent: string): boolean {
  return !/\bfirefox\//i.test(userAgent);
}

export interface CspMiddlewareOptions extends CspOptions {
  rootPath?: string;
  config?: any;
}

export function createCspReportOnlyMiddleware(
  options: CspMiddlewareOptions = {},
) {
  const chromiumCsp = buildCspReportOnlyValue({
    ...options,
    includeTrustedTypes: options.includeTrustedTypes ?? true,
  });
  const firefoxCsp = buildCspReportOnlyValue({
    ...options,
    includeTrustedTypes: false,
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const userAgent = req.get("user-agent") ?? "";
    const isFirefox = !shouldIncludeTrustedTypes(userAgent);

    res.setHeader(
      "Content-Security-Policy-Report-Only",
      isFirefox ? firefoxCsp : chromiumCsp,
    );
    res.setHeader("Origin-Agent-Cluster", "?1");

    next();
  };
}
