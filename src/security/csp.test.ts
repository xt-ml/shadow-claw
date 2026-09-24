import { describe, expect, it, jest } from "@jest/globals";

import {
  applyCspReportOnlyHeader,
  buildCspReportOnlyValue,
  extractCspConfigOrigins,
} from "./csp.js";
import { getTrustedTypesPolicyName } from "./trusted-types.js";

describe("csp", () => {
  it("builds a report-only CSP value with trusted-types directives", () => {
    const value = buildCspReportOnlyValue();

    expect(value).toContain("default-src 'self'");
    expect(value).toContain("object-src 'none'");
    expect(value).toContain("base-uri 'self'");
    expect(value).toContain("frame-ancestors 'none'");
    expect(value).toContain("frame-src 'self' https://www.youtube.com");
    expect(value).not.toContain("youtube-nocookie.com");
    expect(value).toContain("media-src 'self' data: blob:");
    expect(value).toContain("worker-src 'self' blob: data:");
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
    expect(value).toContain("worker-src 'self' blob: data:");
    expect(value).toContain("report-uri /__cspreport");
  });

  it("extracts allowed domains, script hosts, and security overrides from config", () => {
    const config = {
      customElements: {
        allowedDomains: ["kherrick.github.io", "cdn.jsdelivr.net"],
        scripts: [
          {
            src: "https://kherrick.github.io/block-garden-knowledge-hub/.agents/scripts/main/block-garden-adapter.js",
            hasInit: true,
          },
          "https://example.com/bundle.js",
        ],
      },
      security: {
        workerSrc: ["blob:", "data:"],
        connectSrc: ["https://api.example.com"],
      },
    };

    const extracted = extractCspConfigOrigins(config);
    expect(extracted.scriptHosts).toContain("https://kherrick.github.io");
    expect(extracted.scriptHosts).toContain("https://example.com");
    expect(extracted.scriptHosts).toContain("https://cdn.jsdelivr.net");
    expect(extracted.connectSources).toContain("https://api.example.com");
    expect(extracted.workerSources).toContain("blob:");
    expect(extracted.workerSources).toContain("data:");

    const csp = buildCspReportOnlyValue({ config });
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' https://kherrick.github.io",
    );
    expect(csp).toContain("https://example.com");
    expect(csp).toContain("worker-src 'self' blob: data:");
    expect(csp).toContain(
      "connect-src 'self' https: wss: ws: data: https://kherrick.github.io",
    );
  });

  it("resolves workspace config from rootPath or parent directories (e.g. dist/public)", () => {
    const csp = buildCspReportOnlyValue({ rootPath: "dist/public" });
    expect(csp).toContain("https://kherrick.github.io");
    expect(csp).toContain("https://cdn.jsdelivr.net");
    expect(csp).toContain("worker-src 'self' blob: data:");
  });

  it("incorporates explicit scriptSources, workerSources, and connectSources options", () => {
    const csp = buildCspReportOnlyValue({
      config: null,
      scriptSources: ["https://trusted.cdn.com"],
      workerSources: ["worker-test:"],
      connectSources: ["https://remote.api.com"],
    });

    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' https://trusted.cdn.com",
    );
    expect(csp).toContain("worker-src 'self' blob: data: worker-test:");
    expect(csp).toContain(
      "connect-src 'self' https: wss: ws: data: https://remote.api.com",
    );
  });

  it("applies Content-Security-Policy-Report-Only and Origin-Agent-Cluster headers", () => {
    const res = {
      setHeader: jest.fn(),
    } as unknown as { setHeader: (name: string, value: string) => void };

    applyCspReportOnlyHeader(res);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Security-Policy-Report-Only",
      expect.any(String),
    );
    expect(res.setHeader).toHaveBeenCalledWith("Origin-Agent-Cluster", "?1");
  });
});
