import { readFileSync } from "node:fs";
import path from "node:path";
import { jest } from "@jest/globals";
import { ShadowClawStatusBar } from "./shadow-claw-status-bar.js";

const statusBarCssSource = readFileSync(
  path.resolve(
    process.cwd(),
    "src/components/common/shadow-claw-status-bar/shadow-claw-status-bar.css",
  ),
  "utf8",
);

describe("shadow-claw-status-bar", () => {
  it("registers shadow-claw-status-bar with exposed shadow parts and proper ARIA live-region discipline", () => {
    expect(customElements.get("shadow-claw-status-bar")).toBe(
      ShadowClawStatusBar,
    );

    const el = new ShadowClawStatusBar();
    el.setAttribute("label", "Audio telemetry");
    el.setAttribute("message", "Ready");
    document.body.appendChild(el);

    const bar = el.shadowRoot?.querySelector('[part="bar"]');
    const status = el.shadowRoot?.querySelector('[part="status"]');
    const message = el.shadowRoot?.querySelector('[part="message"]');
    const metrics = el.shadowRoot?.querySelector('[part="metrics"]');
    const errorBtn = el.shadowRoot?.querySelector('[part="error"]');
    const errorRegion = el.shadowRoot?.querySelector('[role="alert"]');

    expect(el.shadowRoot).not.toBeNull();
    expect(bar?.tagName.toLowerCase()).toBe("footer");
    expect(bar?.getAttribute("aria-label")).toBe("Audio telemetry");
    expect(status).not.toBeNull();
    expect(message?.getAttribute("role")).toBe("status");
    expect(message?.getAttribute("aria-live")).toBe("polite");
    expect(message?.textContent).toBe("Ready");

    // Metrics slot must remain passive (no aria-live spam)
    expect(metrics?.hasAttribute("aria-live")).toBe(false);

    // Error button is hidden initially inside an alert live region
    expect(errorRegion).not.toBeNull();
    expect(errorBtn?.tagName.toLowerCase()).toBe("button");
    expect(errorBtn?.hasAttribute("hidden")).toBe(true);

    el.remove();
  });

  it("updates message, dirty indicator, and error alert dynamically via observedAttributes", () => {
    const el = new ShadowClawStatusBar();
    document.body.appendChild(el);

    const message = el.shadowRoot?.querySelector('[part="message"]');
    const errorBtn = el.shadowRoot?.querySelector(
      '[part="error"]',
    ) as HTMLButtonElement;

    el.setAttribute("message", "Saved project.json");
    expect(message?.textContent).toBe("Saved project.json");

    el.setAttribute("dirty", "");
    expect(message?.textContent).toBe("● Saved project.json");

    el.removeAttribute("dirty");
    expect(message?.textContent).toBe("Saved project.json");

    el.setAttribute("error", "Audio context suspended");
    expect(errorBtn.hasAttribute("hidden")).toBe(false);
    expect(errorBtn.textContent).toContain("Audio context suspended");
    expect(errorBtn.getAttribute("aria-label")).toContain(
      "Dismiss error: Audio context suspended",
    );

    // Clicking error button dispatches cancelable shadow-claw-status-error-dismiss and clears error
    const dismissSpy = jest.fn();
    el.addEventListener("shadow-claw-status-error-dismiss", dismissSpy);
    errorBtn.click();

    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(el.hasAttribute("error")).toBe(false);
    expect(errorBtn.hasAttribute("hidden")).toBe(true);

    // If preventDefault() is called, error stays visible
    el.setAttribute("error", "Persistent error");
    el.addEventListener(
      "shadow-claw-status-error-dismiss",
      (e) => e.preventDefault(),
      { once: true },
    );
    errorBtn.click();
    expect(el.getAttribute("error")).toBe("Persistent error");
    expect(errorBtn.hasAttribute("hidden")).toBe(false);

    el.remove();
  });

  it("does not duplicate click listeners across disconnect and reconnect", () => {
    const el = new ShadowClawStatusBar();
    el.setAttribute("error", "Test error");
    document.body.appendChild(el);
    el.remove();
    document.body.appendChild(el);

    const dismissSpy = jest.fn();
    el.addEventListener("shadow-claw-status-error-dismiss", dismissSpy);

    const errorBtn = el.shadowRoot?.querySelector(
      '[part="error"]',
    ) as HTMLButtonElement;
    errorBtn.click();
    expect(dismissSpy).toHaveBeenCalledTimes(1);

    el.remove();
  });

  it("uses container queries, coarse pointer 44px touch target, private --_* aliases, and no :host-context()", () => {
    expect(statusBarCssSource).toContain("container-type: inline-size");
    expect(statusBarCssSource).toContain("@container");
    expect(statusBarCssSource).toContain("@media (pointer: coarse)");
    expect(statusBarCssSource).toContain("44px");
    expect(statusBarCssSource).toContain("--_bg-secondary:");
    expect(statusBarCssSource).toContain("var(--shadow-claw-bg-secondary");
    expect(statusBarCssSource).not.toContain(":host-context(");
    expect(statusBarCssSource).not.toMatch(/^\s*--shadow-claw-[a-z-]+:/m);
  });
});
