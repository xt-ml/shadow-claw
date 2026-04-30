import "../shadow-claw-page-header/shadow-claw-page-header.js";
import "../settings/shadow-claw-channel-config/shadow-claw-channel-config.js";

import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-channels";

export class ShadowClawChannels extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawChannels.componentPath}/${elementName}.css`;
  static template = `${ShadowClawChannels.componentPath}/${elementName}.html`;

  constructor() {
    super();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    await this.render();
  }

  async render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-action="back-to-settings"]')
      ?.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("navigate-back", {
            bubbles: true,
            composed: true,
          }),
        );
      });
  }
}

customElements.define(elementName, ShadowClawChannels);
