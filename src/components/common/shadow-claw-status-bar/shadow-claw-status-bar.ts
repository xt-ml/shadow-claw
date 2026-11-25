import ShadowClawElement, { defineElement } from "../../shadow-claw-element.js";
import shadowClawStatusBarStyles from "./shadow-claw-status-bar.css" with { type: "css" };
import shadowClawStatusBarTemplate from "./shadow-claw-status-bar.html" with { type: "html" };

const elementName = "shadow-claw-status-bar";

/**
 * Accessible, container-responsive status bar (<shadow-claw-status-bar>).
 * Provides a polite status message region (`role="status"`), an assertive error
 * alert dismiss button (`role="alert"`), and passive `status` / `metrics` slots.
 */
export class ShadowClawStatusBar extends ShadowClawElement {
  static observedAttributes = ["message", "dirty", "error", "label"];
  static styles = shadowClawStatusBarStyles;
  static template = shadowClawStatusBarTemplate;

  connectedCallback(): void {
    this.disposeCleanups();
    const errorBtn = this.shadowRoot?.querySelector(
      ".status-bar__error",
    ) as HTMLButtonElement | null;

    if (errorBtn) {
      const onErrorClick = () => {
        const errorText = this.getAttribute("error") || "";
        const ev = new CustomEvent("shadow-claw-status-error-dismiss", {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { error: errorText },
        });
        const shouldClear = this.dispatchEvent(ev);
        if (shouldClear) {
          this.removeAttribute("error");
        }
      };

      errorBtn.addEventListener("click", onErrorClick);
      this.addCleanup(() => {
        errorBtn.removeEventListener("click", onErrorClick);
      });
    }

    super.connectedCallback();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  render(): void {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const bar = root.querySelector(".status-bar");
    const msgEl = root.querySelector(".status-bar__message");
    const errorBtn = root.querySelector(
      ".status-bar__error",
    ) as HTMLButtonElement | null;

    if (bar) {
      const label = this.getAttribute("label");
      if (label) {
        bar.setAttribute("aria-label", label);
      } else {
        bar.removeAttribute("aria-label");
      }
    }

    if (msgEl) {
      const message = this.getAttribute("message") || "";
      const isDirty =
        this.hasAttribute("dirty") && this.getAttribute("dirty") !== "false";
      msgEl.textContent = `${isDirty ? "● " : ""}${message}`;
    }

    if (errorBtn) {
      const error = this.getAttribute("error") || "";
      if (error) {
        errorBtn.textContent = `⚠ ${error} (Dismiss)`;
        errorBtn.setAttribute("aria-label", `Dismiss error: ${error}`);
        errorBtn.hidden = false;
      } else {
        errorBtn.textContent = "";
        errorBtn.removeAttribute("aria-label");
        errorBtn.hidden = true;
      }
    }
  }
}

defineElement(elementName, ShadowClawStatusBar);
