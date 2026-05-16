import { getTrustedTypesPolicyName } from "./trusted-types.js";

const REPORT_ONLY_CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self' https: wss: ws: data:",
  `trusted-types ${getTrustedTypesPolicyName()} dompurify default`,
  "require-trusted-types-for 'script'",
].join("; ");

export function buildCspReportOnlyValue(): string {
  return REPORT_ONLY_CSP_DIRECTIVES;
}

export function applyCspReportOnlyHeader(res: {
  setHeader: (name: string, value: string) => unknown;
}): void {
  res.setHeader(
    "Content-Security-Policy-Report-Only",
    buildCspReportOnlyValue(),
  );
}
