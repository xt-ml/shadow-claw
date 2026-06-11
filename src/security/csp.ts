import { getTrustedTypesPolicyName } from "./trusted-types.js";

type CspOptions = {
  includeTrustedTypes?: boolean;
};

export function buildCspReportOnlyValue(options: CspOptions = {}): string {
  const includeTrustedTypes = options.includeTrustedTypes ?? true;

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "script-src 'self'",
    "worker-src 'self' blob:",
    "connect-src 'self' https: wss: ws: data:",
    "report-uri /__cspreport",
  ];

  if (includeTrustedTypes) {
    directives.push(
      `trusted-types ${getTrustedTypesPolicyName()} shadowclaw-sandbox dompurify default`,
      "require-trusted-types-for 'script'",
    );
  }

  return directives.join("; ");
}

export function applyCspReportOnlyHeader(
  res: {
    setHeader: (name: string, value: string) => unknown;
  },
  options: CspOptions = {},
): void {
  res.setHeader(
    "Content-Security-Policy-Report-Only",
    buildCspReportOnlyValue(options),
  );
}
