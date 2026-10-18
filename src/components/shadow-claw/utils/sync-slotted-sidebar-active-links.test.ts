import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  setupSlottedSidebarActiveLinks,
  syncSlottedSidebarActiveLinks,
} from "./sync-slotted-sidebar-active-links.js";

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

describe("setupSlottedSidebarActiveLinks", () => {
  let host: HTMLElement;
  let originalNavigation: any;
  let originalReplaceState: any;

  beforeEach(() => {
    originalNavigation = (window as any).navigation;
    originalReplaceState = window.history.replaceState;

    host = document.createElement("div");
    host.innerHTML = `
      <div slot="sidebar" class="sidebar-custom-sections">
        <a href="/" class="sidebar-link">Home</a>
        <a href="/2022/11/27/c-sharp-in-the-browser-without-blazor/" class="sidebar-link">C# in the Browser Without Blazor</a>
        <a href="/2021/04/18/using-open/" class="sidebar-link">Using Open</a>
        <a href="/2021/02/27/the-web-is-dynamic/" class="sidebar-link">The Web Is Dynamic</a>
      </div>
    `;

    // Ensure initial location is home
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    if (originalNavigation !== undefined) {
      (window as any).navigation = originalNavigation;
    } else {
      delete (window as any).navigation;
    }
    window.history.replaceState = originalReplaceState;
    window.history.replaceState({}, "", "/");
  });

  it("synchronizes active sidebar link on Navigation API navigate event using destination URL when window.location.href is still old URL", () => {
    const nav = new EventTarget();
    (window as any).navigation = nav;

    const cleanup = setupSlottedSidebarActiveLinks(host);

    const linkCSharp = host.querySelector<HTMLAnchorElement>(
      'a[href="/2022/11/27/c-sharp-in-the-browser-without-blazor/"]',
    );
    const linkUsingOpen = host.querySelector<HTMLAnchorElement>(
      'a[href="/2021/04/18/using-open/"]',
    );

    // Initial state: home is active, posts are not
    expect(linkCSharp?.classList.contains("active")).toBe(false);
    expect(linkUsingOpen?.classList.contains("active")).toBe(false);

    // 1. User scrolls to C# post: replaceState triggers navigate event.
    // Crucially: At this point, the browser has NOT committed navigation yet,
    // so window.location.href is STILL "http://localhost/"!
    const navEvent1 = new Event("navigate") as any;
    navEvent1.destination = {
      url: `${window.location.origin}/2022/11/27/c-sharp-in-the-browser-without-blazor/`,
    };
    nav.dispatchEvent(navEvent1);

    // C# link MUST be highlighted immediately without off-by-one delay
    expect(linkCSharp?.classList.contains("active")).toBe(true);
    expect(linkCSharp?.getAttribute("aria-current")).toBe("page");
    expect(linkUsingOpen?.classList.contains("active")).toBe(false);

    // Browser now commits navigation: location updates to C# post
    window.history.replaceState(
      {},
      "",
      "/2022/11/27/c-sharp-in-the-browser-without-blazor/",
    );

    // 2. User scrolls down to "Using Open": replaceState triggers navigate event.
    // window.location.href is STILL C# post URL!
    const navEvent2 = new Event("navigate") as any;
    navEvent2.destination = {
      url: `${window.location.origin}/2021/04/18/using-open/`,
    };
    nav.dispatchEvent(navEvent2);

    // "Using Open" MUST be highlighted, and C# link MUST NOT be highlighted
    expect(linkCSharp?.classList.contains("active")).toBe(false);
    expect(linkCSharp?.hasAttribute("aria-current")).toBe(false);
    expect(linkUsingOpen?.classList.contains("active")).toBe(true);
    expect(linkUsingOpen?.getAttribute("aria-current")).toBe("page");

    cleanup();
  });

  it("synchronizes active sidebar link immediately when history.replaceState is called", () => {
    delete (window as any).navigation;

    const cleanup = setupSlottedSidebarActiveLinks(host);

    const linkCSharp = host.querySelector<HTMLAnchorElement>(
      'a[href="/2022/11/27/c-sharp-in-the-browser-without-blazor/"]',
    );
    const linkUsingOpen = host.querySelector<HTMLAnchorElement>(
      'a[href="/2021/04/18/using-open/"]',
    );

    expect(linkCSharp?.classList.contains("active")).toBe(false);

    // replaceState to C# post
    window.history.replaceState(
      { inFeedScroll: true },
      "",
      "/2022/11/27/c-sharp-in-the-browser-without-blazor/",
    );

    expect(linkCSharp?.classList.contains("active")).toBe(true);
    expect(linkUsingOpen?.classList.contains("active")).toBe(false);

    // replaceState to Using Open
    window.history.replaceState(
      { inFeedScroll: true },
      "",
      "/2021/04/18/using-open/",
    );

    expect(linkCSharp?.classList.contains("active")).toBe(false);
    expect(linkUsingOpen?.classList.contains("active")).toBe(true);

    cleanup();
  });

  it("synchronizes active sidebar link when shadow-claw-feed-scroll event is dispatched", () => {
    const cleanup = setupSlottedSidebarActiveLinks(host);

    const linkCSharp = host.querySelector<HTMLAnchorElement>(
      'a[href="/2022/11/27/c-sharp-in-the-browser-without-blazor/"]',
    );

    window.dispatchEvent(
      new CustomEvent("shadow-claw-feed-scroll", {
        detail: {
          url: "/2022/11/27/c-sharp-in-the-browser-without-blazor/",
          title: "C# in the Browser Without Blazor",
        },
      }),
    );

    expect(linkCSharp?.classList.contains("active")).toBe(true);
    expect(linkCSharp?.getAttribute("aria-current")).toBe("page");

    cleanup();
  });
});
