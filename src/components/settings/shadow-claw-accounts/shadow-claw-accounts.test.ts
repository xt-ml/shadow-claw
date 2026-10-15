import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../config/config.js", () => ({
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
    custom_mcp: {
      id: "custom_mcp",
      name: "Custom MCP",
      authorizeUrl: "https://example.com/oauth/authorize",
      tokenUrl: "https://example.com/oauth/token",
      defaultScopes: [],
      usePkce: true,
    },
  },
}));

jest.unstable_mockModule("../../../db/set-config.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../db/get-config.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({}),
}));

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.unstable_mockModule("../../../security/crypto.js", () => ({
  encryptValue: jest.fn<any>().mockResolvedValue("encrypted-token"),
}));

jest.unstable_mockModule("../../../utils/ulid.js", () => ({
  ulid: jest.fn(() => "acct-1"),
}));

jest.unstable_mockModule("../../../security/trusted-types.js", () => ({
  sanitizeToTrustedHtml: jest.fn((html: string) => html),
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
  toTrustedHtmlPresanitized: jest.fn((html: string) => html),
  toTrustedScriptUrl: jest.fn((url: string) => url),
}));

const { setConfig } = await import("../../../db/set-config.js");
const { getConfig } = await import("../../../db/get-config.js");
const { showSuccess, showError } = await import("../../../ui/toast.js");
const { setSanitizedHtml } = await import("../../../security/trusted-types.js");
const { ShadowClawAccounts } = await import("./shadow-claw-accounts.js");

describe("shadow-claw-accounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-accounts")).toBe(ShadowClawAccounts);
  });

  it("renders correctly after connectedCallback", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
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
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    const addBtn = el.shadowRoot?.querySelector('[data-action="add-account"]');
    addBtn?.dispatchEvent(new Event("click"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot?.querySelector(".account-form")).not.toBeNull();

    document.body.removeChild(el);
  });

  it("saves an additional account", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
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

    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
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

    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
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

    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    el.showAccountForm("acct-legacy-oauth");

    const modeSelect = el.shadowRoot?.querySelector(
      '[data-field="acct-auth-mode"]',
    ) as HTMLSelectElement;
    expect(modeSelect.value).toBe("oauth");

    document.body.removeChild(el);
  });

  it("routes showAccountForm innerHTML through the Trusted Types helper", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    (setSanitizedHtml as jest.Mock).mockClear();

    el.showAccountForm("new");

    const slot = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;

    expect(setSanitizedHtml).toHaveBeenCalledWith(
      slot,
      expect.stringContaining("Add Account"),
    );

    document.body.removeChild(el);
  });

  it("handles setDefaultAccount and deleteAccount", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();
    el.db = {} as any;

    el.accounts = [
      {
        id: "acct-1",
        label: "Account 1",
        service: "Figma",
        hostPattern: "api.figma.com",
        authMode: "token",
      } as any,
      {
        id: "acct-2",
        label: "Account 2",
        service: "Linear",
        hostPattern: "api.linear.app",
        authMode: "token",
      } as any,
    ];
    el.defaultAccountId = "acct-1";

    await el.setDefaultAccount("acct-2");
    expect(el.defaultAccountId).toBe("acct-2");

    await el.deleteAccount("acct-1");
    expect(el.accounts.find((a) => a.id === "acct-1")).toBeUndefined();
    expect(el.defaultAccountId).toBe("acct-2");

    document.body.removeChild(el);
  });

  it("updates an existing account and supports basic auth", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();
    el.db = {} as any;

    el.accounts = [
      {
        id: "acct-existing",
        label: "Old Label",
        service: "GitHub",
        hostPattern: "api.github.com",
        authMode: "token",
        token: "old-token",
      } as any,
    ];

    el.showAccountForm("acct-existing");

    const root = el.shadowRoot!;
    (
      root.querySelector('[data-field="acct-label"]') as HTMLInputElement
    ).value = "Updated Label";
    (
      root.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    ).value = "basic";
    (
      root.querySelector(
        '[data-field="acct-basic-username"]',
      ) as HTMLInputElement
    ).value = "admin";
    (
      root.querySelector('[data-field="acct-token"]') as HTMLInputElement
    ).value = "secret-pass";

    await el.saveAccountForm();

    expect(showSuccess).toHaveBeenCalledWith("Account updated", 3000);
    const updated = el.accounts.find((a) => a.id === "acct-existing");
    expect(updated?.label).toBe("Updated Label");
    expect(updated?.authMode).toBe("basic");
    expect(updated?.basicUsername).toBe("admin");

    document.body.removeChild(el);
  });

  it("handles validation errors when saving account", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();
    el.db = {} as any;

    el.showAccountForm("new");
    const root = el.shadowRoot!;

    // 1. Missing label/service/host
    (
      root.querySelector('[data-field="acct-label"]') as HTMLInputElement
    ).value = "";
    await el.saveAccountForm();
    expect(showError).toHaveBeenCalledWith(
      "Label, Service, and Host Pattern are required.",
      4000,
    );

    // Fill required base fields
    (
      root.querySelector('[data-field="acct-label"]') as HTMLInputElement
    ).value = "Test";
    (
      root.querySelector('[data-field="acct-service"]') as HTMLInputElement
    ).value = "Service";
    (root.querySelector('[data-field="acct-host"]') as HTMLInputElement).value =
      "example.com";
    (
      root.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    ).value = "oauth";

    // 2. OAuth mode missing client ID
    (
      root.querySelector(
        '[data-field="acct-oauth-provider"]',
      ) as HTMLSelectElement
    ).value = "github";
    (
      root.querySelector(
        '[data-field="acct-oauth-client-id"]',
      ) as HTMLInputElement
    ).value = "";
    await el.saveAccountForm();
    expect(showError).toHaveBeenCalledWith(
      "OAuth client ID is required for OAuth mode.",
      4000,
    );

    document.body.removeChild(el);
  });

  it("handles error when setConfig fails during saveAccountForm", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();
    el.db = {} as any;

    el.showAccountForm("new");
    const root = el.shadowRoot!;
    (
      root.querySelector('[data-field="acct-label"]') as HTMLInputElement
    ).value = "Faulty";
    (
      root.querySelector('[data-field="acct-service"]') as HTMLInputElement
    ).value = "Service";
    (root.querySelector('[data-field="acct-host"]') as HTMLInputElement).value =
      "example.com";

    (setConfig as jest.Mock).mockRejectedValueOnce(
      new Error("Database write error"),
    );
    await el.saveAccountForm();

    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Database write error"),
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles settings-action event routing on account list", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();
    el.db = {} as any;

    const showFormSpy = jest
      .spyOn(el, "showAccountForm")
      .mockImplementation(() => {});
    const deleteSpy = jest
      .spyOn(el, "deleteAccount")
      .mockResolvedValue(undefined as any);
    const defaultSpy = jest
      .spyOn(el, "setDefaultAccount")
      .mockResolvedValue(undefined as any);

    const listEl = el.shadowRoot?.querySelector(
      '[data-region="account-list"]',
    ) as HTMLElement;

    // 1. edit-account
    listEl.dispatchEvent(
      new CustomEvent("settings-action", {
        detail: { action: "edit-account", id: "acc-1" },
        bubbles: true,
      }),
    );
    expect(showFormSpy).toHaveBeenCalledWith("acc-1");

    // 2. delete-account
    listEl.dispatchEvent(
      new CustomEvent("settings-action", {
        detail: { action: "delete-account", id: "acc-2" },
        bubbles: true,
      }),
    );
    expect(deleteSpy).toHaveBeenCalledWith("acc-2");

    // 3. set-default
    listEl.dispatchEvent(
      new CustomEvent("settings-action", {
        detail: { action: "set-default", id: "acc-3" },
        bubbles: true,
      }),
    );
    expect(defaultSpy).toHaveBeenCalledWith("acc-3");

    // 4. Missing id or null detail
    listEl.dispatchEvent(
      new CustomEvent("settings-action", {
        detail: { action: "set-default", id: "" },
        bubbles: true,
      }),
    );
    listEl.dispatchEvent(
      new CustomEvent("settings-action", { detail: null, bubbles: true }),
    );

    document.body.removeChild(el);
  });

  it("renders account list badges for OAuth and reauth states", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));

    el.defaultAccountId = "acc-reauth";
    el.accounts = [
      {
        id: "acc-reauth",
        label: "Reauth Account",
        service: "github",
        hostPattern: "api.github.com",
        token: "tok",
        authMode: "oauth",
        oauthProviderId: "github",
        oauthReauthRequired: true,
      },
      {
        id: "acc-no-prov",
        label: "No Provider",
        service: "generic",
        hostPattern: "generic.com",
        token: "tok",
        authMode: "oauth",
        oauthProviderId: "",
      },
    ] as any;

    el.renderAccountList();

    const listEl = el.shadowRoot?.querySelector(
      '[data-region="account-list"]',
    ) as HTMLElement;
    const cards = listEl.querySelectorAll("shadow-claw-card");
    expect(cards).toHaveLength(2);

    expect(cards[0].getAttribute("meta")).toContain("Reconnect required");
    expect(cards[0].hasAttribute("highlight")).toBe(true);

    expect(cards[1].getAttribute("meta")).toContain("OAuth");

    document.body.removeChild(el);
  });

  it("handles showAccountForm placeholders and auth fields visibility toggling", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    el.accounts = [
      {
        id: "acc-custom-pkce",
        label: "Custom PKCE",
        service: "mcp",
        hostPattern: "mcp.local",
        authMode: "oauth",
        oauthProviderId: "custom_mcp",
        token: "basic-tok",
        basicUsername: "admin",
        oauthCustomUsePkce: false,
        oauthClientSecret: "sec",
        oauthReauthRequired: true,
      },
      {
        id: "acc-oauth-saved",
        label: "OAuth Saved",
        service: "gh",
        hostPattern: "github.com",
        authMode: "oauth",
        token: "saved-tok",
        oauthReauthRequired: false,
      },
    ] as any;

    // 1. Basic auth with PKCE false
    el.showAccountForm("acc-custom-pkce");
    const slot = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;
    expect(slot.innerHTML).toContain("Reconnect required");
    expect(slot.innerHTML).toContain("•••••••••••• (Saved)");

    // 2. Saved token text
    el.showAccountForm("acc-oauth-saved");
    expect(slot.innerHTML).toContain("OAuth token already saved");

    // 3. Toggle auth mode to basic
    const authModeSelect = slot.querySelector(
      '[data-field="acct-auth-mode"]',
    ) as HTMLSelectElement;
    const patLabel = slot.querySelector(
      '[data-region="pat-label"]',
    ) as HTMLElement;
    const basicUsernameRegion = slot.querySelector(
      '[data-region="basic-username-field"]',
    ) as HTMLElement;
    const customFields = slot.querySelector(
      '[data-region="custom-mcp-oauth-fields"]',
    ) as HTMLElement;

    authModeSelect.value = "basic";
    authModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(patLabel.textContent).toBe("Password / API Token");
    expect(basicUsernameRegion.style.display).toBe("block");

    // 4. Toggle OAuth provider to custom_mcp
    authModeSelect.value = "oauth";
    authModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    const providerSelect = slot.querySelector(
      '[data-field="acct-oauth-provider"]',
    ) as HTMLSelectElement;
    providerSelect.value = "custom_mcp";
    providerSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(customFields.style.display).toBe("block");

    document.body.removeChild(el);
  });

  it("handles connectOAuthFromForm validation, Custom MCP, errors, and success", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    el.showAccountForm("new");
    const slot = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;
    const providerSelect = slot.querySelector(
      '[data-field="acct-oauth-provider"]',
    ) as HTMLSelectElement;
    const clientIdInput = slot.querySelector(
      '[data-field="acct-oauth-client-id"]',
    ) as HTMLInputElement;

    // 1. Missing provider
    providerSelect.value = "";
    clientIdInput.value = "client-1";
    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith("OAuth provider is required.", 4000);

    // 2. Missing client ID
    providerSelect.value = "github";
    clientIdInput.value = "";
    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      "OAuth client ID is required.",
      4000,
    );

    // 3. Custom MCP flow
    providerSelect.value = "custom_mcp";
    clientIdInput.value = "mcp-client";
    const authUrlInput = slot.querySelector(
      '[data-field="acct-oauth-auth-url"]',
    ) as HTMLInputElement;
    const tokenUrlInput = slot.querySelector(
      '[data-field="acct-oauth-token-url"]',
    ) as HTMLInputElement;
    if (authUrlInput) authUrlInput.value = "https://mcp.auth/authorize";
    if (tokenUrlInput) tokenUrlInput.value = "https://mcp.auth/token";

    const originalFetch = globalThis.fetch;
    const originalOpen = window.open;
    window.open = jest.fn() as any;

    // Authorize failure
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Custom MCP Auth Fail" }),
    });
    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Custom MCP Auth Fail"),
      6000,
    );

    // Session status error
    globalThis.fetch = jest
      .fn<any>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: "mcp-state",
          authorizeUrl: "https://mcp.auth/authorize",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "error", error: "User rejected MCP" }),
      });
    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("User rejected MCP"),
      6000,
    );

    // Success flow
    globalThis.fetch = jest
      .fn<any>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: "mcp-state",
          authorizeUrl: "https://mcp.auth/authorize",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "authorized" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: "mcp-access-token",
          refreshToken: "mcp-refresh-token",
          expiresIn: 7200,
          scope: "all",
        }),
      });

    await el.connectOAuthFromForm(slot);
    expect(showSuccess).toHaveBeenCalledWith("OAuth connected", 3000);
    expect(el.pendingOauthResult?.accessToken).toBe("mcp-access-token");

    window.open = originalOpen;
    globalThis.fetch = originalFetch;
    document.body.removeChild(el);
  });

  it("handles saveAccountForm OAuth branches, basic auth, existing update, and null guards", async () => {
    const el = new ShadowClawAccounts();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();
    el.db = {} as any;
    el.accounts = [];

    el.showAccountForm("new");
    const slot = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;

    const labelInput = slot.querySelector(
      '[data-field="acct-label"]',
    ) as HTMLInputElement;
    const serviceInput = slot.querySelector(
      '[data-field="acct-service"]',
    ) as HTMLInputElement;
    const hostInput = slot.querySelector(
      '[data-field="acct-host"]',
    ) as HTMLInputElement;
    const authModeSelect = slot.querySelector(
      '[data-field="acct-auth-mode"]',
    ) as HTMLSelectElement;
    const providerSelect = slot.querySelector(
      '[data-field="acct-oauth-provider"]',
    ) as HTMLSelectElement;
    const clientIdInput = slot.querySelector(
      '[data-field="acct-oauth-client-id"]',
    ) as HTMLInputElement;

    labelInput.value = "My MCP Service";
    serviceInput.value = "custom_mcp";
    hostInput.value = "mcp.local";
    authModeSelect.value = "oauth";
    providerSelect.value = "custom_mcp";
    clientIdInput.value = "mcp-client-id";

    // 1. Missing token in OAuth mode
    el.pendingOauthResult = null;
    await el.saveAccountForm();
    expect(showError).toHaveBeenCalledWith(
      "Connect OAuth first to obtain an access token for this account.",
      5000,
    );

    // 2. Save with pending OAuth result
    el.pendingOauthResult = {
      providerId: "custom_mcp",
      accessToken: "access-token-custom",
      refreshToken: "refresh-token-custom",
      expiresAt: Date.now() + 3600000,
      scope: "read write",
      tokenType: "Bearer",
    };
    await el.saveAccountForm();
    expect(el.accounts).toHaveLength(1);
    expect(el.accounts[0].authMode).toBe("oauth");
    expect(el.defaultAccountId).toBe(el.accounts[0].id);

    // 3. Update existing account with Basic Auth mode
    el.showAccountForm(el.accounts[0].id);
    (
      slot.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    ).value = "basic";
    (
      slot.querySelector(
        '[data-field="acct-basic-username"]',
      ) as HTMLInputElement
    ).value = "admin-user";
    (
      slot.querySelector('[data-field="acct-token"]') as HTMLInputElement
    ).value = "secret-pat";
    await el.saveAccountForm();
    expect(el.accounts[0].authMode).toBe("basic");
    expect(el.accounts[0].basicUsername).toBe("admin-user");

    // 4. deleteAccount picking remaining account as default
    el.accounts = [
      { id: "a1", label: "A1" } as any,
      { id: "a2", label: "A2" } as any,
    ];
    el.defaultAccountId = "a1";
    await el.deleteAccount("a1");
    expect(el.defaultAccountId).toBe("a2");

    // 5. null db guards
    el.db = null;
    await el.deleteAccount("a2");
    await el.saveAccountForm();
    await el.setDefaultAccount("a2");

    // 6. null shadowRoot guards
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.hideAccountForm();
    el.renderAccountList();
    el.showAccountForm("new");
    el.updateAuthModeVisibility(document.createElement("div"));
    await el.saveAccountForm();

    document.body.removeChild(el);
  });
});
