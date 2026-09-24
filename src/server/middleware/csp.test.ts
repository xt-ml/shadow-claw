/** @jest-environment node */
import { jest } from "@jest/globals";

import { createCspReportOnlyMiddleware } from "./csp.js";

describe("csp-middleware", () => {
  it("omits Trusted Types directives for Firefox user agents", () => {
    const middleware = createCspReportOnlyMiddleware();
    const req = {
      get: (name: string) =>
        name.toLowerCase() === "user-agent"
          ? "Mozilla/5.0 Firefox/126.0"
          : undefined,
    } as any;
    const res = {
      setHeader: jest.fn(),
    } as any;
    const next = jest.fn();

    middleware(req, res, next);

    const cspValue = res.setHeader.mock.calls[0][1] as string;
    expect(cspValue).not.toContain("trusted-types ");
    expect(cspValue).not.toContain("require-trusted-types-for 'script'");
    expect(res.setHeader).toHaveBeenCalledWith("Origin-Agent-Cluster", "?1");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("keeps Trusted Types directives for Chromium user agents", () => {
    const middleware = createCspReportOnlyMiddleware();
    const req = {
      get: (name: string) =>
        name.toLowerCase() === "user-agent"
          ? "Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36"
          : undefined,
    } as any;
    const res = {
      setHeader: jest.fn(),
    } as any;
    const next = jest.fn();

    middleware(req, res, next);

    const cspValue = res.setHeader.mock.calls[0][1] as string;
    expect(cspValue).toContain("trusted-types ");
    expect(cspValue).toContain("require-trusted-types-for 'script'");
    expect(res.setHeader).toHaveBeenCalledWith("Origin-Agent-Cluster", "?1");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("incorporates custom config origins into CSP report-only header", () => {
    const middleware = createCspReportOnlyMiddleware({
      config: {
        customElements: {
          allowedDomains: ["test-custom-domain.org"],
          scripts: ["https://test-script-host.com/main.js"],
        },
      },
    });

    const req = {
      get: () => "Mozilla/5.0 Firefox/126.0",
    } as any;
    const res = {
      setHeader: jest.fn(),
    } as any;
    const next = jest.fn();

    middleware(req, res, next);

    const cspValue = res.setHeader.mock.calls[0][1] as string;
    expect(cspValue).toContain("https://test-custom-domain.org");
    expect(cspValue).toContain("https://test-script-host.com");
    expect(cspValue).toContain("worker-src 'self' blob: data:");
    expect(res.setHeader).toHaveBeenCalledWith("Origin-Agent-Cluster", "?1");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
