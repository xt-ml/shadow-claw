import ShadowClawElement from "../../shadow-claw-element.js";
import shadowClawPageHeaderActionButtonStyles from "./shadow-claw-page-header-action-button.css" with { type: "css" };
import shadowClawPageHeaderActionButtonTemplate from "./shadow-claw-page-header-action-button.html" with { type: "html" };

const elementName = "shadow-claw-page-header-action-button";

export class ShadowClawPageHeaderActionButton extends ShadowClawElement {
  static styles = shadowClawPageHeaderActionButtonStyles;
  static template = shadowClawPageHeaderActionButtonTemplate;
  static observedAttributes = ["disabled", "variant"];

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

    const button = root.querySelector<HTMLButtonElement>(".action-btn");
    if (!button) {
      return;
    }

    const variant = this.getAttribute("variant") || "default";
    button.className = `action-btn action-btn--${variant}`;
    button.disabled = this.hasAttribute("disabled");
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawPageHeaderActionButton);
}
