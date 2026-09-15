import { describe, it, expect } from "@jest/globals";
import { injectStaticManifestScript } from "./inject-static-manifest-script.js";

describe("injectStaticManifestScript", () => {
  it("injects manifest script and empty static routing fallback into HTML", () => {
    const html =
      "<!doctype html><html><head><title>Test</title></head><body></body></html>";
    const manifest = JSON.stringify({ pages: ["a.md"] });
    const result = injectStaticManifestScript(html, manifest);

    expect(result).toContain('id="shadow-claw-static-manifest"');
    expect(result).toContain('id="shadow-claw-static-routing"');
    expect(result).toContain('{"routes":{}}');
  });

  it("replaces existing manifest script when present", () => {
    const html =
      '<!doctype html><html><head><script id="shadow-claw-static-manifest" type="application/json">{"old":true}</script></head><body></body></html>';
    const manifest = JSON.stringify({ updated: true });
    const result = injectStaticManifestScript(html, manifest);

    expect(result).not.toContain('{"old":true}');
    expect(result).toContain('{"updated":true}');
  });
});
