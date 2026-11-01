import {
  generateSingleFileServiceWorker,
  generateSingleFileSwRegistration,
} from "./single-file-service-worker.js";

describe("generateSingleFileServiceWorker", () => {
  it("stamps the build version so each build yields a byte-different worker", () => {
    const a = generateSingleFileServiceWorker("https://cdn.example/x", "aaa");
    const b = generateSingleFileServiceWorker("https://cdn.example/x", "bbb");

    expect(a).toContain("// build: aaa");
    expect(a).not.toBe(b);
  });

  it("only skips waiting when asked via message", () => {
    const sw = generateSingleFileServiceWorker("https://cdn.example/x", "aaa");

    expect(sw).toContain('"SKIP_WAITING"');
    expect(sw).not.toMatch(/"install"[\s\S]{0,80}skipWaiting/);
  });
});

describe("generateSingleFileSwRegistration", () => {
  it("bakes the configured timing options into the registration script", () => {
    const script = generateSingleFileSwRegistration({
      checkIntervalMs: 12345,
      checkOnFocus: true,
      checkMinGapMs: 6789,
      repromptIntervalMs: 99999,
    });

    expect(script).toContain("CHECK_INTERVAL_MS = 12345");
    expect(script).toContain("CHECK_ON_FOCUS = true");
    expect(script).toContain("CHECK_MIN_GAP_MS = 6789");
    expect(script).toContain("REPROMPT_INTERVAL_MS = 99999");
    expect(script).toContain('updateViaCache: "none"');
  });

  it("includes Trusted Types script URL wrapping for service worker registration", () => {
    const script = generateSingleFileSwRegistration({
      checkIntervalMs: 0,
      checkOnFocus: false,
      checkMinGapMs: 0,
      repromptIntervalMs: 0,
    });

    expect(script).toContain("trustedTypes.getPolicy");
    expect(script).toContain("register(swUrl,");
    expect(script).toContain('let swUrl = "service-worker.js"');
  });
});
