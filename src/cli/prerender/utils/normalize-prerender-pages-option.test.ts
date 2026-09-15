import { describe, it, expect } from "@jest/globals";
import { normalizePrerenderPagesOption } from "./normalize-prerender-pages-option.js";

describe("normalizePrerenderPagesOption", () => {
  it("defaults to 1 for undefined, null, empty string, and true", () => {
    expect(normalizePrerenderPagesOption(undefined)).toBe(1);
    expect(normalizePrerenderPagesOption(null)).toBe(1);
    expect(normalizePrerenderPagesOption("")).toBe(1);
    expect(normalizePrerenderPagesOption(true)).toBe(1);
  });

  it("handles 'all'", () => {
    expect(normalizePrerenderPagesOption("all")).toBe("all");
    expect(normalizePrerenderPagesOption("ALL")).toBe("all");
  });

  it("handles 'none', '0', 'false', and 0", () => {
    expect(normalizePrerenderPagesOption("none")).toBe(0);
    expect(normalizePrerenderPagesOption("0")).toBe(0);
    expect(normalizePrerenderPagesOption("false")).toBe(0);
    expect(normalizePrerenderPagesOption(0)).toBe(0);
  });

  it("parses valid numbers", () => {
    expect(normalizePrerenderPagesOption("5")).toBe(5);
    expect(normalizePrerenderPagesOption(10)).toBe(10);
  });
});
