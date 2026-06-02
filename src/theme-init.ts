import { initializeTrustedTypesTinyfill } from "./security/trusted-types-tinyfill.js";
import { ensureDefaultTrustedTypesPolicy } from "./security/default-trusted-types-policy.js";

(function handleGithubPages404Redirects() {
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
})();

(function initializeThemeAndBootState() {
  // Install Trusted Types tinyfill first (no-op if browser already supports it)
  initializeTrustedTypesTinyfill();

  ensureDefaultTrustedTypesPolicy();

  const root = document.documentElement;
  root.classList.add("sc-js-enabled", "sc-js-boot-pending");
  const BOOT_PENDING_ATTR = "data-js-boot-pending";
  const HYDRATION_PENDING_ATTR = "data-hydration-pending";

  const markBootPendingHost = (): boolean => {
    const host = document.querySelector(
      'shadow-claw[data-prerender-no-seed="true"]',
    );
    if (!host) {
      return false;
    }

    host.setAttribute(BOOT_PENDING_ATTR, "true");
    host.setAttribute(HYDRATION_PENDING_ATTR, "true");

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
  const storedTheme = localStorage.getItem(themeKey) || "system";
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    storedTheme === "system" ? (prefersDark ? "dark" : "light") : storedTheme;

  document.documentElement.classList.add(`${resolvedTheme}-mode`);
})();
