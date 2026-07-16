import ShadowClawElement from "../../shadow-claw-element.js";
import shadowClawCardStyles from "./shadow-claw-card.css" with { type: "css" };
import shadowClawCardTemplate from "./shadow-claw-card.html" with { type: "html" };

const elementName = "shadow-claw-card";

export class ShadowClawCard extends ShadowClawElement {
  static styles = shadowClawCardStyles;
  static template = shadowClawCardTemplate;

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

    const labelEl = root.querySelector(".card__label");
    const metaEl = root.querySelector(".card__meta");
    const badgeEl = root.querySelector(".card__badge");

    if (!labelEl || !metaEl || !badgeEl) {
      return;
    }

    labelEl.textContent = this.getAttribute("label") || "";
    metaEl.textContent = this.getAttribute("meta") || "";

    const badge = this.getAttribute("badge") || "";
    badgeEl.textContent = badge;
    badgeEl.toggleAttribute("hidden", !badge);
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawCard);
}
