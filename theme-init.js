(function () {
  const themeKey = "shadow-claw-theme";
  const storedTheme = localStorage.getItem(themeKey) || "system";
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    storedTheme === "system" ? (prefersDark ? "dark" : "light") : storedTheme;

  document.documentElement.classList.add(`${resolvedTheme}-mode`);
})();
