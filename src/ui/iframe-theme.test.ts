import { getIframeThemeStyleHtml, getIframeHtmlClass } from "./iframe-theme.js";

describe("iframe-theme utility", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark-mode", "light-mode");
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
});
