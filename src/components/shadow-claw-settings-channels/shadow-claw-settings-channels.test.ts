import { jest } from "@jest/globals";

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    orchestrator: null,
  },
}));

jest.unstable_mockModule("../../toast.js", () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
  showWarning: jest.fn(),
}));

const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { showSuccess } = await import("../../toast.js");
const { showError, showWarning } = await import("../../toast.js");
const { ShadowClawSettingsChannels } =
  await import("./shadow-claw-settings-channels.js");

const originalFetch = globalThis.fetch;

function createOrchestratorStub() {
  return {
    getTelegramConfig: jest.fn(() => ({
      botToken: "tg-token",
      chatIds: ["123"],
      useProxy: true,
      enabled: true,
    })),
    getIMessageConfig: jest.fn(() => ({
      serverUrl: "https://bridge.example.com",
      apiKey: "im-key",
      chatIds: ["chat-1"],
      enabled: true,
    })),
    configureTelegram: jest.fn<any>().mockResolvedValue(undefined),
    configureIMessage: jest.fn<any>().mockResolvedValue(undefined),
    setChannelEnabled: jest.fn<any>().mockResolvedValue(undefined),
  };
}

describe("shadow-claw-settings-channels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis.fetch as any) = jest.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("https://api.telegram.org/")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({
              ok: false,
              description: "mock not configured",
            }),
          });
        }

        return originalFetch(input as any, init);
      },
    );
  });

  afterAll(() => {
    (globalThis.fetch as any) = originalFetch;
  });

  it("registers the custom element", () => {
    expect(customElements.get("shadow-claw-settings-channels")).toBe(
      ShadowClawSettingsChannels,
    );
  });

  it("renders stored Telegram and iMessage settings", async () => {
    (orchestratorStore as any).orchestrator = createOrchestratorStub();

    const el = new ShadowClawSettingsChannels();
    document.body.appendChild(el);
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
    await el.render();

    expect(
      (
        el.shadowRoot?.querySelector(
          '[data-setting="telegram-token-input"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("tg-token");
    expect(
      (
        el.shadowRoot?.querySelector(
          '[data-setting="imessage-server-url-input"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("https://bridge.example.com");

    expect(
      el.shadowRoot
        ?.querySelector('[data-info="telegram-token-status"]')
        ?.textContent?.trim(),
    ).toBe("Telegram token saved.");
    expect(
      el.shadowRoot
        ?.querySelector('[data-info="telegram-chat-ids-status"]')
        ?.textContent?.trim(),
    ).toBe("Allowed Telegram chat IDs saved: 123");
    expect(
      (
        el.shadowRoot?.querySelector(
          '[data-setting="telegram-use-proxy-toggle"]',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        el.shadowRoot?.querySelector(
          '[data-setting="telegram-enabled-toggle"]',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      el.shadowRoot
        ?.querySelector('[data-info="telegram-proxy-status"]')
        ?.textContent?.trim(),
    ).toBe("Telegram API calls are proxied through this server.");
    expect(
      (
        el.shadowRoot?.querySelector(
          '[data-setting="imessage-enabled-toggle"]',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);

    document.body.removeChild(el);
  });

  it("saves Telegram settings", async () => {
    const orchestrator = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orchestrator;

    const el = new ShadowClawSettingsChannels();
    document.body.appendChild(el);
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
    await el.render();

    (
      el.shadowRoot?.querySelector(
        '[data-setting="telegram-token-input"]',
      ) as HTMLInputElement
    ).value = "new-token";
    (
      el.shadowRoot?.querySelector(
        '[data-setting="telegram-chat-ids-input"]',
      ) as HTMLInputElement
    ).value = "1, 2";
    (
      el.shadowRoot?.querySelector(
        '[data-setting="telegram-use-proxy-toggle"]',
      ) as HTMLInputElement
    ).checked = false;
    (
      el.shadowRoot?.querySelector(
        '[data-setting="telegram-enabled-toggle"]',
      ) as HTMLInputElement
    ).checked = false;

    el.shadowRoot
      ?.querySelector('[data-action="save-telegram-config"]')
      ?.dispatchEvent(new Event("click"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(orchestrator.configureTelegram).toHaveBeenCalledWith(
      {},
      "new-token",
      ["1", "2"],
      false,
    );
    expect(orchestrator.setChannelEnabled).toHaveBeenCalledWith(
      {},
      "telegram",
      false,
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Telegram channel settings saved",
      3000,
    );

    document.body.removeChild(el);
  });

  it("saves Telegram settings after late orchestrator initialization", async () => {
    (orchestratorStore as any).orchestrator = null;

    const el = new ShadowClawSettingsChannels();
    document.body.appendChild(el);
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const orchestrator = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orchestrator;
    await el.render();

    (
      el.shadowRoot?.querySelector(
        '[data-setting="telegram-token-input"]',
      ) as HTMLInputElement
    ).value = "late-token";
    (
      el.shadowRoot?.querySelector(
        '[data-setting="telegram-chat-ids-input"]',
      ) as HTMLInputElement
    ).value = "1001, 1002";
    (
      el.shadowRoot?.querySelector(
        '[data-setting="telegram-use-proxy-toggle"]',
      ) as HTMLInputElement
    ).checked = true;
    (
      el.shadowRoot?.querySelector(
        '[data-setting="telegram-enabled-toggle"]',
      ) as HTMLInputElement
    ).checked = true;

    el.shadowRoot
      ?.querySelector('[data-action="save-telegram-config"]')
      ?.dispatchEvent(new Event("click"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(orchestrator.configureTelegram).toHaveBeenCalledWith(
      {},
      "late-token",
      ["1001", "1002"],
      true,
    );
    expect(orchestrator.setChannelEnabled).toHaveBeenCalledWith(
      {},
      "telegram",
      true,
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Telegram channel settings saved",
      3000,
    );

    document.body.removeChild(el);
  });

  it("saves iMessage settings", async () => {
    const orchestrator = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orchestrator;

    const el = new ShadowClawSettingsChannels();
    document.body.appendChild(el);
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
    await el.render();

    (
      el.shadowRoot?.querySelector(
        '[data-setting="imessage-server-url-input"]',
      ) as HTMLInputElement
    ).value = "https://next-bridge.example.com";
    (
      el.shadowRoot?.querySelector(
        '[data-setting="imessage-api-key-input"]',
      ) as HTMLInputElement
    ).value = "new-api-key";
    (
      el.shadowRoot?.querySelector(
        '[data-setting="imessage-chat-ids-input"]',
      ) as HTMLInputElement
    ).value = "chat-1, chat-2";
    (
      el.shadowRoot?.querySelector(
        '[data-setting="imessage-enabled-toggle"]',
      ) as HTMLInputElement
    ).checked = false;

    el.shadowRoot
      ?.querySelector('[data-action="save-imessage-config"]')
      ?.dispatchEvent(new Event("click"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(orchestrator.configureIMessage).toHaveBeenCalledWith(
      {},
      "https://next-bridge.example.com",
      "new-api-key",
      ["chat-1", "chat-2"],
    );
    expect(orchestrator.setChannelEnabled).toHaveBeenCalledWith(
      {},
      "imessage",
      false,
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "iMessage channel settings saved",
      3000,
    );

    document.body.removeChild(el);
  });

  it("verifies Telegram setup when token is valid and webhook is not set", async () => {
    const orchestrator = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orchestrator;

    (globalThis.fetch as any).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/getMe")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: { username: "shadow_claw_bot" },
            }),
          });
        }

        if (url.includes("/getWebhookInfo")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, result: { url: "" } }),
          });
        }

        return originalFetch(input as any, init);
      },
    );

    const el = new ShadowClawSettingsChannels();
    document.body.appendChild(el);
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
    await el.render();

    el.shadowRoot
      ?.querySelector('[data-action="verify-telegram-config"]')
      ?.dispatchEvent(new Event("click"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(showSuccess).toHaveBeenCalledWith(
      "Telegram setup looks good for @shadow_claw_bot. Token works and no webhook is active.",
      5000,
    );
    expect(showWarning).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/telegram/bottg-token/getMe",
    );

    document.body.removeChild(el);
  });

  it("warns when Telegram webhook is active", async () => {
    const orchestrator = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orchestrator;

    (globalThis.fetch as any).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/getMe")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: { username: "shadow_claw_bot" },
            }),
          });
        }

        if (url.includes("/getWebhookInfo")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: { url: "https://example.com/telegram-webhook" },
            }),
          });
        }

        return originalFetch(input as any, init);
      },
    );

    const el = new ShadowClawSettingsChannels();
    document.body.appendChild(el);
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
    await el.render();

    el.shadowRoot
      ?.querySelector('[data-action="verify-telegram-config"]')
      ?.dispatchEvent(new Event("click"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(showWarning).toHaveBeenCalledWith(
      "Telegram bot is valid (shadow_claw_bot), but a webhook is enabled. Clear it with deleteWebhook before relying on getUpdates polling.",
      7000,
    );

    document.body.removeChild(el);
  });

  it("verifies Telegram setup directly when proxy toggle is disabled", async () => {
    const orchestrator = createOrchestratorStub();
    orchestrator.getTelegramConfig.mockReturnValue({
      botToken: "tg-token",
      chatIds: ["123"],
      useProxy: false,
      enabled: true,
    });
    (orchestratorStore as any).orchestrator = orchestrator;

    (globalThis.fetch as any).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/getMe")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: { username: "shadow_claw_bot" },
            }),
          });
        }

        if (url.includes("/getWebhookInfo")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, result: { url: "" } }),
          });
        }

        return originalFetch(input as any, init);
      },
    );

    const el = new ShadowClawSettingsChannels();
    document.body.appendChild(el);
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
    await el.render();

    el.shadowRoot
      ?.querySelector('[data-action="verify-telegram-config"]')
      ?.dispatchEvent(new Event("click"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bottg-token/getMe",
    );

    document.body.removeChild(el);
  });
});
