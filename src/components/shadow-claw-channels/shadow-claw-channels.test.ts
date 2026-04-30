import { jest } from "@jest/globals";

jest.unstable_mockModule(
  "../shadow-claw-page-header/shadow-claw-page-header.js",
  () => {
    class MockPageHeader extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          this.attachShadow({ mode: "open" });
        }
      }
    }

    if (!customElements.get("shadow-claw-page-header")) {
      customElements.define("shadow-claw-page-header", MockPageHeader);
    }

    return { ShadowClawPageHeader: MockPageHeader };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-channel-config/shadow-claw-channel-config.js",
  () => {
    class MockSettingsChannels extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          this.attachShadow({ mode: "open" });
        }
      }
    }

    if (!customElements.get("shadow-claw-channel-config")) {
      customElements.define("shadow-claw-channel-config", MockSettingsChannels);
    }

    return { ShadowClawChannelConfig: MockSettingsChannels };
  },
);

const { ShadowClawChannels } = await import("./shadow-claw-channels.js");

describe("shadow-claw-channels", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-channels")).toBe(ShadowClawChannels);
  });

  it("dispatches navigate-back event when back button is clicked", async () => {
    const el = new ShadowClawChannels();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await el.render();

    let navigateBack = false;
    el.addEventListener("navigate-back", () => {
      navigateBack = true;
    });

    const backBtn = el.shadowRoot?.querySelector(
      '[data-action="back-to-settings"]',
    );
    backBtn?.dispatchEvent(new Event("click"));

    expect(navigateBack).toBe(true);

    document.body.removeChild(el);
  });
});
