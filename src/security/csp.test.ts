import { describe, expect, it, jest } from "@jest/globals";

import { applyCspReportOnlyHeader, buildCspReportOnlyValue } from "./csp.js";
import { getTrustedTypesPolicyName } from "./trusted-types.js";

describe("csp", () => {
  it("builds a report-only CSP value with trusted-types directives", () => {
    const value = buildCspReportOnlyValue();

    expect(value).toContain("default-src 'self'");
    expect(value).toContain("object-src 'none'");
    expect(value).toContain("base-uri 'none'");
    expect(value).toContain("frame-ancestors 'none'");
    expect(value).toContain(`trusted-types ${getTrustedTypesPolicyName()}`);
    expect(value).toContain("dompurify");
    expect(value).toContain("require-trusted-types-for 'script'");
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
