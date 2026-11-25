import baseStylesSheet from "./base-styles.css" with { type: "css" };

/**
 * Canonical ShadowClaw CSS custom property names defined globally in `index.css`.
 * Components should read these inherited tokens via `var(--shadow-claw-*, fallback)`
 * rather than redefining public properties on `:host`.
 */
export const SHADOW_CLAW_CSS_TOKENS = {
  bgPrimary: "--shadow-claw-bg-primary",
  bgSecondary: "--shadow-claw-bg-secondary",
  bgTertiary: "--shadow-claw-bg-tertiary",
  borderColor: "--shadow-claw-border-color",
  textPrimary: "--shadow-claw-text-primary",
  textSecondary: "--shadow-claw-text-secondary",
  textTertiary: "--shadow-claw-text-tertiary",
  accentPrimary: "--shadow-claw-accent-primary",
  accentHover: "--shadow-claw-accent-hover",
  onPrimary: "--shadow-claw-on-primary",
  successColor: "--shadow-claw-success-color",
  warningColor: "--shadow-claw-warning-color",
  errorColor: "--shadow-claw-error-color",
  fontSans: "--shadow-claw-font-sans",
  fontMono: "--shadow-claw-font-mono",
  radiusS: "--shadow-claw-radius-s",
  radiusM: "--shadow-claw-radius-m",
  radiusL: "--shadow-claw-radius-l",
  radiusPill: "--shadow-claw-radius-pill",
  durationMin: "--shadow-claw-duration-min",
  targetSize: "--shadow-claw-target-size",
  targetSizeCoarse: "--shadow-claw-target-size-coarse",
} as const;

export const shadowClawBaseStyles: CSSStyleSheet | null =
  baseStylesSheet ?? null;

export function getShadowClawBaseStyleSheet(): CSSStyleSheet | null {
  return shadowClawBaseStyles;
}
