import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-card";

export class ShadowClawCard extends ShadowClawElement {
  static componentPath = `components/common/${elementName}`;
  static styles = `${ShadowClawCard.componentPath}/${elementName}.css`;
  static template = `${ShadowClawCard.componentPath}/${elementName}.html`;

  static observedAttributes = ["label", "meta", "badge"];

  attributeChangedCallback() {
    this.render();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);
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

customElements.define(elementName, ShadowClawCard);
