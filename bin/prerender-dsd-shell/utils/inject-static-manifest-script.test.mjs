import { injectStaticManifestScript } from "./inject-static-manifest-script.mjs";

describe("injectStaticManifestScript", () => {
  it("injects static manifest and routing script tags", () => {
    const html = "<html><head></head><body></body></html>";
    const next = injectStaticManifestScript(html, '{"pages":[]}');
    expect(next).toContain('id="shadow-claw-static-manifest"');
    expect(next).toContain('id="shadow-claw-static-routing"');
  });

  it("replaces existing static manifest tag", () => {
    const html =
      '<html><head><script id="shadow-claw-static-manifest" type="application/json">{"old":true}</script></head><body></body></html>';
    const next = injectStaticManifestScript(html, '{"new":true}');
    expect(next).toContain('{"new":true}');
    expect(next).not.toContain('{"old":true}');
  });

  it("does not duplicate routing script if already present", () => {
    const html =
      '<html><head><script id="shadow-claw-static-routing" type="application/json">{"routes":{"a":1}}</script></head><body></body></html>';
    const next = injectStaticManifestScript(html, '{"pages":[]}');
    const matches = next.match(/id="shadow-claw-static-routing"/g);
    expect(matches).toHaveLength(1);
  });
});
