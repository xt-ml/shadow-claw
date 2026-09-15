import { describe, it, expect } from "@jest/globals";
import { escapeJsonForHtmlScript } from "./escape-json-for-html-script.js";

describe("escapeJsonForHtmlScript", () => {
  it("escapes characters dangerous in script tags and JS line terminators", () => {
    const raw = '{"html":"</script>","line":"\u2028\u2029"}';
    const escaped = escapeJsonForHtmlScript(raw);
    expect(escaped).not.toContain("</script>");
    expect(escaped).toContain("\\u003c\\u002fscript\\u003e");
    expect(escaped).toContain("\\u2028");
    expect(escaped).toContain("\\u2029");
  });
});
