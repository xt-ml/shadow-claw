import { Themes } from "../../../stores/theme.js";

/**
 * Update theme toggle icons based on current theme
 */
export function updateThemeIcons(shadow: ShadowRoot | null, theme: string) {
  if (!shadow) {
    return;
  }

  const sunIcon: HTMLElement | null = shadow.querySelector(".sun-icon");
  const moonIcon: HTMLElement | null = shadow.querySelector(".moon-icon");

  if (sunIcon && moonIcon) {
    if (theme === Themes.Dark) {
      sunIcon.style.display = "block";
      sunIcon.removeAttribute("hidden");
      sunIcon.classList.remove("hidden");

      moonIcon.style.display = "none";
      moonIcon.setAttribute("hidden", "hidden");
      moonIcon.classList.add("hidden");
    } else {
      sunIcon.style.display = "none";
      sunIcon.setAttribute("hidden", "hidden");
      sunIcon.classList.add("hidden");

      moonIcon.style.display = "block";
      moonIcon.removeAttribute("hidden");
      moonIcon.classList.remove("hidden");
    }
  }
}
