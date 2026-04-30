import { Signal } from "signal-polyfill";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const Themes = {
  Light: "light" as const,
  Dark: "dark" as const,
  System: "system" as const,
};

const THEME_KEY = "shadow-claw-theme";

/**
 * Get the system theme preference
 */
function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Resolve theme choice to actual theme
 */
function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? getSystemTheme() : choice;
}

/**
 * Apply theme to DOM
 */
function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark-mode");
    root.classList.remove("light-mode");
  } else {
    root.classList.add("light-mode");
    root.classList.remove("dark-mode");
  }

  // Apply to shadow-claw element directly
  const shadowAgent = document.querySelector("shadow-claw");
  if (shadowAgent) {
    if (resolved === "dark") {
      shadowAgent.classList.add("dark-mode");
      shadowAgent.classList.remove("light-mode");
    } else {
      shadowAgent.classList.add("light-mode");
      shadowAgent.classList.remove("dark-mode");
    }
  }

  // Dispatch event for other components to respond if needed
  window.dispatchEvent(
    new CustomEvent("shadow-claw-theme-change", {
      detail: { theme: resolved },
    }),
  );
}

const stored = (localStorage.getItem(THEME_KEY) as ThemeChoice) || "system";

const initialResolved = resolveTheme(stored);
applyTheme(initialResolved);

export class ThemeStore {
  private _theme: Signal.State<ThemeChoice>;
  private _resolved: Signal.State<ResolvedTheme>;

  constructor() {
    this._theme = new Signal.State(stored);
    this._resolved = new Signal.State(initialResolved);
  }

  get theme(): ThemeChoice {
    return this._theme.get();
  }

  get resolved(): ResolvedTheme {
    return this._resolved.get();
  }

  /**
   * Set the theme
   */
  setTheme(theme: ThemeChoice): void {
    const resolved = resolveTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(resolved);
    this._theme.set(theme);
    this._resolved.set(resolved);
  }

  /**
   * Get current theme info
   */
  getTheme(): { theme: ThemeChoice; resolved: ResolvedTheme } {
    return { theme: this.theme, resolved: this.resolved };
  }

  /**
   * Initialize listeners - should be called once
   */
  init(): void {
    // Listen for system theme changes — always override current choice
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", () => {
      const resolved = getSystemTheme();
      localStorage.setItem(THEME_KEY, "system");
      applyTheme(resolved);
      this._theme.set("system");
      this._resolved.set(resolved);
    });

    // Listen for storage changes (tab sync)
    window.addEventListener("storage", (e) => {
      if (e.key === THEME_KEY && e.newValue) {
        this.setTheme(e.newValue as ThemeChoice);
      }
    });
  }
}

export const themeStore = new ThemeStore();
themeStore.init();
