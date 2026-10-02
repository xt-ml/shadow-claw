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

  it("preserves approved scripts when approvedScripts set is provided", () => {
    const raw = [
      "<article>",
      '<script type="module" src="/pages/main/assets/x-hook-component.js"></script>',
      '<script type="module" src="/pages/main/assets/unapproved.js"></script>',
      "<script>alert('xss')</script>",
      "<p>Hello</p>",
      "</article>",
    ].join("\n");

    const sanitized = sanitizeRenderedHtml(raw, [
      "/pages/main/assets/x-hook-component.js",
    ]);

    expect(sanitized).toContain(
      '<script type="module" src="/pages/main/assets/x-hook-component.js"></script>',
    );
    expect(sanitized).not.toContain("unapproved.js");
    expect(sanitized).not.toContain("alert('xss')");
    expect(sanitized).toContain("<p>Hello</p>");
  });
});
