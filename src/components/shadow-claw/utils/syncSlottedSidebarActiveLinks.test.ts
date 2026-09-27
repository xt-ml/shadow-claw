import { describe, it, expect, beforeEach } from "@jest/globals";
import { syncSlottedSidebarActiveLinks } from "./syncSlottedSidebarActiveLinks.js";

describe("syncSlottedSidebarActiveLinks", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    host.innerHTML = `
      <div slot="sidebar" class="sidebar-custom-sections">
        <a href="/" class="sidebar-link">Home</a>
        <a href="/about" class="sidebar-link">About</a>
        <a href="/portfolio" class="sidebar-link">Portfolio</a>
        <a href="https://external.example.com" class="sidebar-link" target="_blank">External</a>
      </div>
    `;
  });

  it("marks matching internal link as active and sets aria-current='page'", () => {
    const url = new URL("https://example.com/about");
    syncSlottedSidebarActiveLinks(host, url);

    const homeLink = host.querySelector('a[href="/"]');
    const aboutLink = host.querySelector('a[href="/about"]');
    const portfolioLink = host.querySelector('a[href="/portfolio"]');
    const externalLink = host.querySelector(
      'a[href="https://external.example.com"]',
    );

    expect(aboutLink?.classList.contains("active")).toBe(true);
    expect(aboutLink?.getAttribute("aria-current")).toBe("page");

    expect(homeLink?.classList.contains("active")).toBe(false);
    expect(homeLink?.hasAttribute("aria-current")).toBe(false);

    expect(portfolioLink?.classList.contains("active")).toBe(false);
    expect(externalLink?.classList.contains("active")).toBe(false);
  });

  it("handles root path matching correctly with trailing slashes", () => {
    const url = new URL("https://example.com/");
    syncSlottedSidebarActiveLinks(host, url);

    const homeLink = host.querySelector('a[href="/"]');
    const aboutLink = host.querySelector('a[href="/about"]');

    expect(homeLink?.classList.contains("active")).toBe(true);
    expect(homeLink?.getAttribute("aria-current")).toBe("page");
    expect(aboutLink?.classList.contains("active")).toBe(false);
  });

  it("never marks external links as active", () => {
    const url = new URL("https://example.com/");
    syncSlottedSidebarActiveLinks(host, url);

    const externalLink = host.querySelector(
      'a[href="https://external.example.com"]',
    );
    expect(externalLink?.classList.contains("active")).toBe(false);
  });

  it("handles hash links properly without activating sub-items on base route", () => {
    host.innerHTML = `
      <div slot="sidebar">
        <a href="/portfolio" class="sidebar-link">Portfolio</a>
        <a href="/portfolio#web-apps" class="sidebar-link">Web Apps</a>
        <a href="/portfolio#corporate-sites" class="sidebar-link">Corporate Sites</a>
      </div>
    `;

    // 1. Browsed to base /portfolio with no hash
    const baseUrl = new URL("https://example.com/portfolio");
    syncSlottedSidebarActiveLinks(host, baseUrl);

    const portfolioLink = host.querySelector('a[href="/portfolio"]');
    const webAppsLink = host.querySelector('a[href="/portfolio#web-apps"]');
    const corporateLink = host.querySelector(
      'a[href="/portfolio#corporate-sites"]',
    );

    expect(portfolioLink?.classList.contains("active")).toBe(true);
    expect(webAppsLink?.classList.contains("active")).toBe(false);
    expect(corporateLink?.classList.contains("active")).toBe(false);

    // 2. Browsed to /portfolio#web-apps with hash
    const hashUrl = new URL("https://example.com/portfolio#web-apps");
    syncSlottedSidebarActiveLinks(host, hashUrl);

    expect(portfolioLink?.classList.contains("active")).toBe(false);
    expect(webAppsLink?.classList.contains("active")).toBe(true);
    expect(corporateLink?.classList.contains("active")).toBe(false);
  });
});
