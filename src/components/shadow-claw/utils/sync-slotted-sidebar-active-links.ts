/**
 * Sync active state on slotted sidebar navigation links.
 */
export function syncSlottedSidebarActiveLinks(
  host: HTMLElement | null,
  currentUrl?: URL,
): void {
  if (!host || typeof host.querySelectorAll !== "function") {
    return;
  }

  const url =
    currentUrl ||
    (typeof window !== "undefined" && window.location?.href
      ? new URL(window.location.href)
      : null);
  if (!url) {
    return;
  }

  const currentPath = url.pathname.replace(/\/+$/, "") || "/";

  // Select all links slotted into sidebar slots or in custom sections
  const slottedLinks = host.querySelectorAll<HTMLAnchorElement>(
    '[slot="sidebar"] a[href], [slot="sidebar-nav"] a[href], [slot="sidebar-content"] a[href], [slot="sidebar-footer"] a[href], .sidebar-custom-sections a[href]',
  );

  slottedLinks.forEach((link) => {
    try {
      const href = link.getAttribute("href") || "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      const linkUrl = new URL(href, url.origin);
      if (linkUrl.origin !== url.origin) {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
        return;
      }

      const linkPath = linkUrl.pathname.replace(/\/+$/, "") || "/";
      const isPathMatch = linkPath === currentPath;
      const isMatch =
        isPathMatch && (linkUrl.hash ? linkUrl.hash === url.hash : !url.hash);

      if (isMatch) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
    } catch {
      // Ignore URL parsing errors
    }
  });
}

/**
 * Sets up listeners so slotted sidebar active links stay in sync whenever
 * the URL changes (popstate, Navigation API navigate, replaceState, or feed scroll events).
 * Returns a cleanup function to remove the listeners.
 */
export function setupSlottedSidebarActiveLinks(
  host: HTMLElement | null,
): () => void {
  if (!host || typeof window === "undefined") {
    return () => {};
  }

  const sync = (targetUrl?: URL) =>
    syncSlottedSidebarActiveLinks(host, targetUrl);

  // Initial sync
  sync();

  // Re-sync on back/forward navigation
  const handlePopstate = () => sync();
  window.addEventListener("popstate", handlePopstate, { passive: true });

  // Re-sync on custom feed-scroll or url-change events
  const handleCustomFeedScroll = (ev: Event) => {
    const detailUrl = (ev as CustomEvent)?.detail?.url;
    if (detailUrl) {
      try {
        sync(new URL(detailUrl, window.location.href));
        return;
      } catch {}
    }
    sync();
  };
  window.addEventListener("shadow-claw-feed-scroll", handleCustomFeedScroll);
  window.addEventListener("shadow-claw-url-change", handleCustomFeedScroll);

  // Re-sync on Navigation API navigate (Chrome 102+)
  // CRITICAL: On 'navigate', window.location.href has NOT yet updated (it holds the old URL).
  // We must inspect ev.destination.url so the sidebar highlights the target article
  // synchronously without an "off-by-one" lag.
  const nav = (window as unknown as { navigation?: EventTarget }).navigation;
  let handleNavigate: ((ev: any) => void) | null = null;
  let handleCurrentEntryChange: (() => void) | null = null;
  let handleNavigateSuccess: (() => void) | null = null;

  if (nav && typeof nav.addEventListener === "function") {
    handleNavigate = (ev: any) => {
      const destUrl = ev?.destination?.url;
      if (destUrl) {
        try {
          sync(new URL(destUrl));
          return;
        } catch {}
      }
      sync();
    };

    handleCurrentEntryChange = () => {
      sync();
    };

    handleNavigateSuccess = () => {
      sync();
    };

    nav.addEventListener("navigate", handleNavigate, {
      passive: true,
    } as EventListenerOptions);

    nav.addEventListener("currententrychange", handleCurrentEntryChange, {
      passive: true,
    } as EventListenerOptions);

    nav.addEventListener("navigatesuccess", handleNavigateSuccess, {
      passive: true,
    } as EventListenerOptions);
  }

  // Intercept history.replaceState and history.pushState so synchronous in-feed URL updates
  // immediately update the slotted sidebar in environments without Navigation API or when invoked directly.
  let origReplaceState: typeof window.history.replaceState | null = null;
  let origPushState: typeof window.history.pushState | null = null;
  const historyObj = typeof window !== "undefined" ? window.history : null;
  let unhookHistory: (() => void) | null = null;

  if (historyObj) {
    origReplaceState = historyObj.replaceState;
    origPushState = historyObj.pushState;

    const wrappedReplaceState = function (
      this: History,
      _data: any,
      _unused: string,
      url?: string | URL | null,
    ) {
      const res = origReplaceState?.apply(this, arguments as any);
      try {
        if (url) {
          sync(new URL(url.toString(), window.location.href));
        } else {
          sync();
        }
      } catch {
        sync();
      }
      return res;
    };

    const wrappedPushState = function (
      this: History,
      _data: any,
      _unused: string,
      url?: string | URL | null,
    ) {
      const res = origPushState?.apply(this, arguments as any);
      try {
        if (url) {
          sync(new URL(url.toString(), window.location.href));
        } else {
          sync();
        }
      } catch {
        sync();
      }
      return res;
    };

    historyObj.replaceState = wrappedReplaceState;
    historyObj.pushState = wrappedPushState;

    unhookHistory = () => {
      if (historyObj.replaceState === wrappedReplaceState && origReplaceState) {
        historyObj.replaceState = origReplaceState;
      }
      if (historyObj.pushState === wrappedPushState && origPushState) {
        historyObj.pushState = origPushState;
      }
    };
  }

  return () => {
    window.removeEventListener("popstate", handlePopstate);
    window.removeEventListener(
      "shadow-claw-feed-scroll",
      handleCustomFeedScroll,
    );
    window.removeEventListener(
      "shadow-claw-url-change",
      handleCustomFeedScroll,
    );
    if (nav && typeof nav.removeEventListener === "function") {
      if (handleNavigate) {
        nav.removeEventListener("navigate", handleNavigate);
      }
      if (handleCurrentEntryChange) {
        nav.removeEventListener("currententrychange", handleCurrentEntryChange);
      }
      if (handleNavigateSuccess) {
        nav.removeEventListener("navigatesuccess", handleNavigateSuccess);
      }
    }
    if (unhookHistory) {
      unhookHistory();
    }
  };
}
