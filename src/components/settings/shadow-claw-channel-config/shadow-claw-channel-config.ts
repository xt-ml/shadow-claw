import { getDb } from "../../../db/db.js";
import { effect } from "../../../effect.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess, showWarning } from "../../../toast.js";

import type { Orchestrator } from "../../../orchestrator.js";
import type { ShadowClawDatabase } from "../../../types.js";

import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-channel-config";

export class ShadowClawChannelConfig extends ShadowClawElement {
  static componentPath = `components/settings/${elementName}`;
  static styles = `${ShadowClawChannelConfig.componentPath}/${elementName}.css`;
  static template = `${ShadowClawChannelConfig.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;
  orchestrator: Orchestrator | null = null;

  constructor() {
    super();
  }

  getOrchestrator(): Orchestrator | null {
    const current = orchestratorStore.orchestrator;
    if (current) {
      this.orchestrator = current;
    }

    return this.orchestrator;
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();
    this.orchestrator = orchestratorStore.orchestrator;

    this.bindEventListeners();
    this.setupEffects();
    await this.render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  setupEffects() {
    this.addCleanup(
      effect(() => {
        const ready = orchestratorStore.ready;
        if (!ready) {
          return;
        }

        void this.render();
      }),
    );
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-action="save-telegram-config"]')
      ?.addEventListener("click", () => this.saveTelegramConfig());

    root
      .querySelector('[data-action="save-imessage-config"]')
      ?.addEventListener("click", () => this.saveIMessageConfig());

    root
      .querySelector('[data-action="verify-telegram-config"]')
      ?.addEventListener("click", () => this.verifyTelegramConfig());
  }

  async render() {
    const orchestrator = this.getOrchestrator();
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    if (!orchestrator) {
      this.setLoadingState(root);

      return;
    }

    const telegram = orchestrator.getTelegramConfig();
    const imessage = orchestrator.getIMessageConfig();

    const telegramTokenInput = root.querySelector(
      '[data-setting="telegram-token-input"]',
    ) as HTMLInputElement | null;
    const telegramChatIdsInput = root.querySelector(
      '[data-setting="telegram-chat-ids-input"]',
    ) as HTMLInputElement | null;
    const telegramUseProxyToggle = root.querySelector(
      '[data-setting="telegram-use-proxy-toggle"]',
    ) as HTMLInputElement | null;
    const telegramEnabledToggle = root.querySelector(
      '[data-setting="telegram-enabled-toggle"]',
    ) as HTMLInputElement | null;
    const imessageServerUrlInput = root.querySelector(
      '[data-setting="imessage-server-url-input"]',
    ) as HTMLInputElement | null;
    const imessageApiKeyInput = root.querySelector(
      '[data-setting="imessage-api-key-input"]',
    ) as HTMLInputElement | null;
    const imessageChatIdsInput = root.querySelector(
      '[data-setting="imessage-chat-ids-input"]',
    ) as HTMLInputElement | null;
    const imessageEnabledToggle = root.querySelector(
      '[data-setting="imessage-enabled-toggle"]',
    ) as HTMLInputElement | null;

    if (telegramEnabledToggle) {
      telegramEnabledToggle.checked = telegram.enabled;
    }

    const telegramChannelStatus = root.querySelector(
      '[data-info="telegram-channel-status"]',
    );
    if (telegramChannelStatus) {
      telegramChannelStatus.textContent = telegram.enabled
        ? "Telegram channel is enabled."
        : "Telegram channel is disabled. Saved settings are retained.";
    }

    if (telegramTokenInput) {
      telegramTokenInput.value = telegram.botToken;
    }

    const telegramTokenStatus = root.querySelector(
      '[data-info="telegram-token-status"]',
    );
    if (telegramTokenStatus) {
      telegramTokenStatus.textContent = telegram.botToken
        ? "Telegram token saved."
        : "No Telegram token saved.";
    }

    if (telegramChatIdsInput) {
      telegramChatIdsInput.value = telegram.chatIds.join(", ");
    }

    const telegramChatIdsStatus = root.querySelector(
      '[data-info="telegram-chat-ids-status"]',
    );
    if (telegramChatIdsStatus) {
      telegramChatIdsStatus.textContent = telegram.chatIds.length
        ? `Allowed Telegram chat IDs saved: ${telegram.chatIds.join(", ")}`
        : "No Telegram chat IDs saved.";
    }

    if (telegramUseProxyToggle) {
      telegramUseProxyToggle.checked = !!telegram.useProxy;
    }

    const telegramProxyStatus = root.querySelector(
      '[data-info="telegram-proxy-status"]',
    );
    if (telegramProxyStatus) {
      telegramProxyStatus.textContent = telegram.useProxy
        ? "Telegram API calls are proxied through this server."
        : "Telegram API calls go directly to Telegram.";
    }

    if (imessageServerUrlInput) {
      imessageServerUrlInput.value = imessage.serverUrl;
    }

    if (imessageApiKeyInput) {
      imessageApiKeyInput.value = imessage.apiKey;
    }

    if (imessageChatIdsInput) {
      imessageChatIdsInput.value = imessage.chatIds.join(", ");
    }

    if (imessageEnabledToggle) {
      imessageEnabledToggle.checked = imessage.enabled;
    }

    const imessageChannelStatus = root.querySelector(
      '[data-info="imessage-channel-status"]',
    );
    if (imessageChannelStatus) {
      imessageChannelStatus.textContent = imessage.enabled
        ? "iMessage channel is enabled."
        : "iMessage channel is disabled. Saved settings are retained.";
    }

    const imessageChatIdsStatus = root.querySelector(
      '[data-info="imessage-chat-ids-status"]',
    );
    if (imessageChatIdsStatus) {
      imessageChatIdsStatus.textContent = imessage.chatIds.length
        ? `Allowed iMessage chat IDs saved: ${imessage.chatIds.join(", ")}`
        : "No iMessage chat IDs saved.";
    }

    this.updateChannelFieldAvailability(
      root,
      telegram.enabled,
      imessage.enabled,
    );
  }

  setLoadingState(root: ShadowRoot) {
    const telegramTokenStatus = root.querySelector(
      '[data-info="telegram-token-status"]',
    );
    if (telegramTokenStatus) {
      telegramTokenStatus.textContent = "Loading Telegram settings...";
    }

    const telegramChatIdsStatus = root.querySelector(
      '[data-info="telegram-chat-ids-status"]',
    );
    if (telegramChatIdsStatus) {
      telegramChatIdsStatus.textContent = "Loading Telegram settings...";
    }

    const imessageChatIdsStatus = root.querySelector(
      '[data-info="imessage-chat-ids-status"]',
    );
    if (imessageChatIdsStatus) {
      imessageChatIdsStatus.textContent = "Loading iMessage settings...";
    }
  }

  updateChannelFieldAvailability(
    root: ShadowRoot,
    telegramEnabled: boolean,
    imessageEnabled: boolean,
  ) {
    const telegramTokenInput = root.querySelector(
      '[data-setting="telegram-token-input"]',
    ) as HTMLInputElement | null;
    const telegramChatIdsInput = root.querySelector(
      '[data-setting="telegram-chat-ids-input"]',
    ) as HTMLInputElement | null;
    const telegramUseProxyToggle = root.querySelector(
      '[data-setting="telegram-use-proxy-toggle"]',
    ) as HTMLInputElement | null;
    const verifyTelegramButton = root.querySelector(
      '[data-action="verify-telegram-config"]',
    ) as HTMLButtonElement | null;

    if (telegramTokenInput) {
      telegramTokenInput.disabled = !telegramEnabled;
    }

    if (telegramChatIdsInput) {
      telegramChatIdsInput.disabled = !telegramEnabled;
    }

    if (telegramUseProxyToggle) {
      telegramUseProxyToggle.disabled = !telegramEnabled;
    }

    if (verifyTelegramButton) {
      verifyTelegramButton.disabled = !telegramEnabled;
    }

    const imessageServerUrlInput = root.querySelector(
      '[data-setting="imessage-server-url-input"]',
    ) as HTMLInputElement | null;
    const imessageApiKeyInput = root.querySelector(
      '[data-setting="imessage-api-key-input"]',
    ) as HTMLInputElement | null;
    const imessageChatIdsInput = root.querySelector(
      '[data-setting="imessage-chat-ids-input"]',
    ) as HTMLInputElement | null;

    if (imessageServerUrlInput) {
      imessageServerUrlInput.disabled = !imessageEnabled;
    }

    if (imessageApiKeyInput) {
      imessageApiKeyInput.disabled = !imessageEnabled;
    }

    if (imessageChatIdsInput) {
      imessageChatIdsInput.disabled = !imessageEnabled;
    }

    root
      .querySelectorAll(".form-group")
      .forEach((group) => group.classList.remove("form-group--disabled"));

    if (!telegramEnabled) {
      root
        .querySelector('[data-setting="telegram-token-input"]')
        ?.closest(".form-group")
        ?.classList.add("form-group--disabled");
    }

    if (!imessageEnabled) {
      root
        .querySelector('[data-setting="imessage-server-url-input"]')
        ?.closest(".form-group")
        ?.classList.add("form-group--disabled");
    }
  }

  async saveTelegramConfig() {
    const orchestrator = this.getOrchestrator();
    if (!orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const tokenInput = root.querySelector(
      '[data-setting="telegram-token-input"]',
    ) as HTMLInputElement | null;
    const chatIdsInput = root.querySelector(
      '[data-setting="telegram-chat-ids-input"]',
    ) as HTMLInputElement | null;
    const useProxyToggle = root.querySelector(
      '[data-setting="telegram-use-proxy-toggle"]',
    ) as HTMLInputElement | null;
    const enabledToggle = root.querySelector(
      '[data-setting="telegram-enabled-toggle"]',
    ) as HTMLInputElement | null;

    try {
      await orchestrator.configureTelegram(
        this.db,
        tokenInput?.value || "",
        parseCommaSeparatedList(chatIdsInput?.value || ""),
        !!useProxyToggle?.checked,
      );
      await orchestrator.setChannelEnabled(
        this.db,
        "telegram",
        !!enabledToggle?.checked,
      );
      await this.render();
      showSuccess("Telegram channel settings saved", 3000);
    } catch (error) {
      showError(
        `Error saving Telegram settings: ${error instanceof Error ? error.message : String(error)}`,
        6000,
      );
    }
  }

  async verifyTelegramConfig() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const tokenInput = root.querySelector(
      '[data-setting="telegram-token-input"]',
    ) as HTMLInputElement | null;
    const token = tokenInput?.value?.trim() || "";
    const telegramUseProxyToggle = root.querySelector(
      '[data-setting="telegram-use-proxy-toggle"]',
    ) as HTMLInputElement | null;
    const apiBase = telegramUseProxyToggle?.checked
      ? "/telegram/bot"
      : "https://api.telegram.org/bot";

    if (!token) {
      showError("Telegram bot token is empty. Save the token first.", 5000);

      return;
    }

    try {
      const meRes = await fetch(`${apiBase}${token}/getMe`);
      const meJson = (await meRes.json()) as {
        ok?: boolean;
        description?: string;
        result?: { username?: string };
      };

      if (!meRes.ok || !meJson.ok) {
        throw new Error(meJson.description || `HTTP ${meRes.status}`);
      }

      const webhookRes = await fetch(`${apiBase}${token}/getWebhookInfo`);
      const webhookJson = (await webhookRes.json()) as {
        ok?: boolean;
        description?: string;
        result?: { url?: string };
      };

      if (!webhookRes.ok || !webhookJson.ok) {
        throw new Error(webhookJson.description || `HTTP ${webhookRes.status}`);
      }

      const webhookUrl = webhookJson.result?.url?.trim() || "";
      if (webhookUrl) {
        showWarning(
          `Telegram bot is valid (${meJson.result?.username || "unknown"}), but a webhook is enabled. Clear it with deleteWebhook before relying on getUpdates polling.`,
          7000,
        );

        return;
      }

      showSuccess(
        `Telegram setup looks good for @${meJson.result?.username || "unknown"}. Token works and no webhook is active.`,
        5000,
      );
    } catch (error) {
      showError(
        `Telegram verification failed: ${error instanceof Error ? error.message : String(error)}`,
        7000,
      );
    }
  }

  async saveIMessageConfig() {
    const orchestrator = this.getOrchestrator();
    if (!orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const serverUrlInput = root.querySelector(
      '[data-setting="imessage-server-url-input"]',
    ) as HTMLInputElement | null;
    const apiKeyInput = root.querySelector(
      '[data-setting="imessage-api-key-input"]',
    ) as HTMLInputElement | null;
    const chatIdsInput = root.querySelector(
      '[data-setting="imessage-chat-ids-input"]',
    ) as HTMLInputElement | null;
    const enabledToggle = root.querySelector(
      '[data-setting="imessage-enabled-toggle"]',
    ) as HTMLInputElement | null;

    try {
      await orchestrator.configureIMessage(
        this.db,
        serverUrlInput?.value || "",
        apiKeyInput?.value || "",
        parseCommaSeparatedList(chatIdsInput?.value || ""),
      );
      await orchestrator.setChannelEnabled(
        this.db,
        "imessage",
        !!enabledToggle?.checked,
      );
      await this.render();
      showSuccess("iMessage channel settings saved", 3000);
    } catch (error) {
      showError(
        `Error saving iMessage settings: ${error instanceof Error ? error.message : String(error)}`,
        6000,
      );
    }
  }
}

function parseCommaSeparatedList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

customElements.define(elementName, ShadowClawChannelConfig);
