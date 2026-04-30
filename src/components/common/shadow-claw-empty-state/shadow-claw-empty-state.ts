import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-empty-state";

export class ShadowClawEmptyState extends ShadowClawElement {
  static componentPath = `components/common/${elementName}`;
  static styles = `${ShadowClawEmptyState.componentPath}/${elementName}.css`;
  static template = `${ShadowClawEmptyState.componentPath}/${elementName}.html`;

  static observedAttributes = ["message", "hint"];

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

customElements.define(elementName, ShadowClawEmptyState);
