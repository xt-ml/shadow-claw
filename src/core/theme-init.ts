import { initializeTrustedTypesTinyfill } from "../security/trusted-types-tinyfill.js";
import { ensureDefaultTrustedTypesPolicy } from "../security/default-trusted-types-policy.js";
import {
  installCustomElementDomGuard,
  installCustomElementsRegistryGuard,
} from "../security/custom-element-security.js";
import { getNamespacedItem } from "../utils/namespacedStorage.js";

declare const __PRERENDER_MAIN_MEMORY__: boolean;

export function handleGithubPages404Redirects() {
  const redirect = sessionStorage.getItem(
    "shadow-claw-github-pages-404-redirect",
  );

  if (redirect) {
    sessionStorage.removeItem("shadow-claw-github-pages-404-redirect");
  }

  if (
    redirect &&
    redirect !== location.pathname + location.search + location.hash
  ) {
    history.replaceState(null, "", redirect);
  }
}

export function initializeThemeAndBootState() {
  // Install Trusted Types tinyfill first (no-op if browser already supports it)
  initializeTrustedTypesTinyfill();

  ensureDefaultTrustedTypesPolicy();

  // Guard custom element registry and DOM mutations as early as possible
  installCustomElementsRegistryGuard();
  installCustomElementDomGuard();

  const root = document.documentElement;
  root.classList.add("sc-js-enabled", "sc-js-boot-pending");
  const BOOT_PENDING_ATTR = "data-js-boot-pending";
  const HYDRATION_PENDING_ATTR = "data-hydration-pending";
  const OVERRIDE_PRERENDER_KEY = "shadow-claw-override-prerender-skeleton";
  const PRERENDER_OVERRIDE_CLASS = "sc-prerender-override";

  // If the override setting is enabled, add the class to <html> synchronously
  // RIGHT NOW — before <body> is parsed and before any paint. The matching
  // global CSS rule in index.css hides <shadow-claw> entirely so no
  // pre-rendered SSR content is ever visible. clearBootPendingClass() removes
  // this class once CSR routing is complete.

  let shouldOverridePrerender = false;
  try {
    const rawVal = getNamespacedItem(OVERRIDE_PRERENDER_KEY);
    if (rawVal === null) {
      shouldOverridePrerender = __PRERENDER_MAIN_MEMORY__;
    } else {
      shouldOverridePrerender = rawVal === "true";
    }
  } catch {
    // localStorage may be unavailable (e.g. private browsing restrictions)
    shouldOverridePrerender = __PRERENDER_MAIN_MEMORY__;
  }

  if (shouldOverridePrerender) {
    root.classList.add(PRERENDER_OVERRIDE_CLASS);
  }

  const markBootPendingHost = (): boolean => {
    const host = document.querySelector("shadow-claw");
    if (!host) {
      return false;
    }

    const hasNoSeed = host.getAttribute("data-prerender-no-seed") === "true";

    // When the override setting is disabled and the element doesn't have
    // data-prerender-no-seed, there's nothing to do. Return false so the
    // MutationObserver keeps watching for the element to appear.
    if (!hasNoSeed && !shouldOverridePrerender) {
      return false;
    }

    // Only set the skeleton-driving boot-pending attributes when the override
    // is actually enabled. The prerender script always bakes
    // data-prerender-no-seed="true" into the HTML, so checking hasNoSeed alone
    // is not a reliable signal that the skeleton should be shown — the user may
    // have the override setting disabled, in which case the SSR content should
    // render directly without any skeleton overlay.
    if (shouldOverridePrerender) {
      host.setAttribute("data-prerender-no-seed", "true");
      host.setAttribute(BOOT_PENDING_ATTR, "true");
      host.setAttribute(HYDRATION_PENDING_ATTR, "true");
    }

    return true;
  };

  if (!markBootPendingHost()) {
    const observer = new MutationObserver(() => {
      if (markBootPendingHost()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  const themeKey = "shadow-claw-theme";
  const storedTheme = getNamespacedItem(themeKey) || "system";
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    storedTheme === "system" ? (prefersDark ? "dark" : "light") : storedTheme;

  document.documentElement.classList.add(`${resolvedTheme}-mode`);
}

handleGithubPages404Redirects();
initializeThemeAndBootState();

// Handle lazy-loading CSS (like fonts) without CSP-violating inline onload handlers.
window.addEventListener(
  "load",
  (e: Event) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === "LINK") {
      const link = target as HTMLLinkElement;
      if (
        link.rel === "stylesheet" &&
        link.media === "print" &&
        link.href.includes("Material+Symbols")
      ) {
        link.media = "all";
      }
    }
  },
  true,
);
