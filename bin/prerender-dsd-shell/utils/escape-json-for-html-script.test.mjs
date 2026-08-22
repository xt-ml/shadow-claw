import { escapeJsonForHtmlScript } from "./escape-json-for-html-script.mjs";

describe("escapeJsonForHtmlScript", () => {
  it("escapes characters unsafe for script tag payloads", () => {
    const escaped = escapeJsonForHtmlScript("</script>\u2028\u2029");
    expect(escaped).toBe("\\u003c\\u002fscript\\u003e\\u2028\\u2029");
  });
});
