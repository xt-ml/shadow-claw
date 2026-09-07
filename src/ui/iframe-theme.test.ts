import {
  getIframeThemeStyleHtml,
  getIframeHtmlClass,
  getIframeThemeStylesheetLink,
  resolveThemeStylesheetHref,
} from "./iframe-theme.js";

describe("iframe-theme utility", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark-mode", "light-mode");
    const existing = document.getElementById("shadow-claw-site-config");
    if (existing) {
      existing.remove();
    }
  });

  it("returns light-mode class and styles by default when dark-mode is absent", () => {
    expect(getIframeHtmlClass()).toBe("light-mode");

    const html = getIframeThemeStyleHtml();
    expect(html).toContain("color-scheme: light;");
    expect(html).toContain("font-family: var(--shadow-claw-font-sans);");
    expect(html).toContain("font-family: var(--shadow-claw-font-mono);");
    expect(html).toContain("color: var(--shadow-claw-link);");
    expect(html).toContain("text-underline-offset: 0.125rem;");
    expect(html).toContain("color: var(--shadow-claw-link-hover);");
    expect(html).toContain("color: var(--shadow-claw-text-primary);");
    expect(html).toContain(
      "scrollbar-color: var(--shadow-claw-border-color) transparent;",
    );
  });

  it("returns dark-mode class and styles when document root has dark-mode class", () => {
    document.documentElement.classList.add("dark-mode");

    expect(getIframeHtmlClass()).toBe("dark-mode");

    const html = getIframeThemeStyleHtml();
    expect(html).toContain("color-scheme: dark;");
  });

  describe("resolveThemeStylesheetHref", () => {
    it.each([
      ["pages/resources/theme.css", "theme.css"],
      ["pages/deps/theme.css", "theme.css"],
      ["resources/theme.css", "theme.css"],
      ["deps/theme.css", "theme.css"],
      ["pages/assets/theme.css", "theme.css"],
      ["pages/main/assets/theme.css", "theme.css"],
    ])("flattens %s to %s", (input, expected) => {
      expect(resolveThemeStylesheetHref(input)).toBe(expected);
    });

    it("retains non-flattened paths such as pages/main/theme.css", () => {
      expect(resolveThemeStylesheetHref("pages/main/theme.css")).toBe(
        "pages/main/theme.css",
      );
    });
  });

  describe("getIframeThemeStylesheetLink", () => {
    it("returns empty string when no theme stylesheet is configured", () => {
      expect(getIframeThemeStylesheetLink()).toBe("");
      expect(getIframeThemeStylesheetLink({})).toBe("");
      expect(getIframeThemeStylesheetLink({ theme: {} })).toBe("");
      expect(getIframeThemeStylesheetLink({ theme: { stylesheet: "" } })).toBe(
        "",
      );
    });

    it("returns link element for pages/main/theme.css", () => {
      const link = getIframeThemeStylesheetLink({
        theme: { stylesheet: "pages/main/theme.css" },
      });
      expect(link).toBe('<link rel="stylesheet" href="/pages/main/theme.css">');
    });

    it("returns link element for flattened stylesheet path pages/resources/theme.css", () => {
      const link = getIframeThemeStylesheetLink({
        theme: { stylesheet: "pages/resources/theme.css" },
      });
      expect(link).toBe('<link rel="stylesheet" href="/theme.css">');
    });

    it("returns link element for external URL as-is", () => {
      const link = getIframeThemeStylesheetLink({
        theme: { stylesheet: "https://example.com/custom-theme.css" },
      });
      expect(link).toBe(
        '<link rel="stylesheet" href="https://example.com/custom-theme.css">',
      );
    });

    it("reads from #shadow-claw-site-config DOM element when no argument is passed", () => {
      const script = document.createElement("script");
      script.id = "shadow-claw-site-config";
      script.type = "application/json";
      script.textContent = JSON.stringify({
        theme: { stylesheet: "pages/main/theme.css" },
      });
      document.head.appendChild(script);

      expect(getIframeThemeStylesheetLink()).toBe(
        '<link rel="stylesheet" href="/pages/main/theme.css">',
      );
    });
  });
});
