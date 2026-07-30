import {
  DEFAULT_ALLOWED_IFRAME_HOST_PATTERNS,
  ensureIframeSanitizerHook,
  getAllowedIframeHostPatterns,
  getDOMPurify,
  isSafeIframeSource,
  parseHostPatternMatch,
  setAllowedIframeHostPatterns,
} from "./iframe-sanitizer.js";

describe("iframe-sanitizer", () => {
  beforeEach(() => {
    setAllowedIframeHostPatterns([...DEFAULT_ALLOWED_IFRAME_HOST_PATTERNS]);
  });

  describe("isSafeIframeSource", () => {
    it("allows default YouTube and GitHub Pages embeds", () => {
      expect(getAllowedIframeHostPatterns()).toEqual(
        DEFAULT_ALLOWED_IFRAME_HOST_PATTERNS,
      );
      expect(
        isSafeIframeSource(
          "https://www.youtube.com/embed/h1les1A3gcg?feature=oembed",
        ),
      ).toBe(true);
      expect(
        isSafeIframeSource("https://youtube-nocookie.com/embed/h1les1A3gcg"),
      ).toBe(true);
      expect(isSafeIframeSource("https://youtu.be/h1les1A3gcg")).toBe(true);
      expect(isSafeIframeSource("https://xt-ml.github.io/shadow-claw/")).toBe(
        true,
      );
      expect(
        isSafeIframeSource("https://kherrick.github.io/some-page/index.html"),
      ).toBe(true);
    });

    it("rejects non-default external domains unless added to allowed patterns", () => {
      expect(isSafeIframeSource("https://player.vimeo.com/video/12345")).toBe(
        false,
      );
      expect(isSafeIframeSource("https://evil-phishing-domain.com")).toBe(
        false,
      );

      setAllowedIframeHostPatterns([
        "vimeo.com",
        "youtube.com",
        "xt-ml.github.io",
      ]);

      expect(isSafeIframeSource("https://player.vimeo.com/video/12345")).toBe(
        true,
      );
    });

    it("supports regex patterns in allowed iframe host settings", () => {
      setAllowedIframeHostPatterns(["/^(?:[a-z0-9-]+\\.)*vimeo\\.com$/i"]);

      expect(isSafeIframeSource("https://player.vimeo.com/video/12345")).toBe(
        true,
      );
      expect(isSafeIframeSource("https://vimeo.com/12345")).toBe(true);
      expect(isSafeIframeSource("https://youtube.com/embed/123")).toBe(false);
    });

    it("rejects dangerous URI schemes", () => {
      expect(isSafeIframeSource("javascript:alert(1)")).toBe(false);
      expect(
        isSafeIframeSource("data:text/html,<script>alert(1)</script>"),
      ).toBe(false);
      expect(isSafeIframeSource("vbscript:msgbox(1)")).toBe(false);
    });

    it("rejects invalid URLs and empty input", () => {
      expect(isSafeIframeSource("")).toBe(false);
      expect(isSafeIframeSource("   ")).toBe(false);
      expect(isSafeIframeSource(null as any)).toBe(false);
    });
  });

  describe("parseHostPatternMatch", () => {
    it("parses domain names, wildcards, and regex patterns correctly", () => {
      const matchDomain = parseHostPatternMatch("example.com");
      expect(matchDomain("example.com")).toBe(true);
      expect(matchDomain("sub.example.com")).toBe(true);
      expect(matchDomain("notexample.com")).toBe(false);

      const matchWildcard = parseHostPatternMatch("*.test.org");
      expect(matchWildcard("test.org")).toBe(true);
      expect(matchWildcard("api.test.org")).toBe(true);
      expect(matchWildcard("eviltest.org")).toBe(false);

      const matchRegex = parseHostPatternMatch("/^vimeo\\.com$/i");
      expect(matchRegex("vimeo.com")).toBe(true);
      expect(matchRegex("player.vimeo.com")).toBe(false);
    });
  });

  describe("ensureIframeSanitizerHook", () => {
    beforeAll(() => {
      ensureIframeSanitizerHook();
    });

    it("preserves safe YouTube iframes during DOMPurify sanitization", () => {
      const html =
        '<figure><iframe src="https://www.youtube.com/embed/h1les1A3gcg" width="560" height="315" allowfullscreen></iframe></figure>';
      const sanitized = getDOMPurify().sanitize(html, {
        ADD_TAGS: ["iframe", "figure", "figcaption"],
        ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "referrerpolicy"],
      });

      expect(sanitized).toContain("<iframe");
      expect(sanitized).toContain(
        'src="https://www.youtube.com/embed/h1les1A3gcg"',
      );
      expect(sanitized).toContain("<figure>");
    });

    it("removes unsafe or non-whitelisted iframes during DOMPurify sanitization", () => {
      const unsafeHtml =
        '<iframe src="https://evil-domain.com/phishing"></iframe>';
      const sanitized = getDOMPurify().sanitize(unsafeHtml, {
        ADD_TAGS: ["iframe"],
      });

      expect(sanitized).not.toContain("<iframe");
      expect(sanitized).not.toContain("evil-domain.com");
    });

    it("removes javascript: scheme iframes", () => {
      const jsHtml = '<iframe src="javascript:alert(1)"></iframe>';
      const sanitized = getDOMPurify().sanitize(jsHtml, {
        ADD_TAGS: ["iframe"],
      });

      expect(sanitized).not.toContain("<iframe");
      expect(sanitized).not.toContain("javascript:");
    });
  });
});
