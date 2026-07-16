import ShadowClawElement from "../../shadow-claw-element.js";
import shadowClawEmptyStateStyles from "./shadow-claw-empty-state.css" with { type: "css" };
import shadowClawEmptyStateTemplate from "./shadow-claw-empty-state.html" with { type: "html" };

const elementName = "shadow-claw-empty-state";

export class ShadowClawEmptyState extends ShadowClawElement {
  static styles = shadowClawEmptyStateStyles;
  static template = shadowClawEmptyStateTemplate;

  attributeChangedCallback() {
    this.render();
  }

  async connectedCallback() {
    await this.render();
  }

  async render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const messageEl = root.querySelector(".empty-state__message");
    const hintEl = root.querySelector(".empty-state__hint");

    if (!messageEl || !hintEl) {
      return;
    }

    messageEl.textContent = this.getAttribute("message") || "Nothing here yet.";

    const hint = this.getAttribute("hint") || "";
    hintEl.textContent = hint;
    hintEl.toggleAttribute("hidden", !hint);
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawEmptyState);
}
