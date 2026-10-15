import { jest } from "@jest/globals";

const mockDb = {} as any;
let storedConfig: Record<string, any> = {};

jest.unstable_mockModule("../../db/get-config.js", () => ({
  getConfig: jest.fn(async (_db: any, key: string) => storedConfig[key]),
}));

jest.unstable_mockModule("../../db/set-config.js", () => ({
  setConfig: jest.fn(async (_db: any, key: string, value: any) => {
    storedConfig[key] = value;
  }),
}));

jest.unstable_mockModule("../../security/crypto.js", () => ({
  encryptValue: jest.fn(async (val: string) => `enc:${val}`),
  decryptValue: jest.fn(async (val: string) =>
    val.startsWith("enc:") ? val.slice(4) : val,
  ),
}));

jest.unstable_mockModule("../../config/config.js", () => ({
  CONFIG_KEYS: {
    GIT_ACCOUNTS: "git_accounts",
    GIT_DEFAULT_ACCOUNT: "git_default_account",
    GIT_TOKEN: "git_token",
    GIT_USERNAME: "git_username",
    GIT_PASSWORD: "git_password",
    GIT_AUTHOR_NAME: "git_author_name",
    GIT_AUTHOR_EMAIL: "git_author_email",
  },
  getProviderTokenAuthScheme: jest.fn((providerId: string) => {
    if (providerId === "azure_devops") {
      return { headerName: "Authorization", headerPrefix: "Basic " };
    }
    return { headerName: "Authorization", headerPrefix: "Bearer " };
  }),
}));

const { detectProvider, buildAuthHeaders, resolveGitCredentials } =
  await import("./credentials.js");

describe("git credentials", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storedConfig = {};
  });

  describe("detectProvider", () => {
    it("detects GitHub", () => {
      expect(detectProvider("github.com")).toBe("github");
      expect(detectProvider("https://github.com/owner/repo")).toBe("github");
    });

    it("detects Azure DevOps", () => {
      expect(detectProvider("dev.azure.com")).toBe("azure-devops");
      expect(detectProvider("myorg.visualstudio.com")).toBe("azure-devops");
    });

    it("detects GitLab", () => {
      expect(detectProvider("gitlab.com")).toBe("gitlab");
      expect(detectProvider("https://gitlab.example.com/repo")).toBe("gitlab");
    });

    it("falls back to generic for other hosts", () => {
      expect(detectProvider("bitbucket.org")).toBe("generic");
      expect(detectProvider("")).toBe("generic");
    });
  });

  describe("buildAuthHeaders", () => {
    it("returns empty object when reauthRequired is true", () => {
      expect(
        buildAuthHeaders({
          reauthRequired: true,
          token: "secret-token",
          provider: "github",
        }),
      ).toEqual({});
    });

    it("builds Authorization header for Azure DevOps basic/token", () => {
      const headers = buildAuthHeaders({
        provider: "azure-devops",
        token: "pat123",
      });
      expect(headers.Authorization).toBe(`Basic ${btoa(":pat123")}`);
    });

    it("builds Authorization header for Azure DevOps username/password", () => {
      const headers = buildAuthHeaders({
        provider: "azure-devops",
        username: "user1",
        password: "pwd",
      });
      expect(headers.Authorization).toBe(`Basic ${btoa("user1:pwd")}`);
    });

    it("builds Bearer Authorization header for general tokens", () => {
      const headers = buildAuthHeaders({
        provider: "github",
        token: "ghp_123456",
      });
      expect(headers.Authorization).toBe("Bearer ghp_123456");
    });

    it("returns empty object when no token or credentials provided", () => {
      expect(buildAuthHeaders({ provider: "github" })).toEqual({});
    });
  });

  describe("resolveGitCredentials", () => {
    it("resolves from legacy single-key config when no accounts configured", async () => {
      storedConfig["git_token"] = "enc:legacy-token";
      storedConfig["git_username"] = "legacy-user";
      storedConfig["git_author_name"] = "Legacy Author";
      storedConfig["git_author_email"] = "legacy@example.com";

      const creds = await resolveGitCredentials(
        mockDb,
        "https://github.com/org/repo.git",
      );
      expect(creds.token).toBe("legacy-token");
      expect(creds.username).toBe("legacy-user");
      expect(creds.authorName).toBe("Legacy Author");
      expect(creds.authorEmail).toBe("legacy@example.com");
      expect(creds.provider).toBe("generic");
    });

    it("resolves and decrypts credentials for matching host URL with longest pattern match", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "general-azure",
          hostPattern: "dev.azure.com",
          provider: "azure-devops",
          token: "enc:general-token",
        },
        {
          id: "specific-azure",
          hostPattern: "dev.azure.com/specific-org",
          provider: "azure-devops",
          token: "enc:specific-token",
        },
      ];

      const creds = await resolveGitCredentials(
        mockDb,
        "https://dev.azure.com/specific-org/project/_git/repo",
      );

      expect(creds.accountId).toBe("specific-azure");
      expect(creds.token).toBe("specific-token");
      expect(creds.provider).toBe("azure-devops");
    });

    it("resolves specific account when accountId option is passed", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "acct-1",
          hostPattern: "github.com",
          token: "enc:tok-1",
        },
        {
          id: "acct-2",
          hostPattern: "github.com",
          token: "enc:tok-2",
        },
      ];

      const creds = await resolveGitCredentials(
        mockDb,
        "https://github.com/foo/bar",
        {
          accountId: "acct-2",
        },
      );
      expect(creds.accountId).toBe("acct-2");
      expect(creds.token).toBe("tok-2");
    });

    it("resolves default account when URL is omitted or matches default host", async () => {
      storedConfig["git_default_account"] = "default-acct";
      storedConfig["git_accounts"] = [
        {
          id: "default-acct",
          hostPattern: "github.com",
          provider: "github",
          token: "enc:default-tok",
        },
      ];

      const creds = await resolveGitCredentials(mockDb);
      expect(creds.accountId).toBe("default-acct");
      expect(creds.token).toBe("default-tok");
    });

    it("handles oauth reauth required state", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "oauth-acct",
          hostPattern: "github.com",
          provider: "github",
          authMode: "oauth",
          oauthReauthRequired: true,
          authorEmail: "oauth@example.com",
        },
      ];

      const creds = await resolveGitCredentials(
        mockDb,
        "https://github.com/foo/bar",
      );
      expect(creds.reauthRequired).toBe(true);
      expect(creds.authMode).toBe("oauth");
      expect(creds.authorEmail).toBe("oauth@example.com");
    });

    it("returns empty default object when accounts exist but none match url", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "acct-github",
          hostPattern: "github.com",
          token: "enc:gh-tok",
        },
      ];

      const creds = await resolveGitCredentials(
        mockDb,
        "https://gitlab.com/other/repo",
      );
      expect(creds.accountId).toBeUndefined();
      expect(creds.token).toBeUndefined();
      expect(creds.provider).toBe("generic");
    });

    it("matches account by authMode when multiple accounts match host", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "pat-acct",
          hostPattern: "github.com",
          token: "enc:pat-tok",
          authMode: "token",
        },
        {
          id: "oauth-acct",
          hostPattern: "github.com",
          token: "enc:oauth-tok",
          authMode: "oauth",
        },
      ];

      const creds = await resolveGitCredentials(
        mockDb,
        "https://github.com/foo/bar",
        { authMode: "oauth" },
      );
      expect(creds.accountId).toBe("oauth-acct");
      expect(creds.token).toBe("oauth-tok");
    });

    it("matches legacy account without authMode when token mode requested", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "legacy-acct",
          hostPattern: "github.com",
          token: "enc:legacy-tok",
        },
      ];

      const creds = await resolveGitCredentials(
        mockDb,
        "https://github.com/foo/bar",
        { authMode: "token" },
      );
      expect(creds.accountId).toBe("legacy-acct");
      expect(creds.token).toBe("legacy-tok");
    });

    it("falls back to default account matching url hostPattern when direct host match fails", async () => {
      storedConfig["git_default_account"] = "default-match";
      storedConfig["git_accounts"] = [
        {
          id: "default-match",
          hostPattern: "ghe.internal.corp",
          token: "enc:internal-tok",
        },
      ];

      const creds = await resolveGitCredentials(
        mockDb,
        "https://ghe.internal.corp/org/repo",
      );
      expect(creds.accountId).toBe("default-match");
      expect(creds.token).toBe("internal-tok");
    });

    it("falls back to first account matching authMode when no url provided", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "acct-pat",
          hostPattern: "github.com",
          token: "enc:pat-tok",
          authMode: "token",
        },
        {
          id: "acct-oauth",
          hostPattern: "github.com",
          token: "enc:oauth-tok",
          authMode: "oauth",
        },
      ];

      const creds = await resolveGitCredentials(mockDb, undefined, {
        authMode: "oauth",
      });
      expect(creds.accountId).toBe("acct-oauth");
    });

    it("falls back to first account when no url and no default account", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "first-acct",
          hostPattern: "github.com",
          token: "enc:first-tok",
        },
      ];

      const creds = await resolveGitCredentials(mockDb);
      expect(creds.accountId).toBe("first-acct");
    });

    it("refreshes expired oauth token successfully", async () => {
      const originalFetch = globalThis.fetch;
      const mockFetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresIn: 3600,
          scope: "repo read:org",
          tokenType: "Bearer",
        }),
      })) as any;
      globalThis.fetch = mockFetch;

      try {
        storedConfig["git_accounts"] = [
          {
            id: "oauth-refresh-acct",
            hostPattern: "github.com",
            provider: "github",
            authMode: "oauth",
            token: "enc:old-access",
            refreshToken: "enc:old-refresh",
            oauthProviderId: "github",
            oauthClientId: "client-id-123",
            oauthClientSecret: "enc:secret-123",
            accessTokenExpiresAt: Date.now() - 1000,
          },
        ];

        const creds = await resolveGitCredentials(
          mockDb,
          "https://github.com/foo/bar",
        );
        expect(creds.token).toBe("new-access-token");
        expect(mockFetch).toHaveBeenCalled();
        const updated = storedConfig["git_accounts"][0];
        expect(updated.token).toBe("enc:new-access-token");
        expect(updated.refreshToken).toBe("enc:new-refresh-token");
        expect(updated.scopes).toEqual(["repo", "read:org"]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("marks refresh failure and transitions to reauthRequired after threshold", async () => {
      const originalFetch = globalThis.fetch;
      const mockFetch = jest.fn(async () => ({
        ok: false,
        status: 400,
      })) as any;
      globalThis.fetch = mockFetch;

      try {
        storedConfig["git_accounts"] = [
          {
            id: "failing-oauth-acct",
            hostPattern: "github.com",
            provider: "github",
            authMode: "oauth",
            token: "enc:token",
            refreshToken: "enc:refresh",
            oauthProviderId: "github",
            oauthClientId: "client-id-123",
            oauthRefreshFailureCount: 2,
            accessTokenExpiresAt: Date.now() - 1000,
          },
        ];

        const creds = await resolveGitCredentials(
          mockDb,
          "https://github.com/foo/bar",
          { forceRefresh: true },
        );
        expect(creds.reauthRequired).toBe(true);
        expect(storedConfig["git_accounts"][0].oauthReauthRequired).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles fetch exception during oauth refresh gracefully", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async () => {
        throw new Error("Network offline");
      }) as any;

      try {
        storedConfig["git_accounts"] = [
          {
            id: "network-fail-acct",
            hostPattern: "github.com",
            provider: "github",
            authMode: "oauth",
            token: "enc:token",
            refreshToken: "enc:refresh",
            oauthProviderId: "github",
            oauthClientId: "client-id-123",
            accessTokenExpiresAt: Date.now() - 1000,
          },
        ];

        const creds = await resolveGitCredentials(
          mockDb,
          "https://github.com/foo/bar",
        );
        expect(creds.token).toBe("token");
        expect(storedConfig["git_accounts"][0].oauthRefreshFailureCount).toBe(
          1,
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles oauth response missing accessToken", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({}),
      })) as any;

      try {
        storedConfig["git_accounts"] = [
          {
            id: "missing-token-acct",
            hostPattern: "github.com",
            provider: "github",
            authMode: "oauth",
            token: "enc:token",
            refreshToken: "enc:refresh",
            oauthProviderId: "github",
            oauthClientId: "client-id-123",
            accessTokenExpiresAt: Date.now() - 1000,
          },
        ];

        const creds = await resolveGitCredentials(
          mockDb,
          "https://github.com/foo/bar",
        );
        expect(creds.token).toBe("token");
        expect(storedConfig["git_accounts"][0].oauthRefreshFailureCount).toBe(
          1,
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("resolves full legacy config with password and user metadata", async () => {
      storedConfig["git_token"] = "enc:pat";
      storedConfig["git_password"] = "enc:secret-pass";
      storedConfig["git_username"] = "myuser";
      storedConfig["git_author_name"] = "Full Name";
      storedConfig["git_author_email"] = "me@example.com";

      const creds = await resolveGitCredentials(mockDb);
      expect(creds.password).toBe("secret-pass");
      expect(creds.username).toBe("myuser");
      expect(creds.authorName).toBe("Full Name");
      expect(creds.authorEmail).toBe("me@example.com");
    });

    it("matches legacy PAT account without explicit authMode property when authMode is token", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "oauth-acct",
          hostPattern: "github.com",
          authMode: "oauth",
          token: "enc:oauth-tok",
        },
        {
          id: "legacy-pat",
          hostPattern: "github.com",
          // authMode omitted
          token: "enc:pat-tok",
        },
      ];

      const creds = await resolveGitCredentials(
        mockDb,
        "https://github.com/foo/bar",
        { authMode: "token" },
      );
      expect(creds.accountId).toBe("legacy-pat");
      expect(creds.token).toBe("pat-tok");
    });

    it("falls back to default account when its hostPattern matches the repo URL", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "default-acct",
          hostPattern: "github.com",
          token: "enc:def-tok",
        },
      ];
      storedConfig["git_default_account"] = "default-acct";

      const creds = await resolveGitCredentials(
        mockDb,
        "https://github.com/another/repo.git",
      );
      expect(creds.accountId).toBe("default-acct");
      expect(creds.token).toBe("def-tok");
    });

    it("does not refresh OAuth account if accessTokenExpiresAt is missing", async () => {
      const originalFetch = globalThis.fetch;
      const fetchMock = jest.fn();
      globalThis.fetch = fetchMock as any;

      try {
        storedConfig["git_accounts"] = [
          {
            id: "no-expires-oauth",
            hostPattern: "github.com",
            authMode: "oauth",
            token: "enc:current-tok",
            refreshToken: "enc:ref-tok",
            oauthProviderId: "github",
            oauthClientId: "cid",
            // accessTokenExpiresAt missing
          },
        ];

        const creds = await resolveGitCredentials(
          mockDb,
          "https://github.com/foo/bar",
        );
        expect(creds.token).toBe("current-tok");
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("detects provider from hostPattern when provider is omitted in buildAuthHeaders", () => {
      const headers = buildAuthHeaders({
        hostPattern: "https://github.com/org/repo",
        token: "tok123",
      });
      expect(headers.Authorization).toBe("Bearer tok123");
    });

    it("updates accessTokenExpiresAt, tokenType, and scopes on successful OAuth refresh", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          accessToken: "refreshed-token",
          expiresIn: 7200,
          tokenType: "bearer",
          scope: "repo user:email",
        }),
      })) as any;

      try {
        storedConfig["git_accounts"] = [
          {
            id: "full-refresh-acct",
            hostPattern: "github.com",
            authMode: "oauth",
            token: "enc:old-tok",
            refreshToken: "enc:ref-tok",
            oauthProviderId: "github",
            oauthClientId: "cid-123",
            accessTokenExpiresAt: Date.now() - 5000,
          },
        ];

        const creds = await resolveGitCredentials(
          mockDb,
          "https://github.com/foo/bar",
          { forceRefresh: true },
        );

        expect(creds.token).toBe("refreshed-token");
        const updated = storedConfig["git_accounts"][0];
        expect(updated.tokenType).toBe("bearer");
        expect(updated.scopes).toEqual(["repo", "user:email"]);
        expect(updated.accessTokenExpiresAt).toBeGreaterThan(Date.now());
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back to default Bearer scheme when getProviderTokenAuthScheme returns null", async () => {
      const { getProviderTokenAuthScheme } =
        await import("../../config/config.js");
      (getProviderTokenAuthScheme as any).mockReturnValueOnce(null);

      const headers = buildAuthHeaders({
        provider: "generic",
        token: "generic-tok",
      });
      expect(headers.Authorization).toBe("Bearer generic-tok");
    });

    it("skips accounts without hostPattern and preserves multiple matching same-length patterns", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "no-pattern",
          token: "enc:none",
        },
        {
          id: "pattern-a",
          hostPattern: "github.com",
          authMode: "token",
          token: "enc:token-a",
        },
        {
          id: "pattern-b",
          hostPattern: "github.com",
          authMode: "oauth",
          token: "enc:token-b",
        },
      ];

      const creds = await resolveGitCredentials(
        mockDb,
        "https://github.com/foo/bar",
        { authMode: "oauth" },
      );
      expect(creds.accountId).toBe("pattern-b");
    });

    it("returns unmodified account if refresh token decryption fails", async () => {
      storedConfig["git_accounts"] = [
        {
          id: "corrupted-refresh",
          hostPattern: "github.com",
          authMode: "oauth",
          token: "enc:tok",
          refreshToken: "corrupted",
          oauthProviderId: "github",
          oauthClientId: "cid",
          accessTokenExpiresAt: Date.now() - 1000,
        },
      ];

      const { decryptValue } = await import("../../security/crypto.js");
      (decryptValue as any).mockImplementationOnce(async () => null);

      const creds = await resolveGitCredentials(
        mockDb,
        "https://github.com/foo/bar",
        { forceRefresh: true },
      );
      expect(creds.accountId).toBe("corrupted-refresh");
    });

    it("marks refresh failure when encryptValue returns null for new access token", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ accessToken: "fresh-tok" }),
      })) as any;

      const { encryptValue } = await import("../../security/crypto.js");
      (encryptValue as any).mockImplementationOnce(async () => null);

      try {
        storedConfig["git_accounts"] = [
          {
            id: "encrypt-fail-acct",
            hostPattern: "github.com",
            authMode: "oauth",
            token: "enc:tok",
            refreshToken: "enc:ref",
            oauthProviderId: "github",
            oauthClientId: "cid",
            accessTokenExpiresAt: Date.now() - 1000,
          },
        ];

        await resolveGitCredentials(mockDb, "https://github.com/foo/bar", {
          forceRefresh: true,
        });
        expect(storedConfig["git_accounts"][0].oauthRefreshFailureCount).toBe(
          1,
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
