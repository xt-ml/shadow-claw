import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../config/config.js", () => ({
  CONFIG_KEYS: {
    GIT_AUTHOR_NAME: "git_author_name",
    GIT_AUTHOR_EMAIL: "git_author_email",
    GIT_CORS_PROXY: "git_cors_proxy",
    GIT_ACCOUNTS: "git_accounts",
    GIT_DEFAULT_ACCOUNT: "git_default_account",
    GIT_TOKEN: "git_token",
    GIT_USERNAME: "git_username",
    GIT_PASSWORD: "git_password",
  },
  getProviderTokenAuthScheme: (
    providerId: string,
    authMode: string,
    serviceType = "http_api",
  ) => {
    const schemes: Record<string, any> = {
      github: {
        default: {
          pat: { headerName: "Authorization", headerPrefix: "token " },
          oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
        },
      },
      gitlab: {
        default: {
          pat: { headerName: "PRIVATE-TOKEN", headerPrefix: "" },
          oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
        },
        byServiceType: {
          git_remote: {
            pat: { headerName: "Authorization", headerPrefix: "Bearer " },
            oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
          },
        },
      },
      azure_devops: {
        default: {
          pat: { headerName: "Authorization", headerPrefix: "Bearer " },
          oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
        },
        byServiceType: {
          git_remote: {
            pat: { headerName: "Authorization", headerPrefix: "Basic " },
            oauth: { headerName: "Authorization", headerPrefix: "Basic " },
          },
        },
      },
    };

    const provider = schemes[providerId];
    if (!provider) {
      return null;
    }

    return (
      provider.byServiceType?.[serviceType]?.[authMode] ||
      provider.default?.[authMode] ||
      null
    );
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
    gitlab: {
      id: "gitlab",
      name: "GitLab",
      authorizeUrl: "https://gitlab.com/oauth/authorize",
      tokenUrl: "https://gitlab.com/oauth/token",
      defaultScopes: ["read_api", "read_user"],
      usePkce: true,
    },
    azure_devops: {
      id: "azure_devops",
      name: "Azure DevOps",
      authorizeUrl: "https://app.vssps.visualstudio.com/oauth2/authorize",
      tokenUrl: "https://app.vssps.visualstudio.com/oauth2/token",
      defaultScopes: ["vso.code"],
      usePkce: false,
    },
  },
}));

jest.unstable_mockModule("../../../db/set-config.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../db/get-config.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../security/crypto.js", () => ({
  decryptValue: jest.fn<any>().mockResolvedValue("decrypted-token"),
  encryptValue: jest.fn<any>().mockResolvedValue("encrypted-token"),
}));

jest.unstable_mockModule("../../../utils/ulid.js", () => ({
  ulid: jest.fn(() => "git-acct-1"),
}));

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    gitProxyUrl: "/git-proxy",
    setGitProxyUrl: jest.fn(),
  },
}));

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
}));

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({
    transaction: jest.fn(() => ({
      objectStore: jest.fn(() => ({
        get: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
        put: jest.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      })),
    })),
  }),
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
const { showError } = await import("../../../ui/toast.js");
const { setSanitizedHtml } = await import("../../../security/trusted-types.js");
const { ShadowClawGit } = await import("./shadow-claw-git.js");
const { showSuccess } = await import("../../../ui/toast.js");

describe("shadow-claw-git", () => {
  jest.setTimeout(30000);
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-git")).toBe(ShadowClawGit);
  });

  it("renders correctly after connectedCallback", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    expect(
      el.shadowRoot?.querySelector('[data-setting="git-author-name-input"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-setting="git-author-email-input"]'),
    ).not.toBeNull();

    document.body.removeChild(el);
  });

  it("saves global git settings on button click", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const nameInput = el.shadowRoot?.querySelector(
      '[data-setting="git-author-name-input"]',
    ) as HTMLInputElement;
    if (nameInput) {
      nameInput.value = "Test User";
    }

    const btn = el.shadowRoot?.querySelector(
      '[data-action="save-git-settings"]',
    );
    btn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));

    expect(setConfig).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith("Git settings saved", 3000);

    document.body.removeChild(el);
  });

  it("opens account form when Add Account is clicked", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const addBtn = el.shadowRoot?.querySelector('[data-action="add-account"]');
    addBtn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 0));

    const form = el.shadowRoot?.querySelector(".account-form");
    expect(form).not.toBeNull();

    document.body.removeChild(el);
  });

  it("connects OAuth and persists Git OAuth account fields", async () => {
    const openSpy = jest.spyOn(window, "open").mockReturnValue(null as any);
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
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
            json: async () => ({ status: "authorized" }),
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
    (root.querySelector('[data-field="acct-host"]') as HTMLInputElement).value =
      "github.com";
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
      expect.anything(),
      "git_accounts",
      expect.arrayContaining([
        expect.objectContaining({
          authMode: "oauth",
          oauthProviderId: "github",
          oauthClientId: "client-123",
          oauthClientSecret: "encrypted-token",
          token: "encrypted-token",
          refreshToken: "encrypted-token",
        }),
      ]),
    );
    expect(openSpy).toHaveBeenCalled();

    fetchMock.mockClear();
    openSpy.mockRestore();
    document.body.removeChild(el);
  });

  it("defaults legacy Git OAuth account edit form to OAuth mode", async () => {
    (getConfig as jest.Mock).mockImplementation((_db, key) => {
      if (key === "git_accounts") {
        return Promise.resolve([
          {
            id: "git-oauth-legacy",
            label: "GitHub OAuth Legacy",
            hostPattern: "github.com",
            token: "encrypted-token",
            username: "",
            password: "",
            authorName: "",
            authorEmail: "",
            oauthProviderId: "github",
            oauthClientId: "client-legacy",
          },
        ]);
      }

      if (key === "git_default_account") {
        return Promise.resolve("git-oauth-legacy");
      }

      return Promise.resolve(undefined);
    });

    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    el.showAccountForm("git-oauth-legacy");

    const modeSelect = el.shadowRoot?.querySelector(
      '[data-field="acct-auth-mode"]',
    ) as HTMLSelectElement;
    expect(modeSelect.value).toBe("oauth");

    document.body.removeChild(el);
  });

  it("routes showAccountForm innerHTML through the Trusted Types helper", async () => {
    const el = new ShadowClawGit();
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
      expect.stringContaining("Add Git Account"),
    );

    document.body.removeChild(el);
  });

  it("handles setDefaultAccount and deleteAccount", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    el.accounts = [
      {
        id: "acc-1",
        label: "Account 1",
        hostPattern: "github.com",
        authMode: "token",
      } as any,
      {
        id: "acc-2",
        label: "Account 2",
        hostPattern: "gitlab.com",
        authMode: "token",
      } as any,
    ];
    el.defaultAccountId = "acc-1";

    await el.setDefaultAccount("acc-2");
    expect(el.defaultAccountId).toBe("acc-2");

    await el.deleteAccount("acc-1");
    expect(el.accounts.find((a) => a.id === "acc-1")).toBeUndefined();
    expect(el.defaultAccountId).toBe("acc-2");

    document.body.removeChild(el);
  });

  it("handles saveGitSettings with custom proxy and author info", async () => {
    const { setConfig } = await import("../../../db/set-config.js");
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();
    el.db = {} as any;

    const customRadio = el.shadowRoot?.querySelector(
      '[data-setting="git-proxy-custom"]',
    ) as HTMLInputElement;
    if (customRadio) customRadio.checked = true;

    const authorNameInput = el.shadowRoot?.querySelector(
      '[data-setting="git-author-name-input"]',
    ) as HTMLInputElement;
    if (authorNameInput) authorNameInput.value = "Custom Author";

    const authorEmailInput = el.shadowRoot?.querySelector(
      '[data-setting="git-author-email-input"]',
    ) as HTMLInputElement;
    if (authorEmailInput) authorEmailInput.value = "author@example.com";

    await el.saveGitSettings();

    expect(setConfig).toHaveBeenCalledWith(el.db, "git_cors_proxy", "custom");
    expect(setConfig).toHaveBeenCalledWith(
      el.db,
      "git_author_name",
      "Custom Author",
    );
    expect(setConfig).toHaveBeenCalledWith(
      el.db,
      "git_author_email",
      "author@example.com",
    );

    document.body.removeChild(el);
  });

  it("handles saveAccountForm validation, edit existing account, and oauth missing token", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();
    el.db = {} as any;

    // 1. Missing label and hostPattern
    el.showAccountForm("new");
    const slot = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;
    expect(slot).toBeDefined();

    const labelInput = slot.querySelector(
      '[data-field="acct-label"]',
    ) as HTMLInputElement;
    const hostInput = slot.querySelector(
      '[data-field="acct-host"]',
    ) as HTMLInputElement;
    const authModeSelect = slot.querySelector(
      '[data-field="acct-auth-mode"]',
    ) as HTMLSelectElement;

    labelInput.value = "";
    hostInput.value = "";
    await el.saveAccountForm();

    // 2. OAuth mode with no token
    labelInput.value = "OAuth Acc";
    hostInput.value = "github.com";
    authModeSelect.value = "oauth";
    await el.saveAccountForm();

    el.accounts = [
      {
        id: "acc-edit",
        label: "Old Label",
        hostPattern: "github.com",
        authMode: "token",
        token: "old-token",
      } as any,
    ];
    el.showAccountForm("acc-edit");

    const editLabelInput = slot.querySelector(
      '[data-field="acct-label"]',
    ) as HTMLInputElement;
    const editHostInput = slot.querySelector(
      '[data-field="acct-host"]',
    ) as HTMLInputElement;
    const editAuthModeSelect = slot.querySelector(
      '[data-field="acct-auth-mode"]',
    ) as HTMLSelectElement;
    const editTokenInput = slot.querySelector(
      '[data-field="acct-token"]',
    ) as HTMLInputElement;
    const editPassInput = slot.querySelector(
      '[data-field="acct-password"]',
    ) as HTMLInputElement;
    const editUserInput = slot.querySelector(
      '[data-field="acct-username"]',
    ) as HTMLInputElement;

    editLabelInput.value = "New Label";
    editHostInput.value = "github.com/org";
    editAuthModeSelect.value = "token";
    editTokenInput.value = "new-token-raw";
    editPassInput.value = "new-pass-raw";
    editUserInput.value = "new-user";

    await el.saveAccountForm();

    const edited = el.accounts.find((a) => a.id === "acc-edit");
    expect(edited).toBeDefined();
    expect(edited?.label).toBe("New Label");
    expect(edited?.hostPattern).toBe("github.com/org");
    expect(edited?.username).toBe("new-user");

    document.body.removeChild(el);
  });

  it("migrates legacy account configuration when accounts list is empty", async () => {
    const { getConfig } = await import("../../../db/get-config.js");
    const { setConfig } = await import("../../../db/set-config.js");

    (getConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "git_token") return "legacy-enc-token";
      if (key === "git_username") return "legacy-user";
      if (key === "git_password") return "legacy-enc-pass";
      return undefined;
    });

    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    el.db = {} as any;
    el.accounts = [];

    await el.migrateLegacyAccount();

    expect(el.accounts).toHaveLength(1);
    expect(el.accounts[0].token).toBe("legacy-enc-token");
    expect(el.accounts[0].username).toBe("legacy-user");
    expect(el.defaultAccountId).toBe("legacy-migrated");
    expect(setConfig).toHaveBeenCalledWith(el.db, "git_accounts", el.accounts);

    document.body.removeChild(el);
  });

  it("handles deleteAccount when removing the only account", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    el.db = {} as any;
    el.accounts = [
      { id: "single-acc", label: "Single", hostPattern: "gh.com" } as any,
    ];
    el.defaultAccountId = "single-acc";

    await el.deleteAccount("single-acc");
    expect(el.accounts).toHaveLength(0);
    expect(el.defaultAccountId).toBe("");

    document.body.removeChild(el);
  });

  it("handles settings-action event routing on account list", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
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

    // 4. missing id or invalid detail
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

  it("renders account list badges for different credentials and auth modes", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));

    el.defaultAccountId = "acc-oauth-reauth";
    el.accounts = [
      {
        id: "acc-oauth-reauth",
        label: "Reauth Acct",
        hostPattern: "github.com",
        token: "enc-tok",
        authMode: "oauth",
        oauthReauthRequired: true,
      },
      {
        id: "acc-oauth-ok",
        label: "OK Acct",
        hostPattern: "gitlab.com",
        token: "enc-tok",
        authMode: "oauth",
        oauthProviderId: "gitlab",
      },
      {
        id: "acc-user-only",
        label: "User Acct",
        hostPattern: "bitbucket.org",
        username: "developer",
      },
      {
        id: "acc-none",
        label: "Empty Acct",
        hostPattern: "unknown.org",
      },
    ] as any;

    el.renderAccountList();

    const listEl = el.shadowRoot?.querySelector(
      '[data-region="account-list"]',
    ) as HTMLElement;
    const cards = listEl.querySelectorAll("shadow-claw-card");
    expect(cards).toHaveLength(4);

    expect(cards[0].getAttribute("meta")).toContain("Reconnect required");
    expect(cards[0].hasAttribute("highlight")).toBe(true);

    expect(cards[1].getAttribute("meta")).toContain(
      "OAuth token saved (gitlab)",
    );

    expect(cards[2].getAttribute("meta")).toContain("Username: developer");

    expect(cards[3].getAttribute("meta")).toContain("No credentials");

    document.body.removeChild(el);
  });

  it("handles host pattern input for provider auto-detection", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));

    el.accounts = [
      { id: "acc-azure", hostPattern: "dev.azure.com", label: "Azure" } as any,
      { id: "acc-gitlab", hostPattern: "gitlab.com", label: "GitLab" } as any,
    ];

    // azure devops auto-detection
    el.showAccountForm("acc-azure");
    const slot1 = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;
    const providerSelect1 = slot1.querySelector(
      '[data-field="acct-oauth-provider"]',
    ) as HTMLSelectElement;
    expect(providerSelect1.value).toBe("azure_devops");

    // gitlab auto-detection
    el.showAccountForm("acc-gitlab");
    const slot2 = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;
    const providerSelect2 = slot2.querySelector(
      '[data-field="acct-oauth-provider"]',
    ) as HTMLSelectElement;
    expect(providerSelect2.value).toBe("gitlab");

    document.body.removeChild(el);
  });

  it("handles connectOAuthFromForm validation, errors, and success", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const { showError, showSuccess } = await import("../../../ui/toast.js");

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

    clientIdInput.value = "valid-client-id";

    const originalFetch = globalThis.fetch;
    const originalOpen = window.open;
    window.open = jest.fn() as any;

    // 3. Authorize fails
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "App not found" }),
    });
    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("App not found"),
      6000,
    );

    // 4. Session polling returns error
    globalThis.fetch = jest
      .fn<any>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: "state-git-1",
          authorizeUrl: "https://auth.git",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "error", error: "Access denied by user" }),
      });
    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Access denied by user"),
      6000,
    );

    // 5. Successful flow
    globalThis.fetch = jest
      .fn<any>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: "state-git-1",
          authorizeUrl: "https://auth.git",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "authorized" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: "git-token-xyz",
          refreshToken: "git-refresh-abc",
          expiresIn: 3600,
          scope: "repo read:user",
        }),
      });
    await el.connectOAuthFromForm(slot);
    expect(showSuccess).toHaveBeenCalledWith("OAuth connected", 3000);
    expect(el.pendingOauthResult?.accessToken).toBe("git-token-xyz");

    window.open = originalOpen;
    globalThis.fetch = originalFetch;
    document.body.removeChild(el);
  });

  it("handles saveAccountForm OAuth validation, single account default, and error handling", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    el.db = {} as any;
    el.accounts = [];

    const { showError } = await import("../../../ui/toast.js");

    el.showAccountForm("new");
    const slot = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;

    const labelInput = slot.querySelector(
      '[data-field="acct-label"]',
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

    labelInput.value = "My GitHub";
    hostInput.value = "github.com";
    authModeSelect.value = "oauth";

    // 1. Missing provider in OAuth mode
    providerSelect.value = "";
    await el.saveAccountForm();
    expect(showError).toHaveBeenCalledWith(
      "OAuth provider is required for OAuth mode.",
      4000,
    );

    // 2. Missing client ID in OAuth mode
    providerSelect.value = "github";
    clientIdInput.value = "";
    await el.saveAccountForm();
    expect(showError).toHaveBeenCalledWith(
      "OAuth client ID is required for OAuth mode.",
      4000,
    );

    // 3. Missing token in OAuth mode
    clientIdInput.value = "client-123";
    el.pendingOauthResult = null;
    await el.saveAccountForm();
    expect(showError).toHaveBeenCalledWith(
      "Connect OAuth first to obtain an access token for this account.",
      5000,
    );

    // 4. Valid OAuth save with pending result
    el.pendingOauthResult = {
      providerId: "github",
      accessToken: "access-token-999",
      refreshToken: "refresh-token-888",
      expiresAt: Date.now() + 3600000,
      scope: "repo",
      tokenType: "Bearer",
    };

    await el.saveAccountForm();
    expect(el.accounts).toHaveLength(1);
    expect(el.accounts[0].authMode).toBe("oauth");
    expect(el.defaultAccountId).toBe(el.accounts[0].id);

    // 5. Updating an existing account with OAuth secret and configured scopes
    el.showAccountForm(el.accounts[0].id);
    const secretInput = slot.querySelector(
      '[data-field="acct-oauth-client-secret"]',
    ) as HTMLInputElement;
    const scopeInput = slot.querySelector(
      '[data-field="acct-oauth-scope"]',
    ) as HTMLInputElement;
    secretInput.value = "new-client-secret";
    scopeInput.value = "read:user write:repo";

    el.pendingOauthResult = {
      providerId: "github",
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresAt: Date.now() + 3600000,
      scope: "", // empty so it falls back to configuredScopes
      tokenType: "Bearer",
    };

    await el.saveAccountForm();
    expect(el.accounts[0].scopes).toEqual(["read:user", "write:repo"]);

    // 6. Error handling in saveAccountForm
    const { encryptValue } = await import("../../../security/crypto.js");
    (encryptValue as jest.Mock).mockRejectedValueOnce(
      new Error("Encrypt failure"),
    );
    el.showAccountForm("new");
    (
      slot.querySelector('[data-field="acct-label"]') as HTMLInputElement
    ).value = "Crash Account";
    (slot.querySelector('[data-field="acct-host"]') as HTMLInputElement).value =
      "crash.com";
    (
      slot.querySelector('[data-field="acct-token"]') as HTMLInputElement
    ).value = "crash-token";
    await el.saveAccountForm();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Error saving account: Encrypt failure"),
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles showAccountForm placeholders and auth fields visibility toggling", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));

    el.accounts = [
      {
        id: "acc-rich",
        label: "Rich Account",
        hostPattern: "github.com",
        authMode: "oauth",
        token: "tok-1",
        oauthClientSecret: "encrypted-secret",
        password: "encrypted-password",
        oauthReauthRequired: true,
      },
      {
        id: "acc-saved-tok",
        label: "Saved Tok",
        hostPattern: "github.com",
        authMode: "oauth",
        token: "tok-2",
        oauthReauthRequired: false,
      },
    ] as any;

    // Rich account form placeholders
    el.showAccountForm("acc-rich");
    const slot = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;
    expect(slot.innerHTML).toContain("Reconnect required");
    expect(slot.innerHTML).toContain("•••••••••••• (Saved)");

    // Saved token account form
    el.showAccountForm("acc-saved-tok");
    expect(slot.innerHTML).toContain("OAuth token already saved");

    // Toggle auth mode visibility
    const authModeSelect = slot.querySelector(
      '[data-field="acct-auth-mode"]',
    ) as HTMLSelectElement;
    const oauthRegion = slot.querySelector(
      '[data-region="oauth-fields"]',
    ) as HTMLElement;
    const patRegion = slot.querySelector(
      '[data-region="pat-fields"]',
    ) as HTMLElement;

    authModeSelect.value = "token";
    authModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(patRegion.style.display).toBe("block");
    expect(oauthRegion.style.display).toBe("none");

    authModeSelect.value = "oauth";
    authModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(patRegion.style.display).toBe("none");
    expect(oauthRegion.style.display).toBe("block");

    // Toggle custom proxy fields visibility
    const root = el.shadowRoot!;
    const customRadio = root.querySelector(
      '[data-setting="git-proxy-custom"]',
    ) as HTMLInputElement;
    const localRadio = root.querySelector(
      '[data-setting="git-proxy-local"]',
    ) as HTMLInputElement;
    const customField = root.querySelector(
      '[data-region="git-custom-proxy-field"]',
    ) as HTMLElement;

    customRadio.checked = true;
    customRadio.dispatchEvent(new Event("change", { bubbles: true }));
    expect(customField.style.display).toBe("block");

    localRadio.checked = true;
    customRadio.checked = false;
    localRadio.dispatchEvent(new Event("change", { bubbles: true }));
    expect(customField.style.display).toBe("none");

    document.body.removeChild(el);
  });

  it("handles saveGitSettings fallback defaults and error handling", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    el.db = {} as any;

    const { setConfig } = await import("../../../db/set-config.js");
    const { showError } = await import("../../../ui/toast.js");

    const root = el.shadowRoot!;
    const nameInput = root.querySelector(
      '[data-setting="git-author-name-input"]',
    ) as HTMLInputElement;
    const emailInput = root.querySelector(
      '[data-setting="git-author-email-input"]',
    ) as HTMLInputElement;

    // Empty name and email fallback to defaults
    nameInput.value = "";
    emailInput.value = "";
    await el.saveGitSettings();
    expect(setConfig).toHaveBeenCalledWith(
      el.db,
      "git_author_name",
      "ShadowClaw",
    );
    expect(setConfig).toHaveBeenCalledWith(
      el.db,
      "git_author_email",
      "agent@example.com",
    );

    // setConfig throwing error
    (setConfig as jest.Mock).mockRejectedValueOnce(
      new Error("Config DB crash"),
    );
    await el.saveGitSettings();
    expect(showError).toHaveBeenCalledWith(
      "Error saving Git settings: Config DB crash",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles saveGitSettings proxy modes, author settings, and updateGitWarning", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    el.db = {} as any;

    const { setConfig } = await import("../../../db/set-config.js");
    const { orchestratorStore } =
      await import("../../../stores/orchestrator.js");

    const root = el.shadowRoot!;
    const customRadio = root.querySelector(
      '[data-setting="git-proxy-custom"]',
    ) as HTMLInputElement;
    const publicRadio = root.querySelector(
      '[data-setting="git-proxy-public"]',
    ) as HTMLInputElement;
    const localRadio = root.querySelector(
      '[data-setting="git-proxy-local"]',
    ) as HTMLInputElement;
    const customUrlInput = root.querySelector(
      '[data-setting="git-proxy-url-input"]',
    ) as HTMLInputElement;
    const nameInput = root.querySelector(
      '[data-setting="git-author-name-input"]',
    ) as HTMLInputElement;
    const emailInput = root.querySelector(
      '[data-setting="git-author-email-input"]',
    ) as HTMLInputElement;

    // 1. Custom proxy mode
    customRadio.checked = true;
    publicRadio.checked = false;
    localRadio.checked = false;
    customUrlInput.value = "https://my-proxy.com";
    nameInput.value = "Custom Dev";
    emailInput.value = "dev@custom.com";

    await el.saveGitSettings();
    expect(setConfig).toHaveBeenCalledWith(el.db, "git_cors_proxy", "custom");
    expect(orchestratorStore.setGitProxyUrl).toHaveBeenCalledWith(
      el.db,
      "https://my-proxy.com",
    );
    expect(setConfig).toHaveBeenCalledWith(
      el.db,
      "git_author_name",
      "Custom Dev",
    );
    expect(setConfig).toHaveBeenCalledWith(
      el.db,
      "git_author_email",
      "dev@custom.com",
    );

    // 2. Local proxy mode
    localRadio.checked = true;
    customRadio.checked = false;
    publicRadio.checked = false;
    await el.saveGitSettings();
    expect(setConfig).toHaveBeenCalledWith(el.db, "git_cors_proxy", "local");

    // 3. updateGitWarning when publicRadio is checked with accounts having tokens
    el.accounts = [{ id: "a1", token: "tok" } as any];
    publicRadio.checked = true;
    await el.updateGitWarning();
    const warningEl = root.querySelector(
      '[data-setting="git-proxy-warning"]',
    ) as HTMLElement;
    expect(warningEl.style.display).toBe("block");

    // Public unchecked
    publicRadio.checked = false;
    await el.updateGitWarning();
    expect(warningEl.style.display).toBe("none");

    document.body.removeChild(el);
  });

  it("handles null db guards and setDefaultAccount error catch", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // null db guards
    el.db = null;
    await el.deleteAccount("acc-1");
    await el.migrateLegacyAccount();
    await el.saveAccountForm();
    await el.saveGitSettings();
    await el.setDefaultAccount("acc-1");

    // setDefaultAccount error handling
    el.db = {} as any;
    const { setConfig } = await import("../../../db/set-config.js");
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    (setConfig as jest.Mock).mockRejectedValueOnce(
      new Error("Set default error"),
    );
    await el.setDefaultAccount("acc-1");
    expect(warnSpy).toHaveBeenCalledWith(
      "Error setting default account:",
      expect.any(Error),
    );
    warnSpy.mockRestore();

    document.body.removeChild(el);
  });

  it("handles connectOAuthFromForm timeout and custom proxy URL fallback", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    el.db = {} as any;

    const { showError } = await import("../../../ui/toast.js");

    el.showAccountForm("new");
    const slot = el.shadowRoot?.querySelector(
      '[data-region="account-form-slot"]',
    ) as HTMLElement;
    (
      slot.querySelector(
        '[data-field="acct-oauth-provider"]',
      ) as HTMLSelectElement
    ).value = "github";
    (
      slot.querySelector(
        '[data-field="acct-oauth-client-id"]',
      ) as HTMLInputElement
    ).value = "client-id";
    (
      slot.querySelector('[data-field="acct-oauth-scope"]') as HTMLInputElement
    ).value = "repo, user";

    const originalFetch = globalThis.fetch;
    const originalOpen = window.open;
    window.open = jest.fn() as any;

    // Mock setTimeout so loop runs synchronously and terminates after 60 iterations
    globalThis.fetch = jest
      .fn<any>()
      .mockImplementation(async (url: string) => {
        if (url.includes("/oauth/authorize")) {
          return {
            ok: true,
            json: async () => ({
              state: "s-timeout",
              authorizeUrl: "http://example.com",
            }),
          };
        }
        if (url.includes("/oauth/session")) {
          return {
            ok: true,
            json: async () => ({ status: "pending" }),
          };
        }
        return { ok: false };
      });

    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: any) => fn()) as any;

    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("OAuth authorization timed out"),
      6000,
    );

    globalThis.setTimeout = origSetTimeout;
    window.open = originalOpen;
    globalThis.fetch = originalFetch;

    // Custom proxy URL fallback when input is empty
    const root = el.shadowRoot!;
    const customRadio = root.querySelector(
      '[data-setting="git-proxy-custom"]',
    ) as HTMLInputElement;
    const customUrlInput = root.querySelector(
      '[data-setting="git-proxy-url-input"]',
    ) as HTMLInputElement;
    const { orchestratorStore } =
      await import("../../../stores/orchestrator.js");
    customRadio.checked = true;
    customUrlInput.value = "";
    await el.saveGitSettings();
    expect(orchestratorStore.setGitProxyUrl).toHaveBeenCalledWith(
      el.db,
      "/git-proxy",
    );

    document.body.removeChild(el);
  });

  it("handles OAuth account without providerId and null shadowRoot guards", async () => {
    const el = new ShadowClawGit();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Account with oauth but no oauthProviderId
    el.accounts = [
      {
        id: "acc-oauth-no-provider",
        label: "No Provider Acct",
        hostPattern: "custom.git",
        token: "enc-tok",
        authMode: "oauth",
        oauthProviderId: "",
      } as any,
    ];
    el.renderAccountList();
    const listEl = el.shadowRoot?.querySelector(
      '[data-region="account-list"]',
    ) as HTMLElement;
    const card = listEl.querySelector("shadow-claw-card");
    expect(card?.getAttribute("meta")).toBe("custom.git · OAuth token saved");

    // null shadowRoot guards
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.hideAccountForm();
    el.renderAccountList();
    el.showAccountForm("new");
    el.updateCustomProxyVisibility();
    await el.saveAccountForm();
    await el.saveGitSettings();
    await el.updateGitWarning();

    document.body.removeChild(el);
  });
});
