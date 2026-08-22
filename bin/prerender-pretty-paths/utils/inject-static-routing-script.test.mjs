import { injectStaticRoutingScript } from "./inject-static-routing-script.mjs";

describe("injectStaticRoutingScript (utils)", () => {
  it("injects routing script safely", () => {
    const html = "<html><head></head><body></body></html>";
    const next = injectStaticRoutingScript(
      html,
      '{"routes":{"/a":{"prettyPath":"/b/"}}}',
    );
    expect(next).toContain('id="shadow-claw-static-routing"');
    expect(next).toContain("\\u002fb\\u002f");
  });

  it("replaces existing static routing script", () => {
    const html =
      '<html><head><script id="shadow-claw-static-routing" type="application/json">{"routes":{"a":1}}</script></head><body></body></html>';
    const next = injectStaticRoutingScript(
      html,
      '{"routes":{"b":2},"path":"/b"}',
    );
    expect(next).toContain('"b":2');
    expect(next).toContain("\\u002fb");
    expect(next).not.toContain('"a":1');
    expect(next.match(/id="shadow-claw-static-routing"/g)).toHaveLength(1);
  });
});
