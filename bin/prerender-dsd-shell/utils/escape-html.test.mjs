import { escapeHtml } from "./escape-html.mjs";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<a "b" 'c' & d>`)).toBe(
      "&lt;a &quot;b&quot; &#39;c&#39; &amp; d&gt;",
    );
  });
});
