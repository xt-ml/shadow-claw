import { isHtmlPath, isMarkdownPath } from "./pageFileTypes.js";

describe("pageFileTypes", () => {
  describe("isHtmlPath", () => {
    it("returns true for .html, .htm, and .xhtml extensions (case-insensitive)", () => {
      expect(isHtmlPath("index.html")).toBe(true);
      expect(isHtmlPath("index.HTM")).toBe(true);
      expect(isHtmlPath("page.xhtml")).toBe(true);
      expect(isHtmlPath("/docs/about.HTML")).toBe(true);
    });

    it("returns false for non-html extensions or empty strings", () => {
      expect(isHtmlPath("index.md")).toBe(false);
      expect(isHtmlPath("index.js")).toBe(false);
      expect(isHtmlPath("html")).toBe(false);
      expect(isHtmlPath("")).toBe(false);
    });
  });

  describe("isMarkdownPath", () => {
    it("returns true for .md and .markdown extensions (case-insensitive)", () => {
      expect(isMarkdownPath("README.md")).toBe(true);
      expect(isMarkdownPath("guide.MARKDOWN")).toBe(true);
      expect(isMarkdownPath("/docs/notes.Md")).toBe(true);
    });

    it("returns false for non-markdown extensions or empty strings", () => {
      expect(isMarkdownPath("README.html")).toBe(false);
      expect(isMarkdownPath("guide.txt")).toBe(false);
      expect(isMarkdownPath("md")).toBe(false);
      expect(isMarkdownPath("")).toBe(false);
    });
  });
});
