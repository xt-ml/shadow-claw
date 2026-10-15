/**
 * Synchronizes current theme mode and custom CSS properties with the preview iframe window.
 */
export function syncIframeTheme(targetWindow: Window | null): void {
  if (!targetWindow) {
    return;
  }

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark-mode");

  const customProperties: Record<string, string> = {};
  if (
    typeof document !== "undefined" &&
    typeof getComputedStyle !== "undefined"
  ) {
    const styles = getComputedStyle(document.documentElement);
    for (let i = 0; i < styles.length; i++) {
      const prop = styles[i];
      if (prop.startsWith("--")) {
        customProperties[prop] = styles.getPropertyValue(prop);
      }
    }
  }

  targetWindow.postMessage(
    {
      type: "shadow-claw-theme-update",
      theme: isDark ? "dark" : "light",
      customProperties,
    },
    "*",
  );
}
