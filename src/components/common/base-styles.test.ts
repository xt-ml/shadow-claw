import { readFileSync } from "node:fs";
import path from "node:path";
import ShadowClawElement, { defineElement } from "../shadow-claw-element.js";
import {
  SHADOW_CLAW_CSS_TOKENS,
  shadowClawBaseStyles,
  getShadowClawBaseStyleSheet,
} from "./base-styles.js";

const baseCssSource = readFileSync(
  path.resolve(process.cwd(), "src/components/common/base-styles.css"),
  "utf8",
);

describe("shadow-claw base-styles", () => {
  it("exports canonical --shadow-claw-* CSS custom property token names", () => {
    expect(SHADOW_CLAW_CSS_TOKENS.bgPrimary).toBe("--shadow-claw-bg-primary");
    expect(SHADOW_CLAW_CSS_TOKENS.bgSecondary).toBe(
      "--shadow-claw-bg-secondary",
    );
    expect(SHADOW_CLAW_CSS_TOKENS.bgTertiary).toBe("--shadow-claw-bg-tertiary");
    expect(SHADOW_CLAW_CSS_TOKENS.borderColor).toBe(
      "--shadow-claw-border-color",
    );
    expect(SHADOW_CLAW_CSS_TOKENS.textPrimary).toBe(
      "--shadow-claw-text-primary",
    );
    expect(SHADOW_CLAW_CSS_TOKENS.textSecondary).toBe(
      "--shadow-claw-text-secondary",
    );
    expect(SHADOW_CLAW_CSS_TOKENS.textTertiary).toBe(
      "--shadow-claw-text-tertiary",
    );
    expect(SHADOW_CLAW_CSS_TOKENS.accentPrimary).toBe(
      "--shadow-claw-accent-primary",
    );
    expect(SHADOW_CLAW_CSS_TOKENS.accentHover).toBe(
      "--shadow-claw-accent-hover",
    );
    expect(SHADOW_CLAW_CSS_TOKENS.onPrimary).toBe("--shadow-claw-on-primary");
    expect(SHADOW_CLAW_CSS_TOKENS.successColor).toBe(
      "--shadow-claw-success-color",
    );
    expect(SHADOW_CLAW_CSS_TOKENS.warningColor).toBe(
      "--shadow-claw-warning-color",
    );
    expect(SHADOW_CLAW_CSS_TOKENS.errorColor).toBe("--shadow-claw-error-color");
    expect(SHADOW_CLAW_CSS_TOKENS.fontSans).toBe("--shadow-claw-font-sans");
    expect(SHADOW_CLAW_CSS_TOKENS.fontMono).toBe("--shadow-claw-font-mono");
    expect(SHADOW_CLAW_CSS_TOKENS.radiusS).toBe("--shadow-claw-radius-s");
    expect(SHADOW_CLAW_CSS_TOKENS.radiusM).toBe("--shadow-claw-radius-m");
    expect(SHADOW_CLAW_CSS_TOKENS.radiusL).toBe("--shadow-claw-radius-l");
    expect(SHADOW_CLAW_CSS_TOKENS.radiusPill).toBe("--shadow-claw-radius-pill");
  });

  it("includes mobile-first touch targets, focus-visible, visually-hidden, utility classes, private --_* aliases, and no :host-context()", () => {
    expect(baseCssSource).toContain("@layer shadow-claw-base");
    expect(baseCssSource).toContain("@media (pointer: coarse)");
    expect(baseCssSource).toContain(":focus-visible");
    expect(baseCssSource).toContain(".visually-hidden");
    expect(baseCssSource).toContain(".sc-panel");
    expect(baseCssSource).toContain(".sc-btn");
    expect(baseCssSource).toContain(".sc-badge");
    expect(baseCssSource).toContain(".sc-scrollable");
    expect(baseCssSource).toContain("--_bg-primary:");
    expect(baseCssSource).toContain("var(--shadow-claw-bg-primary");
    expect(baseCssSource).not.toContain(":host-context(");
    // Leaves public --shadow-claw-* properties unset on :host so inherited ancestor values win
    expect(baseCssSource).not.toMatch(/^\s*--shadow-claw-[a-z-]+:/m);
  });

  it("provides a constructable CSSStyleSheet and can be composed with custom styles in ShadowClawElement", () => {
    const sheet = getShadowClawBaseStyleSheet();
    expect(sheet).toBeInstanceOf(CSSStyleSheet);
    expect(shadowClawBaseStyles).toBeInstanceOf(CSSStyleSheet);

    class ComposedBaseElement extends ShadowClawElement {
      static styles = [shadowClawBaseStyles, ".custom { gap: 0.5rem; }"];
      static template = `<div class="sc-panel custom"><button class="sc-btn" type="button">OK</button></div>`;
    }

    defineElement("test-composed-base-el", ComposedBaseElement);
    const el = new ComposedBaseElement();

    expect(el.shadowRoot?.adoptedStyleSheets.length).toBe(2);
    expect(el.shadowRoot?.querySelector(".sc-btn")?.textContent).toBe("OK");
  });
});
