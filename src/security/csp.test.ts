import { describe, expect, it, jest } from "@jest/globals";

import { applyCspReportOnlyHeader, buildCspReportOnlyValue } from "./csp.js";
import { getTrustedTypesPolicyName } from "./trusted-types.js";

describe("csp", () => {
  it("builds a report-only CSP value with trusted-types directives", () => {
    const value = buildCspReportOnlyValue();

    expect(value).toContain("default-src 'self'");
    expect(value).toContain("object-src 'none'");
    expect(value).toContain("base-uri 'self'");
    expect(value).toContain("frame-ancestors 'none'");
    expect(value).toContain("media-src 'self' data: blob:");
    expect(value).toContain(`trusted-types ${getTrustedTypesPolicyName()}`);
    expect(value).toContain("shadowclaw-sandbox");
    expect(value).toContain("dompurify");
    expect(value).toContain("require-trusted-types-for 'script'");
    expect(value).toContain("report-uri /__cspreport");
  });

  it("builds a Firefox-safe report-only CSP value without trusted-types sinks", () => {
    const value = buildCspReportOnlyValue({ includeTrustedTypes: false });

    expect(value).not.toContain("trusted-types ");
    expect(value).not.toContain("require-trusted-types-for 'script'");
    expect(value).toContain("report-uri /__cspreport");
  });

  it("applies Content-Security-Policy-Report-Only header", () => {
    const res = {
      setHeader: jest.fn(),
    } as unknown as { setHeader: (name: string, value: string) => void };

    applyCspReportOnlyHeader(res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Security-Policy-Report-Only",
      expect.any(String),
    );
  });
});
