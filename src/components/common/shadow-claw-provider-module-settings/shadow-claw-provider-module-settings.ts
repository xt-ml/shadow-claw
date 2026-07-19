import ShadowClawElement from "../../shadow-claw-element.js";
import shadowClawProviderModuleSettingsStyles from "./shadow-claw-provider-module-settings.css" with { type: "css" };
import shadowClawProviderModuleSettingsTemplate from "./shadow-claw-provider-module-settings.html" with { type: "html" };

const elementName = "shadow-claw-provider-module-settings";

type ProviderId = "bedrock_proxy" | "llamafile" | string;

export interface ProviderRuntimeOverrides {
  bedrock_proxy?: {
    authMode?: "provider_chain" | "sso";
    profile?: string;
    region?: string;
  };
  llamafile?: {
    host?: string;
    mode?: "cli" | "server";
    offline?: boolean;
    port?: number;
  };
}

export class ShadowClawProviderModuleSettings extends ShadowClawElement {
  static styles = shadowClawProviderModuleSettingsStyles;
  static template = shadowClawProviderModuleSettingsTemplate;

  private currentProviderId: ProviderId | null = null;
  private overrides: ProviderRuntimeOverrides = {};

  async connectedCallback() {
    this.bindEvents();
    await this.render();
  }

  getOverrides(): ProviderRuntimeOverrides {
    return JSON.parse(JSON.stringify(this.overrides));
  }

  setOverrides(overrides: ProviderRuntimeOverrides): void {
    this.overrides = overrides ? JSON.parse(JSON.stringify(overrides)) : {};
    this.render();
  }

  setProvider(providerId: ProviderId | null): void {
    this.currentProviderId = providerId || null;
    this.render();
  }

  async render(): Promise<void> {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const llamafileSection = root.querySelector(
      '[data-role="llamafile-section"]',
    ) as HTMLElement | null;
    const bedrockSection = root.querySelector(
      '[data-role="bedrock-section"]',
    ) as HTMLElement | null;

    if (!llamafileSection || !bedrockSection) {
      return;
    }

    llamafileSection.style.display =
      this.currentProviderId === "llamafile" ? "flex" : "none";
    bedrockSection.style.display =
      this.currentProviderId === "bedrock_proxy" ? "flex" : "none";

    const llama = this.overrides.llamafile || {};
    const modeEl = root.querySelector(
      '[data-role="llamafile-mode"]',
    ) as HTMLSelectElement | null;
    const hostEl = root.querySelector(
      '[data-role="llamafile-host"]',
    ) as HTMLInputElement | null;
    const portEl = root.querySelector(
      '[data-role="llamafile-port"]',
    ) as HTMLInputElement | null;
    const offlineEl = root.querySelector(
      '[data-role="llamafile-offline"]',
    ) as HTMLInputElement | null;

    if (modeEl && hostEl && portEl && offlineEl) {
      modeEl.value = llama.mode === "server" ? "server" : "cli";
      hostEl.value = llama.host || "127.0.0.1";
      portEl.value = String(llama.port || 8080);
      offlineEl.checked = llama.offline ?? true;
    }

    const bedrock = this.overrides.bedrock_proxy || {};
    const authModeEl = root.querySelector(
      '[data-role="bedrock-auth-mode"]',
    ) as HTMLSelectElement | null;
    const regionEl = root.querySelector(
      '[data-role="bedrock-region"]',
    ) as HTMLInputElement | null;
    const profileEl = root.querySelector(
      '[data-role="bedrock-profile"]',
    ) as HTMLInputElement | null;

    if (authModeEl && regionEl && profileEl) {
      authModeEl.value = bedrock.authMode === "sso" ? "sso" : "provider_chain";
      regionEl.value = bedrock.region || "";
      profileEl.value = bedrock.profile || "";
    }
  }

  private bindEvents(): void {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const listeners: Array<[string, string]> = [
      ["llamafile-mode", "change"],
      ["llamafile-host", "input"],
      ["llamafile-port", "input"],
      ["llamafile-offline", "change"],
      ["bedrock-auth-mode", "change"],
      ["bedrock-region", "input"],
      ["bedrock-profile", "input"],
    ];

    for (const [role, eventName] of listeners) {
      const el = root.querySelector(`[data-role=\"${role}\"]`);
      el?.addEventListener(eventName, () => {
        this.readControlsIntoOverrides();
        this.emitChange();
      });
    }
  }

  private emitChange(): void {
    this.dispatchEvent(
      new CustomEvent("provider-module-settings-change", {
        detail: {
          providerId: this.currentProviderId,
          overrides: this.getOverrides(),
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private readControlsIntoOverrides(): void {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    if (this.currentProviderId === "llamafile") {
      const modeEl = root.querySelector(
        '[data-role="llamafile-mode"]',
      ) as HTMLSelectElement | null;
      const hostEl = root.querySelector(
        '[data-role="llamafile-host"]',
      ) as HTMLInputElement | null;
      const portEl = root.querySelector(
        '[data-role="llamafile-port"]',
      ) as HTMLInputElement | null;
      const offlineEl = root.querySelector(
        '[data-role="llamafile-offline"]',
      ) as HTMLInputElement | null;

      if (!modeEl || !hostEl || !portEl || !offlineEl) {
        return;
      }

      const portNum = parseInt(portEl.value, 10);
      this.overrides.llamafile = {
        mode: modeEl.value === "server" ? "server" : "cli",
        host: hostEl.value.trim(),
        port: Number.isFinite(portNum) && portNum > 0 ? portNum : 8080,
        offline: offlineEl.checked,
      };

      return;
    }

    if (this.currentProviderId === "bedrock_proxy") {
      const authModeEl = root.querySelector(
        '[data-role="bedrock-auth-mode"]',
      ) as HTMLSelectElement | null;
      const regionEl = root.querySelector(
        '[data-role="bedrock-region"]',
      ) as HTMLInputElement | null;
      const profileEl = root.querySelector(
        '[data-role="bedrock-profile"]',
      ) as HTMLInputElement | null;

      if (!authModeEl || !regionEl || !profileEl) {
        return;
      }

      this.overrides.bedrock_proxy = {
        authMode: authModeEl.value === "sso" ? "sso" : "provider_chain",
        region: regionEl.value.trim(),
        profile: profileEl.value.trim(),
      };
    }
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawProviderModuleSettings);
}
