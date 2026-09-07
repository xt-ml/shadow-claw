import { buildHtmlPageSrcdoc } from "./buildHtmlPageSrcdoc.js";
import { setAllowedCustomElements } from "../../../security/custom-element-security.js";

describe("buildHtmlPageSrcdoc", () => {
  afterEach(() => {
    const existing = document.getElementById("shadow-claw-site-config");
    if (existing) {
      existing.remove();
    }
  });

  it("builds complete HTML srcdoc with CSP, base href, scripts, and safe content", async () => {
    const html = await buildHtmlPageSrcdoc({
      content: "<h1>Hello World</h1>",
      filePath: "index.html",
      searchParams: "?foo=bar",
      groupId: "main",
      origin: "http://localhost:3000",
      resolveRelativeImagesInHtmlFn: async (c) => c,
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(html).toContain("<h1>Hello World</h1>");
    expect(html).toContain("iframe-storage-bridge.js");
    expect(html).toContain("file-viewer-preview-bridge.js");
    expect(html).toContain("foo=bar");
    expect(html).not.toContain('<link rel="stylesheet" href="/theme.css">');
  });

  it("preserves approved custom elements in srcdoc", async () => {
    setAllowedCustomElements(["block-garden"]);
    const html = await buildHtmlPageSrcdoc({
      content:
        '<block-garden id="live-block-garden" data-no-nav></block-garden>',
      filePath: "index.html",
      groupId: "main",
      origin: "http://localhost:3000",
    });

    expect(html).toContain("<block-garden");
    expect(html).toContain('id="live-block-garden"');
  });

  it("includes theme stylesheet link when configured in site config", async () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-site-config";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      theme: { stylesheet: "pages/main/theme.css" },
    });
    document.head.appendChild(script);

    const html = await buildHtmlPageSrcdoc({
      content: "<p>Themed content</p>",
      filePath: "index.html",
      groupId: "main",
      origin: "http://localhost:3000",
    });

    expect(html).toContain(
      '<link rel="stylesheet" href="/pages/main/theme.css">',
    );
  });
});
