import { insertBeforeClosingHead } from "./insert-before-closing-head.mjs";

describe("insertBeforeClosingHead", () => {
  it("inserts before closing head tag when present", () => {
    const html = "<html><head><title>x</title></head><body></body></html>";
    const inserted = insertBeforeClosingHead(html, "<meta name='x' />");
    expect(inserted).toContain("<meta name='x' />\n</head>");
  });

  it("prepends content when no head is found", () => {
    const html = "<div>hello</div>";
    const inserted = insertBeforeClosingHead(html, "<meta name='x' />");
    expect(inserted.startsWith("<meta name='x' />\n")).toBe(true);
  });
});
