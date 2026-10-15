import { Themes } from "../../../stores/theme.js";

/**
 * Update host element theme classes
 */
export function updateHostTheme(theme: string, classList: DOMTokenList): void {
  if (theme === Themes.Dark) {
    classList.add("dark-mode");
    classList.remove("light-mode");
  } else {
    classList.add("light-mode");
    classList.remove("dark-mode");
  }
}
