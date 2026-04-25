import { jest } from "@jest/globals";

jest.unstable_mockModule("../../config.js", () => ({
  CONFIG_KEYS: {
    SERVICE_ACCOUNTS: "service_accounts",
    SERVICE_DEFAULT_ACCOUNT: "service_default_account",
  },
  OAUTH_PROVIDER_DEFINITIONS: {
    github: {
      id: "github",
      name: "GitHub",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      defaultScopes: ["repo", "read:user"],
      usePkce: true,
    },
  },
}));

jest.unstable_mockModule("../../db/setConfig.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({}),
}));

jest.unstable_mockModule("../../toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.unstable_mockModule("../../crypto.js", () => ({
  encryptValue: jest.fn<any>().mockResolvedValue("encrypted-token"),
}));

jest.unstable_mockModule("../../ulid.js", () => ({
  ulid: jest.fn(() => "acct-1"),
}));

const { setConfig } = await import("../../db/setConfig.js");
const { getConfig } = await import("../../db/getConfig.js");
const { showSuccess, showError } = await import("../../toast.js");
const { ShadowClawSettingsAccounts } =
  await import("./shadow-claw-settings-accounts.js");

describe("shadow-claw-settings-accounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-settings-accounts")).toBe(
      ShadowClawSettingsAccounts,
    );
  });

  it("renders correctly after connectedCallback", async () => {
    const el = new ShadowClawSettingsAccounts();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    expect(
      el.shadowRoot?.querySelector('[data-action="add-account"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-region="account-list"]'),
    ).not.toBeNull();

    document.body.removeChild(el);
  });

  it("opens account form when Add Account is clicked", async () => {
    const el = new ShadowClawSettingsAccounts();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    const addBtn = el.shadowRoot?.querySelector('[data-action="add-account"]');
    addBtn?.dispatchEvent(new Event("click"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot?.querySelector(".account-form")).not.toBeNull();

    document.body.removeChild(el);
  });

  it("saves an additional account", async () => {
    const el = new ShadowClawSettingsAccounts();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    el.showAccountForm("new");

    const root = el.shadowRoot!;
    (
      root.querySelector('[data-field="acct-label"]') as HTMLInputElement
    ).value = "Figma Design";
    (
      root.querySelector('[data-field="acct-service"]') as HTMLInputElement
    ).value = "Figma";
    (root.querySelector('[data-field="acct-host"]') as HTMLInputElement).value =
      "api.figma.com";
    (
      root.querySelector('[data-field="acct-token"]') as HTMLInputElement
    ).value = "figd_test_token";

    await el.saveAccountForm();

    expect(setConfig).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith("Account added", 3000);

    document.body.removeChild(el);
  });

  it("connects OAuth and persists OAuth account fields", async () => {
    const openSpy = jest.spyOn(window, "open").mockReturnValue(null as any);

    const el = new ShadowClawSettingsAccounts();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockImplementationOnce(
        async () =>
          ({
            ok: true,
            json: async () => ({
              state: "oauth-state-1",
              authorizeUrl:
                "https://github.com/login/oauth/authorize?state=oauth-state-1",
            }),
          }) as any,
      )
      .mockImplementationOnce(
        async () =>
          ({
            ok: true,
            json: async () => ({
              status: "authorized",
            }),
          }) as any,
      )
      .mockImplementationOnce(
        async () =>
          ({
            ok: true,
            json: async () => ({
              accessToken: "oauth-access-token",
              refreshToken: "oauth-refresh-token",
              expiresIn: 3600,
              scope: "repo read:user",
              tokenType: "Bearer",
            }),
          }) as any,
      );

    el.showAccountForm("new");
    const root = el.shadowRoot!;
    (
      root.querySelector('[data-field="acct-label"]') as HTMLInputElement
    ).value = "GitHub OAuth";
    (
      root.querySelector('[data-field="acct-service"]') as HTMLInputElement
    ).value = "GitHub";
    (root.querySelector('[data-field="acct-host"]') as HTMLInputElement).value =
      "api.github.com";
    (
      root.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    ).value = "oauth";
    (
      root.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    ).dispatchEvent(new Event("change"));
    (
      root.querySelector(
        '[data-field="acct-oauth-provider"]',
      ) as HTMLSelectElement
    ).value = "github";
    (
      root.querySelector(
        '[data-field="acct-oauth-client-id"]',
      ) as HTMLInputElement
    ).value = "client-123";
    (
      root.querySelector(
        '[data-field="acct-oauth-client-secret"]',
      ) as HTMLInputElement
    ).value = "secret-xyz";

    await el.connectOAuthFromForm(
      root.querySelector('[data-region="account-form-slot"]') as Element,
    );

    expect(showError).not.toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith("OAuth connected", 3000);

    await el.saveAccountForm();

    expect(setConfig).toHaveBeenCalledWith(
      {},
      "service_accounts",
      expect.arrayContaining([
        expect.objectContaining({
          authMode: "oauth",
          oauthProviderId: "github",
          oauthClientId: "client-123",
          oauthClientSecret: "encrypted-token",
          token: "encrypted-token",
        }),
      ]),
    );

    expect(openSpy).toHaveBeenCalled();

    fetchMock.mockClear();
    openSpy.mockRestore();
    document.body.removeChild(el);
  });

  it("persists configured OAuth scopes when token exchange omits scope", async () => {
    const openSpy = jest.spyOn(window, "open").mockReturnValue(null as any);

    const el = new ShadowClawSettingsAccounts();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockImplementationOnce(
        async () =>
          ({
            ok: true,
            json: async () => ({
              state: "oauth-state-2",
              authorizeUrl: "https://www.figma.com/oauth?state=oauth-state-2",
            }),
          }) as any,
      )
      .mockImplementationOnce(
        async () =>
          ({
            ok: true,
            json: async () => ({
              status: "authorized",
            }),
          }) as any,
      )
      .mockImplementationOnce(
        async () =>
          ({
            ok: true,
            json: async () => ({
              accessToken: "oauth-access-token",
              refreshToken: "oauth-refresh-token",
              expiresIn: 3600,
              tokenType: "Bearer",
            }),
          }) as any,
      );

    el.showAccountForm("new");
    const root = el.shadowRoot!;
    (
      root.querySelector('[data-field="acct-label"]') as HTMLInputElement
    ).value = "Figma OAuth";
    (
      root.querySelector('[data-field="acct-service"]') as HTMLInputElement
    ).value = "Figma";
    (root.querySelector('[data-field="acct-host"]') as HTMLInputElement).value =
      "api.figma.com";
    (
      root.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    ).value = "oauth";
    (
      root.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    ).dispatchEvent(new Event("change"));
    (
      root.querySelector(
        '[data-field="acct-oauth-provider"]',
      ) as HTMLSelectElement
    ).value = "github";
    (
      root.querySelector(
        '[data-field="acct-oauth-client-id"]',
      ) as HTMLInputElement
    ).value = "client-456";
    (
      root.querySelector('[data-field="acct-oauth-scope"]') as HTMLInputElement
    ).value = "file_content:read file_comments:write";

    await el.connectOAuthFromForm(
      root.querySelector('[data-region="account-form-slot"]') as Element,
    );

    await el.saveAccountForm();

    expect(setConfig).toHaveBeenCalledWith(
      {},
      "service_accounts",
      expect.arrayContaining([
        expect.objectContaining({
          authMode: "oauth",
          scopes: ["file_content:read", "file_comments:write"],
        }),
      ]),
    );

    fetchMock.mockClear();
    openSpy.mockRestore();
    document.body.removeChild(el);
  });

  it("defaults legacy OAuth account edit form to OAuth mode", async () => {
    (getConfig as jest.Mock).mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve([
          {
            id: "acct-legacy-oauth",
            label: "Figma OAuth Legacy",
            service: "Figma",
            hostPattern: "api.figma.com",
            token: "encrypted-token",
            oauthProviderId: "github",
            oauthClientId: "client-legacy",
          },
        ]);
      }

      if (key === "service_default_account") {
        return Promise.resolve("acct-legacy-oauth");
      }

      return Promise.resolve(undefined);
    });

    const el = new ShadowClawSettingsAccounts();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    el.showAccountForm("acct-legacy-oauth");

    const modeSelect = el.shadowRoot?.querySelector(
      '[data-field="acct-auth-mode"]',
    ) as HTMLSelectElement;
    expect(modeSelect.value).toBe("oauth");

    document.body.removeChild(el);
  });
});
