import { describe, it, expect } from "@jest/globals";
import { escapeHtml } from "./escape-html.js";

describe("escapeHtml", () => {
  it("escapes special HTML characters", () => {
    expect(escapeHtml("<script>alert(\"xss\" & 'test')</script>")).toBe(
      "&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;test&#39;)&lt;/script&gt;",
    );
  });
});
