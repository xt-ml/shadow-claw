import { buildHtmlPageSrcdoc } from "./buildHtmlPageSrcdoc.js";

describe("buildHtmlPageSrcdoc", () => {
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
  });
});
