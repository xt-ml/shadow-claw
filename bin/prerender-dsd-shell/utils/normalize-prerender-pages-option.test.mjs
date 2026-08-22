import { normalizePrerenderPagesOption } from "./normalize-prerender-pages-option.mjs";

describe("normalizePrerenderPagesOption", () => {
  it("normalizes supported values", () => {
    expect(normalizePrerenderPagesOption()).toBe(1);
    expect(normalizePrerenderPagesOption(true)).toBe(1);
    expect(normalizePrerenderPagesOption("all")).toBe("all");
    expect(normalizePrerenderPagesOption("none")).toBe(0);
    expect(normalizePrerenderPagesOption("false")).toBe(0);
    expect(normalizePrerenderPagesOption("current")).toBe(1);
    expect(normalizePrerenderPagesOption("3")).toBe(3);
    expect(normalizePrerenderPagesOption("bad")).toBe(1);
  });
});
