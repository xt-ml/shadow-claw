import { insertBeforeClosingHead } from "./insert-before-closing-head.mjs";

describe("insertBeforeClosingHead (pretty-paths)", () => {
  it("inserts content before closing head", () => {
    const html = "<html><head></head><body></body></html>";
    const next = insertBeforeClosingHead(html, "<script>x</script>");
    expect(next).toContain("<script>x</script>\n</head>");
  });

  it("prepends when head tag does not exist", () => {
    const next = insertBeforeClosingHead("<div>x</div>", "<script>x</script>");
    expect(next.startsWith("<script>x</script>\n")).toBe(true);
  });
});
