import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-page-header-action-button";

export class ShadowClawPageHeaderActionButton extends ShadowClawElement {
  static componentPath = `components/common/${elementName}`;
  static styles = `${ShadowClawPageHeaderActionButton.componentPath}/${elementName}.css`;
  static template = `${ShadowClawPageHeaderActionButton.componentPath}/${elementName}.html`;

  static observedAttributes = ["variant", "disabled"];

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

    const button = root.querySelector<HTMLButtonElement>(".action-btn");
    if (!button) {
      return;
    }

    const variant = this.getAttribute("variant") || "default";
    button.className = `action-btn action-btn--${variant}`;
    button.disabled = this.hasAttribute("disabled");
  }
}

customElements.define(elementName, ShadowClawPageHeaderActionButton);
