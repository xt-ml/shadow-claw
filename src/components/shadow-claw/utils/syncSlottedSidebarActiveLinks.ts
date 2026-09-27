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
 * the URL changes (popstate, Navigation API navigate, or iframe replaceState).
 * Returns a cleanup function to remove the listeners.
 */
export function setupSlottedSidebarActiveLinks(
  host: HTMLElement | null,
): () => void {
  if (!host || typeof window === "undefined") {
    return () => {};
  }

  const sync = () => syncSlottedSidebarActiveLinks(host);

  // Initial sync
  sync();

  // Re-sync on back/forward navigation and replaceState-driven URL changes
  window.addEventListener("popstate", sync, { passive: true });

  // Re-sync on Navigation API navigate (Chrome 102+) — covers pushState/replaceState too
  const nav = (window as unknown as { navigation?: EventTarget }).navigation;
  if (nav && typeof nav.addEventListener === "function") {
    nav.addEventListener("navigate", sync, {
      passive: true,
    } as EventListenerOptions);
  }

  return () => {
    window.removeEventListener("popstate", sync);
    if (nav && typeof nav.removeEventListener === "function") {
      nav.removeEventListener("navigate", sync);
    }
  };
}
