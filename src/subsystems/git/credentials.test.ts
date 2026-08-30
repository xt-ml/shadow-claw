import { jest } from "@jest/globals";

const mockDb = {} as any;
let storedConfig: Record<string, any> = {};

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn(async (_db: any, key: string) => storedConfig[key]),
}));

jest.unstable_mockModule("../../db/setConfig.js", () => ({
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
  });
});
