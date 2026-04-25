import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: (jest.fn() as any).mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../crypto.js", () => ({
  decryptValue: jest.fn(async (v) => `decrypted:${v}`),
  encryptValue: jest.fn(async (v) => `encrypted:${v}`),
}));

jest.unstable_mockModule("../config.js", () => ({
  CONFIG_KEYS: {
    GIT_ACCOUNTS: "git_accounts",
    GIT_DEFAULT_ACCOUNT: "git_default_account",
    GIT_TOKEN: "git_token",
    GIT_USERNAME: "git_username",
    GIT_PASSWORD: "git_password",
    GIT_AUTHOR_NAME: "git_author_name",
    GIT_AUTHOR_EMAIL: "git_author_email",
  },
  getProviderTokenAuthScheme: (
    providerId,
    authMode,
    serviceType = "http_api",
  ) => {
    const schemes = {
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
}));

const { getConfig } = await import("../db/getConfig.js");
const { setConfig } = await import("../db/setConfig.js");
const { resolveGitCredentials, detectProvider, buildAuthHeaders } =
  await import("./credentials.js");

const mockGetConfig = getConfig as any;
const mockSetConfig = setConfig as any;
function setupConfig(map) {
  (mockGetConfig as any).mockImplementation(async (_db, key) => map[key]);
}

const fakeDb: any = {} as any;

describe("resolveGitCredentials", () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    mockSetConfig.mockReset();
    (mockGetConfig as any).mockResolvedValue(undefined);
  });

  it("returns empty creds when nothing is configured", async () => {
    const result = await resolveGitCredentials(fakeDb);
    expect(result).toEqual({
      token: undefined,
      username: undefined,
      password: undefined,
      authorName: undefined,
      authorEmail: undefined,
      provider: "generic",
      authMode: "pat",
    });
  });

  // ── Legacy single-account fallback ─────────────────────────────
  describe("legacy fallback (no accounts configured)", () => {
    it("returns decrypted token from legacy GIT_TOKEN", async () => {
      setupConfig({ git_token: "enc-tok" });
      const result = await resolveGitCredentials(fakeDb);
      expect(result.token).toBe("decrypted:enc-tok");
    });

    it("returns username and decrypted password from legacy keys", async () => {
      setupConfig({
        git_username: "alice",
        git_password: "enc-pw",
      });
      const result = await resolveGitCredentials(fakeDb);
      expect(result.username).toBe("alice");
      expect(result.password).toBe("decrypted:enc-pw");
    });

    it("returns author name and email from legacy keys", async () => {
      setupConfig({
        git_author_name: "Alice",
        git_author_email: "alice@example.com",
      });
      const result = await resolveGitCredentials(fakeDb);
      expect(result.authorName).toBe("Alice");
      expect(result.authorEmail).toBe("alice@example.com");
    });
  });

  // ── Multi-account with host pattern matching ───────────────────
  describe("multi-account resolution", () => {
    const githubAccount: any = {
      id: "acct-1",
      label: "GitHub",
      hostPattern: "github.com",
      token: "enc-gh-tok",
      username: "",
      password: "",
      authorName: "GH User",
      authorEmail: "gh@example.com",
    };

    const azureAccount: any = {
      id: "acct-2",
      label: "Azure DevOps",
      hostPattern: "dev.azure.com",
      token: "enc-az-tok",
      username: "azuser",
      password: "enc-az-pw",
      authorName: "AZ User",
      authorEmail: "az@example.com",
    };

    it("matches account by URL hostname", async () => {
      setupConfig({
        git_accounts: [githubAccount, azureAccount],
        git_default_account: "acct-1",
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://github.com/org/repo.git",
      );
      expect(result.token).toBe("decrypted:enc-gh-tok");
      expect(result.authorName).toBe("GH User");
      expect(result.authorEmail).toBe("gh@example.com");
    });

    it("matches Azure account by URL hostname", async () => {
      setupConfig({
        git_accounts: [githubAccount, azureAccount],
        git_default_account: "acct-1",
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://dev.azure.com/org/project/_git/repo",
      );
      expect(result.token).toBe("decrypted:enc-az-tok");
      expect(result.username).toBe("azuser");
      expect(result.password).toBe("decrypted:enc-az-pw");
      expect(result.authorName).toBe("AZ User");
    });

    it("falls back to default account when URL has no match", async () => {
      setupConfig({
        git_accounts: [githubAccount, azureAccount],
        git_default_account: "acct-2",
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://gitlab.com/org/repo.git",
      );
      // Should fall back to default (Azure, id=acct-2)
      expect(result.token).toBe("decrypted:enc-az-tok");
      expect(result.username).toBe("azuser");
    });

    it("falls back to default account when no URL is provided", async () => {
      setupConfig({
        git_accounts: [githubAccount, azureAccount],
        git_default_account: "acct-1",
      });

      const result = await resolveGitCredentials(fakeDb);
      expect(result.token).toBe("decrypted:enc-gh-tok");
      expect(result.authorName).toBe("GH User");
    });

    it("falls back to first account if no default is set", async () => {
      setupConfig({
        git_accounts: [githubAccount, azureAccount],
      });

      const result = await resolveGitCredentials(fakeDb);
      expect(result.token).toBe("decrypted:enc-gh-tok");
    });

    it("skips empty token and password fields", async () => {
      const noTokenAccount: any = {
        id: "acct-3",
        label: "No Token",
        hostPattern: "example.com",
        token: "",
        username: "user",
        password: "",
        authorName: "",
        authorEmail: "",
      };

      setupConfig({
        git_accounts: [noTokenAccount],
        git_default_account: "acct-3",
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://example.com/repo.git",
      );
      expect(result.token).toBeUndefined();
      expect(result.username).toBe("user");
      expect(result.password).toBeUndefined();
    });

    it("supports partial hostPattern matching (substring of hostname)", async () => {
      const account: any = {
        id: "acct-4",
        label: "Custom GitLab",
        hostPattern: "gitlab.mycompany.com",
        token: "enc-custom-tok",
        username: "",
        password: "",
        authorName: "",
        authorEmail: "",
      };

      setupConfig({
        git_accounts: [account],
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://gitlab.mycompany.com/group/project.git",
      );
      expect(result.token).toBe("decrypted:enc-custom-tok");
    });

    it("supports selecting an explicit git account id", async () => {
      const patAccount: any = {
        id: "acct-pat",
        label: "GitHub PAT",
        hostPattern: "github.com",
        token: "enc-pat-tok",
        username: "",
        password: "",
        authorName: "",
        authorEmail: "",
        authMode: "pat",
      };

      const oauthAccount: any = {
        id: "acct-oauth",
        label: "GitHub OAuth",
        hostPattern: "github.com",
        token: "enc-oauth-tok",
        username: "",
        password: "",
        authorName: "",
        authorEmail: "",
        authMode: "oauth",
      };

      setupConfig({
        git_accounts: [patAccount, oauthAccount],
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://github.com/org/repo.git",
        { accountId: "acct-oauth" },
      );

      expect(result.token).toBe("decrypted:enc-oauth-tok");
      expect(result.authMode).toBe("oauth");
      expect(result.accountId).toBe("acct-oauth");
    });

    it("prefers matching auth mode when host patterns tie", async () => {
      const patAccount: any = {
        id: "acct-pat",
        label: "GitHub PAT",
        hostPattern: "github.com",
        token: "enc-pat-tok",
        username: "",
        password: "",
        authorName: "",
        authorEmail: "",
        authMode: "pat",
      };

      const oauthAccount: any = {
        id: "acct-oauth",
        label: "GitHub OAuth",
        hostPattern: "github.com",
        token: "enc-oauth-tok",
        username: "",
        password: "",
        authorName: "",
        authorEmail: "",
        authMode: "oauth",
      };

      setupConfig({
        git_accounts: [patAccount, oauthAccount],
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://github.com/org/repo.git",
        { authMode: "oauth" },
      );

      expect(result.token).toBe("decrypted:enc-oauth-tok");
      expect(result.authMode).toBe("oauth");
      expect(result.accountId).toBe("acct-oauth");
    });

    it("refreshes expiring OAuth Git tokens before returning credentials", async () => {
      const oauthAccount: any = {
        id: "oauth-1",
        label: "GitHub OAuth",
        hostPattern: "github.com",
        token: "enc-old-access",
        username: "",
        password: "",
        authorName: "",
        authorEmail: "",
        authMode: "oauth",
        oauthProviderId: "github",
        oauthClientId: "client-123",
        refreshToken: "enc-refresh",
        accessTokenExpiresAt: Date.now() - 1_000,
        scopes: ["repo"],
      };

      setupConfig({
        git_accounts: [oauthAccount],
      });

      (global as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresIn: 3600,
          scope: "repo read:user",
          tokenType: "Bearer",
        }),
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://github.com/org/repo.git",
        { authMode: "oauth" },
      );

      expect(result.token).toBe("decrypted:encrypted:new-access-token");
      expect(result.authMode).toBe("oauth");
      expect(mockSetConfig).toHaveBeenCalledWith(
        fakeDb,
        "git_accounts",
        expect.arrayContaining([
          expect.objectContaining({
            id: "oauth-1",
            token: "encrypted:new-access-token",
            refreshToken: "encrypted:new-refresh-token",
          }),
        ]),
      );
    });

    it("forces Git OAuth refresh when forceRefresh option is true", async () => {
      const oauthAccount: any = {
        id: "oauth-2",
        label: "GitHub OAuth",
        hostPattern: "github.com",
        token: "enc-old-access",
        username: "",
        password: "",
        authorName: "",
        authorEmail: "",
        authMode: "oauth",
        oauthProviderId: "github",
        oauthClientId: "client-123",
        refreshToken: "enc-refresh",
        accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
        scopes: ["repo"],
      };

      setupConfig({
        git_accounts: [oauthAccount],
      });

      (global as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          accessToken: "forced-access-token",
          expiresIn: 1800,
        }),
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://github.com/org/repo.git",
        { authMode: "oauth", forceRefresh: true },
      );

      expect(result.token).toBe("decrypted:encrypted:forced-access-token");
      expect((global as any).fetch).toHaveBeenCalledWith(
        "/oauth/refresh",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("marks Git OAuth account as reauth-required after repeated refresh failures", async () => {
      const oauthAccount: any = {
        id: "oauth-3",
        label: "GitHub OAuth",
        hostPattern: "github.com",
        token: "enc-old-access",
        username: "",
        password: "",
        authorName: "",
        authorEmail: "",
        authMode: "oauth",
        oauthProviderId: "github",
        oauthClientId: "client-123",
        refreshToken: "enc-refresh",
        accessTokenExpiresAt: Date.now() - 1_000,
      };

      setupConfig({
        git_accounts: [oauthAccount],
      });

      (global as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid_grant" }),
      });

      await resolveGitCredentials(fakeDb, "https://github.com/org/repo.git", {
        authMode: "oauth",
      });
      await resolveGitCredentials(fakeDb, "https://github.com/org/repo.git", {
        authMode: "oauth",
      });
      const third = await resolveGitCredentials(
        fakeDb,
        "https://github.com/org/repo.git",
        {
          authMode: "oauth",
        },
      );

      expect(third.reauthRequired).toBe(true);
      expect(mockSetConfig).toHaveBeenLastCalledWith(
        fakeDb,
        "git_accounts",
        expect.arrayContaining([
          expect.objectContaining({
            id: "oauth-3",
            oauthRefreshFailureCount: 3,
            oauthReauthRequired: true,
          }),
        ]),
      );
    });

    // ── Path-based host patterns (e.g. Azure DevOps orgs) ─────────
    describe("path-based host patterns", () => {
      const exampleOrg2Account: any = {
        id: "acct-exampleOrg2",
        label: "Azure DevOps - Nexsys",
        hostPattern: "dev.azure.com/exampleOrg2",
        token: "enc-exampleOrg2-tok",
        username: "",
        password: "",
        authorName: "Nexsys Dev",
        authorEmail: "dev@exampleOrg2.example.com",
      };

      const exampleOrg1Account: any = {
        id: "acct-exampleOrg1",
        label: "Azure DevOps - ExampleOrg1",
        hostPattern: "dev.azure.com/exampleOrg1",
        token: "enc-exampleOrg1-tok",
        username: "",
        password: "",
        authorName: "ExampleOrg1 Dev",
        authorEmail: "dev@exampleOrg1.example.com",
      };

      it("matches account with host+path pattern against URL", async () => {
        setupConfig({
          git_accounts: [exampleOrg2Account, exampleOrg1Account],
        });

        const result = await resolveGitCredentials(
          fakeDb,
          "https://dev.azure.com/exampleOrg2/project/_git/repo",
        );
        expect(result.token).toBe("decrypted:enc-exampleOrg2-tok");
        expect(result.authorName).toBe("Nexsys Dev");
      });

      it("matches second account with different org path", async () => {
        setupConfig({
          git_accounts: [exampleOrg2Account, exampleOrg1Account],
        });

        const result = await resolveGitCredentials(
          fakeDb,
          "https://dev.azure.com/exampleOrg1/project/_git/repo",
        );
        expect(result.token).toBe("decrypted:enc-exampleOrg1-tok");
        expect(result.authorName).toBe("ExampleOrg1 Dev");
      });

      it("prefers more specific path pattern over domain-only pattern", async () => {
        const domainOnlyAccount: any = {
          id: "acct-az-generic",
          label: "Azure DevOps (generic)",
          hostPattern: "dev.azure.com",
          token: "enc-generic-tok",
          username: "",
          password: "",
          authorName: "",
          authorEmail: "",
        };

        setupConfig({
          git_accounts: [domainOnlyAccount, exampleOrg2Account],
        });

        const result = await resolveGitCredentials(
          fakeDb,
          "https://dev.azure.com/exampleOrg2/project/_git/repo",
        );
        // Should prefer the more specific path-based match
        expect(result.token).toBe("decrypted:enc-exampleOrg2-tok");
        expect(result.authorName).toBe("Nexsys Dev");
      });

      it("falls back to domain-only pattern when path does not match", async () => {
        const domainOnlyAccount: any = {
          id: "acct-az-generic",
          label: "Azure DevOps (generic)",
          hostPattern: "dev.azure.com",
          token: "enc-generic-tok",
          username: "",
          password: "",
          authorName: "",
          authorEmail: "",
        };

        setupConfig({
          git_accounts: [exampleOrg2Account, domainOnlyAccount],
        });

        const result = await resolveGitCredentials(
          fakeDb,
          "https://dev.azure.com/other-org/project/_git/repo",
        );
        expect(result.token).toBe("decrypted:enc-generic-tok");
      });

      it("detects azure-devops provider from path-based host pattern", () => {
        expect(detectProvider("dev.azure.com/exampleOrg2")).toBe(
          "azure-devops",
        );
        expect(detectProvider("dev.azure.com/exampleOrg1")).toBe(
          "azure-devops",
        );
      });

      it("builds correct auth headers from path-based host pattern", () => {
        const headers = buildAuthHeaders({
          token: "pat123",
          hostPattern: "dev.azure.com/exampleOrg2",
        });
        const expected = btoa(":pat123");
        expect(headers).toEqual({
          Authorization: `Basic ${expected}`,
        });
      });
    });
  });

  // ── Priority: accounts over legacy ─────────────────────────────
  describe("priority", () => {
    it("uses accounts over legacy when both exist", async () => {
      const account: any = {
        id: "acct-1",
        label: "GitHub",
        hostPattern: "github.com",
        token: "enc-new-tok",
        username: "",
        password: "",
        authorName: "",
        authorEmail: "",
      };

      setupConfig({
        git_accounts: [account],
        git_default_account: "acct-1",
        git_token: "enc-old-tok",
        git_username: "old-user",
      });

      const result = await resolveGitCredentials(
        fakeDb,
        "https://github.com/org/repo.git",
      );
      expect(result.token).toBe("decrypted:enc-new-tok");
    });
  });
});

// ── detectProvider ─────────────────────────────────────────────
describe("detectProvider", () => {
  it("detects github from hostPattern", () => {
    expect(detectProvider("github.com")).toBe("github");
  });

  it("detects github enterprise", () => {
    expect(detectProvider("github.mycompany.com")).toBe("github");
  });

  it("detects azure-devops from dev.azure.com", () => {
    expect(detectProvider("dev.azure.com")).toBe("azure-devops");
  });

  it("detects azure-devops from visualstudio.com", () => {
    expect(detectProvider("myorg.visualstudio.com")).toBe("azure-devops");
  });

  it("detects gitlab from gitlab.com", () => {
    expect(detectProvider("gitlab.com")).toBe("gitlab");
  });

  it("detects gitlab from self-hosted", () => {
    expect(detectProvider("gitlab.mycompany.com")).toBe("gitlab");
  });

  it("returns generic for unknown hosts", () => {
    expect(detectProvider("bitbucket.org")).toBe("generic");
    expect(detectProvider("example.com")).toBe("generic");
  });

  it("returns generic for empty string", () => {
    expect(detectProvider("")).toBe("generic");
  });
});

// ── buildAuthHeaders ───────────────────────────────────────────
describe("buildAuthHeaders", () => {
  it("returns token header for github provider", () => {
    const headers = buildAuthHeaders({
      token: "fake",
      provider: "github",
    });
    expect(headers).toEqual({
      Authorization: "token fake",
    });
  });

  it("returns Basic header for azure-devops with token", () => {
    const headers = buildAuthHeaders({
      token: "azure-fake",
      provider: "azure-devops",
    });
    // Azure DevOps: Basic base64(:PAT) — empty username, PAT as password
    const expected = btoa(":azure-fake");
    expect(headers).toEqual({
      Authorization: `Basic ${expected}`,
    });
  });

  it("returns Basic header for azure-devops with username+password", () => {
    const headers = buildAuthHeaders({
      username: "azuser",
      password: "azpass",
      provider: "azure-devops",
    });
    const expected = btoa("azuser:azpass");
    expect(headers).toEqual({
      Authorization: `Basic ${expected}`,
    });
  });

  it("prefers token over username+password for azure-devops", () => {
    const headers = buildAuthHeaders({
      token: "azure-fake",
      username: "azuser",
      password: "azpass",
      provider: "azure-devops",
    });
    const expected = btoa(":azure-fake");
    expect(headers).toEqual({
      Authorization: `Basic ${expected}`,
    });
  });

  it("returns Bearer header for gitlab provider", () => {
    const headers = buildAuthHeaders({
      token: "glpat-fake",
      provider: "gitlab",
    });
    expect(headers).toEqual({
      Authorization: "Bearer glpat-fake",
    });
  });

  it("returns Bearer header for generic provider", () => {
    const headers = buildAuthHeaders({
      token: "some-token",
      provider: "generic",
    });
    expect(headers).toEqual({
      Authorization: "Bearer some-token",
    });
  });

  it("returns empty object when no credentials", () => {
    const headers = buildAuthHeaders({ provider: "github" });
    expect(headers).toEqual({} as any);
  });

  it("returns empty object when token is undefined", () => {
    const headers = buildAuthHeaders({
      token: undefined,
      provider: "github",
    });
    expect(headers).toEqual({} as any);
  });

  it("infers provider from hostPattern when provider not set", () => {
    const headers = buildAuthHeaders({
      token: "pat123",
      hostPattern: "dev.azure.com",
    });
    const expected = btoa(":pat123");
    expect(headers).toEqual({
      Authorization: `Basic ${expected}`,
    });
  });

  it("explicit provider overrides hostPattern inference", () => {
    const headers = buildAuthHeaders({
      token: "pat123",
      provider: "github",
      hostPattern: "dev.azure.com",
    });
    expect(headers).toEqual({
      Authorization: "token pat123",
    });
  });
});

// ── resolveGitCredentials returns provider ─────────────────────
describe("resolveGitCredentials — provider field", () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    (mockGetConfig as any).mockResolvedValue(undefined);
  });

  it("returns provider from account hostPattern", async () => {
    const azureAccount: any = {
      id: "acct-az",
      label: "Azure DevOps",
      hostPattern: "dev.azure.com",
      token: "enc-tok",
      username: "",
      password: "",
      authorName: "",
      authorEmail: "",
    };
    setupConfig({
      git_accounts: [azureAccount],
    });

    const result = await resolveGitCredentials(
      fakeDb,
      "https://dev.azure.com/org/project/_git/repo",
    );
    expect(result.provider).toBe("azure-devops");
  });

  it("returns explicit provider from account when set", async () => {
    const customAccount: any = {
      id: "acct-custom",
      label: "Custom",
      hostPattern: "example.com",
      provider: "gitlab",
      token: "enc-tok",
      username: "",
      password: "",
      authorName: "",
      authorEmail: "",
    };
    setupConfig({
      git_accounts: [customAccount],
    });

    const result = await resolveGitCredentials(
      fakeDb,
      "https://example.com/repo.git",
    );
    expect(result.provider).toBe("gitlab");
  });

  it("returns generic provider for legacy credentials", async () => {
    setupConfig({ git_token: "enc-tok" });
    const result = await resolveGitCredentials(fakeDb);
    expect(result.provider).toBe("generic");
  });

  it("returns hostPattern in resolved credentials", async () => {
    const ghAccount: any = {
      id: "acct-gh",
      label: "GitHub",
      hostPattern: "github.com",
      token: "enc-tok",
      username: "",
      password: "",
      authorName: "",
      authorEmail: "",
    };
    setupConfig({
      git_accounts: [ghAccount],
    });

    const result = await resolveGitCredentials(
      fakeDb,
      "https://github.com/org/repo",
    );
    expect(result.hostPattern).toBe("github.com");
    expect(result.provider).toBe("github");
  });
});
