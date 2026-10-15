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

  it("handles llamafile mode change, offline toggle, and fallback port when invalid", async () => {
    const el = new ShadowClawProviderModuleSettings();
    document.body.appendChild(el);

    el.setProvider("llamafile");
    el.setOverrides({
      llamafile: {
        mode: "server",
        host: "localhost",
        port: 9000,
        offline: false,
      },
    });
    await el.render();

    const root = el.shadowRoot!;
    const modeSelect = root.querySelector(
      '[data-role="llamafile-mode"]',
    ) as HTMLSelectElement;
    const portInput = root.querySelector(
      '[data-role="llamafile-port"]',
    ) as HTMLInputElement;
    const offlineCheckbox = root.querySelector(
      '[data-role="llamafile-offline"]',
    ) as HTMLInputElement;

    expect(modeSelect.value).toBe("server");
    expect(portInput.value).toBe("9000");
    expect(offlineCheckbox.checked).toBe(false);

    // Change port to invalid and offline to true
    portInput.value = "invalid-port";
    portInput.dispatchEvent(new Event("input"));

    let overrides = el.getOverrides();
    expect(overrides.llamafile?.port).toBe(8080);

    modeSelect.value = "server";
    modeSelect.dispatchEvent(new Event("change"));

    offlineCheckbox.checked = true;
    offlineCheckbox.dispatchEvent(new Event("change"));

    overrides = el.getOverrides();
    expect(overrides.llamafile?.mode).toBe("server");
    expect(overrides.llamafile?.offline).toBe(true);

    el.remove();
  });

  it("emits settings change for bedrock inputs", async () => {
    const el = new ShadowClawProviderModuleSettings();
    document.body.appendChild(el);

    el.setProvider("bedrock_proxy");
    await el.render();

    const listener = jest.fn();
    el.addEventListener(
      "provider-module-settings-change",
      listener as EventListener,
    );

    const root = el.shadowRoot!;
    const authModeSelect = root.querySelector(
      '[data-role="bedrock-auth-mode"]',
    ) as HTMLSelectElement;
    const regionInput = root.querySelector(
      '[data-role="bedrock-region"]',
    ) as HTMLInputElement;
    const profileInput = root.querySelector(
      '[data-role="bedrock-profile"]',
    ) as HTMLInputElement;

    authModeSelect.value = "sso";
    authModeSelect.dispatchEvent(new Event("change"));

    regionInput.value = "eu-west-1";
    regionInput.dispatchEvent(new Event("input"));

    profileInput.value = "prod-profile";
    profileInput.dispatchEvent(new Event("input"));

    expect(listener).toHaveBeenCalled();
    const lastDetail = (
      listener.mock.calls[listener.mock.calls.length - 1][0] as CustomEvent
    ).detail;
    expect(lastDetail.providerId).toBe("bedrock_proxy");
    expect(lastDetail.overrides.bedrock_proxy).toEqual({
      authMode: "sso",
      region: "eu-west-1",
      profile: "prod-profile",
    });

    el.remove();
  });

  it("hides sections and handles null provider or overrides", async () => {
    const el = new ShadowClawProviderModuleSettings();
    document.body.appendChild(el);

    el.setProvider(null);
    el.setOverrides(null as any);
    await el.render();

    const root = el.shadowRoot!;
    const llamafileSection = root.querySelector(
      '[data-role="llamafile-section"]',
    ) as HTMLElement;
    const bedrockSection = root.querySelector(
      '[data-role="bedrock-section"]',
    ) as HTMLElement;

    expect(llamafileSection.style.display).toBe("none");
    expect(bedrockSection.style.display).toBe("none");
    expect(el.getOverrides()).toEqual({});

    el.remove();
  });
});
