import { sanitizeRenderedHtml } from "./sanitize-rendered-html.mjs";

describe("sanitizeRenderedHtml", () => {
  it("removes script tags and inline event handlers", () => {
    const html =
      '<div onclick="x()"><script>alert(1)</script><span onmouseover="y()">ok</span></div>';
    const sanitized = sanitizeRenderedHtml(html);
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("onclick=");
    expect(sanitized).not.toContain("onmouseover=");
    expect(sanitized).toContain("<span");
  });
});
