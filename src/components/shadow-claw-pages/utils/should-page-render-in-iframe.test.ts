import { shouldPageRenderInIframe } from "./should-page-render-in-iframe.js";

describe("shouldPageRenderInIframe", () => {
  afterEach(() => {
    const existing = document.getElementById("shadow-claw-site-config");
    if (existing) {
      existing.remove();
    }
  });

  it("returns false for non-HTML paths (e.g. markdown)", () => {
    expect(shouldPageRenderInIframe("MEMORY.md")).toBe(false);
    expect(shouldPageRenderInIframe("about.markdown")).toBe(false);
    expect(shouldPageRenderInIframe("image.png")).toBe(false);
    expect(shouldPageRenderInIframe("")).toBe(false);
  });

  it("returns true by default for HTML pages without special config", () => {
    expect(shouldPageRenderInIframe("index.html")).toBe(true);
    expect(shouldPageRenderInIframe("pages/main/index.html")).toBe(true);
    expect(shouldPageRenderInIframe("portfolio.htm")).toBe(true);
    expect(shouldPageRenderInIframe("app.xhtml")).toBe(true);
  });

  describe("frontmatter overrides", () => {
    it("returns false when frontmatter has iframe: false", () => {
      expect(shouldPageRenderInIframe("index.html", { iframe: false })).toBe(
        false,
      );
      expect(shouldPageRenderInIframe("index.html", { iframe: "false" })).toBe(
        false,
      );
    });

    it("returns false when frontmatter has render: 'shadow' or 'direct'", () => {
      expect(shouldPageRenderInIframe("index.html", { render: "shadow" })).toBe(
        false,
      );
      expect(shouldPageRenderInIframe("index.html", { render: "direct" })).toBe(
        false,
      );
    });

    it("returns false when frontmatter has shadowDom: true", () => {
      expect(shouldPageRenderInIframe("index.html", { shadowDom: true })).toBe(
        false,
      );
    });

    it("returns true when frontmatter explicitly sets iframe: true", () => {
      expect(shouldPageRenderInIframe("index.html", { iframe: true })).toBe(
        true,
      );
      expect(shouldPageRenderInIframe("index.html", { render: "iframe" })).toBe(
        true,
      );
    });

    it("frontmatter overrides siteConfig", () => {
      const siteConfig = { pages: { iframe: false } };
      // Frontmatter explicitly forces iframe
      expect(
        shouldPageRenderInIframe("index.html", { iframe: true }, siteConfig),
      ).toBe(true);

      const siteConfigIframeTrue = { pages: { iframe: true } };
      // Frontmatter explicitly disables iframe
      expect(
        shouldPageRenderInIframe(
          "index.html",
          { iframe: false },
          siteConfigIframeTrue,
        ),
      ).toBe(false);
    });
  });

  describe("siteConfig overrides", () => {
    it("returns false when siteConfig has pages.iframe: false", () => {
      const siteConfig = { pages: { iframe: false } };
      expect(shouldPageRenderInIframe("index.html", null, siteConfig)).toBe(
        false,
      );
    });

    it("returns false when siteConfig has pages.render: 'shadow'", () => {
      const siteConfig = { pages: { render: "shadow" } };
      expect(shouldPageRenderInIframe("index.html", null, siteConfig)).toBe(
        false,
      );
    });

    it("returns false when siteConfig has pages.shadowDom: true", () => {
      const siteConfig = { pages: { shadowDom: true } };
      expect(shouldPageRenderInIframe("index.html", null, siteConfig)).toBe(
        false,
      );
    });

    it("supports directPages / shadowDomPages list in siteConfig", () => {
      const siteConfig = {
        pages: { directPages: ["index.html", "/pages/main/portfolio.html"] },
      };
      expect(shouldPageRenderInIframe("index.html", null, siteConfig)).toBe(
        false,
      );
      expect(shouldPageRenderInIframe("portfolio.html", null, siteConfig)).toBe(
        false,
      );
      expect(shouldPageRenderInIframe("other.html", null, siteConfig)).toBe(
        true,
      );
    });

    it("supports iframePages list in siteConfig when iframe is globally false", () => {
      const siteConfig = {
        pages: {
          iframe: false,
          iframePages: ["game.html"],
        },
      };
      expect(shouldPageRenderInIframe("game.html", null, siteConfig)).toBe(
        true,
      );
      expect(shouldPageRenderInIframe("index.html", null, siteConfig)).toBe(
        false,
      );
    });

    it("reads siteConfig from DOM #shadow-claw-site-config when not passed directly", () => {
      const script = document.createElement("script");
      script.id = "shadow-claw-site-config";
      script.type = "application/json";
      script.textContent = JSON.stringify({
        pages: { iframe: false },
      });
      document.head.appendChild(script);

      expect(shouldPageRenderInIframe("index.html")).toBe(false);
    });
  });
});
