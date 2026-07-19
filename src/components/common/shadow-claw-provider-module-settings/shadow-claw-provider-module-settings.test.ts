import { jest } from "@jest/globals";

import { ShadowClawProviderModuleSettings } from "./shadow-claw-provider-module-settings.js";

describe("shadow-claw-provider-module-settings", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-provider-module-settings")).toBe(
      ShadowClawProviderModuleSettings,
    );
  });

  it("shows bedrock controls when provider is bedrock_proxy", async () => {
    const el = new ShadowClawProviderModuleSettings();
    document.body.appendChild(el);

    el.setProvider("bedrock_proxy");
    el.setOverrides({
      bedrock_proxy: {
        authMode: "sso",
        region: "us-east-1",
        profile: "team",
      },
    });
    await el.render();

    const root = el.shadowRoot;
    const bedrockSection = root?.querySelector(
      '[data-role="bedrock-section"]',
    ) as HTMLElement | null;
    const authMode = root?.querySelector(
      '[data-role="bedrock-auth-mode"]',
    ) as HTMLSelectElement | null;

    expect(bedrockSection?.style.display).toBe("flex");
    expect(authMode?.value).toBe("sso");

    el.remove();
  });

  it("emits settings change for llamafile edits", async () => {
    const el = new ShadowClawProviderModuleSettings();
    document.body.appendChild(el);

    el.setProvider("llamafile");
    await el.render();

    const listener = jest.fn();
    el.addEventListener(
      "provider-module-settings-change",
      listener as EventListener,
    );

    const hostInput = el.shadowRoot?.querySelector(
      '[data-role="llamafile-host"]',
    ) as HTMLInputElement | null;

    if (!hostInput) {
      throw new Error("llamafile host input missing");
    }

    hostInput.value = "10.1.2.3";
    hostInput.dispatchEvent(new Event("input"));

    expect(listener).toHaveBeenCalled();
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.providerId).toBe("llamafile");
    expect(detail.overrides.llamafile.host).toBe("10.1.2.3");

    el.remove();
  });
});
