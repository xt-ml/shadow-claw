import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../config.js", () => ({
  CONFIG_KEYS: {
    GIT_AUTHOR_NAME: "git_author_name",
    GIT_AUTHOR_EMAIL: "git_author_email",
    GIT_CORS_PROXY: "git_cors_proxy",
    GIT_ACCOUNTS: "git_accounts",
    GIT_DEFAULT_ACCOUNT: "git_default_account",
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

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../crypto.js", () => ({
  decryptValue: jest.fn<any>().mockResolvedValue("decrypted-token"),
  encryptValue: jest.fn<any>().mockResolvedValue("encrypted-token"),
}));

jest.unstable_mockModule("../../../ulid.js", () => ({
  ulid: jest.fn(() => "git-acct-1"),
}));

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    gitProxyUrl: "/git-proxy",
    setGitProxyUrl: jest.fn(),
  },
}));

jest.unstable_mockModule("../../../toast.js", () => ({
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
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
}));

const { setConfig } = await import("../../../db/setConfig.js");
const { getConfig } = await import("../../../db/getConfig.js");
const { showError } = await import("../../../toast.js");
const { setSanitizedHtml } = await import("../../../security/trusted-types.js");
const { ShadowClawGit } = await import("./shadow-claw-git.js");
const { showSuccess } = await import("../../../toast.js");

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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
});
