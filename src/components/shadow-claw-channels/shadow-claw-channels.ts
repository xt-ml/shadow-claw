import "../common/shadow-claw-page-header-action-button/shadow-claw-page-header-action-button.js";
import "../settings/shadow-claw-channel-config/shadow-claw-channel-config.js";
import "../shadow-claw-page-header/shadow-claw-page-header.js";

import ShadowClawElement from "../shadow-claw-element.js";
import shadowClawChannelsStyles from "./shadow-claw-channels.css" with { type: "css" };
import shadowClawChannelsTemplate from "./shadow-claw-channels.html" with { type: "html" };

const elementName = "shadow-claw-channels";

export class ShadowClawChannels extends ShadowClawElement {
  static styles = shadowClawChannelsStyles;
  static template = shadowClawChannelsTemplate;

  constructor() {
    super();
  }

  async connectedCallback() {
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

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawChannels);
}
