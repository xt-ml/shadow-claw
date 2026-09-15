import { describe, it, expect } from "@jest/globals";
import { sanitizeRenderedHtml } from "./sanitize-rendered-html.js";

describe("sanitizeRenderedHtml", () => {
  it("strips script tags and inline on* event attributes", () => {
    const raw =
      "<div onclick=\"alert(1)\"><script>alert(2)</script><p onmouseover='x()'>Hello</p></div>";
    const sanitized = sanitizeRenderedHtml(raw);
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("onmouseover");
    expect(sanitized).toContain("Hello");
  });
});
