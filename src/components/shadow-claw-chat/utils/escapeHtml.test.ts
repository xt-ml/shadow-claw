import { escapeHtml } from "./escapeHtml.js";

describe("escapeHtml", () => {
  it("escapes special HTML characters (&, <, >, \", ')", () => {
    expect(escapeHtml("<script>alert('xss & \"foo\"')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss &amp; &quot;foo&quot;&#39;)&lt;/script&gt;",
    );
  });

  it("handles string without special characters", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});
