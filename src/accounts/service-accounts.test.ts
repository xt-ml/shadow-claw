// @ts-nocheck
import { jest } from "@jest/globals";

let resolveServiceCredentials;
let mockGetConfig;
let mockDecryptValue;
let mockEncryptValue;
let mockSetConfig;

describe("resolveServiceCredentials", () => {
  beforeEach(async () => {
    jest.resetModules();

    mockGetConfig = jest.fn();
    mockDecryptValue = jest.fn();
    mockEncryptValue = jest.fn();
    mockSetConfig = jest.fn();

    const providerCapabilities = {
      github: {
        providerId: "github",
        aliases: ["github", "api.github.com"],
        defaultMode: "oauth",
        tokenAuth: {
          pat: { headerName: "Authorization", headerPrefix: "token " },
          oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
        },
      },
      gitlab: {
        providerId: "gitlab",
        aliases: ["gitlab", "gitlab.com"],
        defaultMode: "oauth",
        tokenAuth: {
          pat: { headerName: "PRIVATE-TOKEN", headerPrefix: "" },
          oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
        },
      },
      figma: {
        providerId: "figma",
        aliases: ["figma", "api.figma.com"],
        defaultMode: "oauth",
        tokenAuth: {
          pat: { headerName: "X-Figma-Token", headerPrefix: "" },
          oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
        },
      },
      notion: {
        providerId: "notion",
        aliases: ["notion", "notion.so", "api.notion.com"],
        defaultMode: "oauth",
        tokenAuth: {
          pat: { headerName: "Authorization", headerPrefix: "Bearer " },
          oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
        },
      },
    };

    jest.unstable_mockModule("../config.js", () => ({
      CONFIG_KEYS: {
        SERVICE_ACCOUNTS: "service_accounts",
        SERVICE_DEFAULT_ACCOUNT: "service_default_account",
      },
      GENERAL_ACCOUNT_PROVIDER_CAPABILITIES: providerCapabilities,
      getGeneralAccountProviderCapabilities: (providerId) =>
        providerCapabilities[providerId] || null,
    }));

    jest.unstable_mockModule("../db/getConfig.js", () => ({
      getConfig: mockGetConfig,
    }));

    jest.unstable_mockModule("../db/setConfig.js", () => ({
      setConfig: mockSetConfig,
    }));

    jest.unstable_mockModule("../crypto.js", () => ({
      decryptValue: mockDecryptValue,
      encryptValue: mockEncryptValue,
    }));

    const mod = await import("./service-accounts.js");
    resolveServiceCredentials = mod.resolveServiceCredentials;
  });

  it("returns undefined when no accounts are stored", async () => {
    mockGetConfig.mockResolvedValue(undefined);

    const result = await resolveServiceCredentials(
      {},
      "https://api.figma.com/v1/files",
    );

    expect(result).toBeUndefined();
  });

  it("matches account by hostPattern and decrypts token", async () => {
    const accounts = [
      {
        id: "1",
        label: "Figma",
        service: "Figma",
        hostPattern: "api.figma.com",
        token: "enc-token",
      },
    ];
    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });
    mockDecryptValue.mockResolvedValue("plain-pat-123");

    const result = await resolveServiceCredentials(
      {},
      "https://api.figma.com/v1/files/abc",
    );

    expect(result).toEqual({
      token: "plain-pat-123",
      service: "Figma",
      hostPattern: "api.figma.com",
      headerName: "X-Figma-Token",
      headerValue: "plain-pat-123",
      accountId: "1",
      authMode: "pat",
    });
    expect(mockDecryptValue).toHaveBeenCalledWith("enc-token");
  });

  it("picks longest matching hostPattern", async () => {
    const accounts = [
      {
        id: "1",
        label: "Figma generic",
        service: "Figma",
        hostPattern: "figma.com",
        token: "enc-generic",
      },
      {
        id: "2",
        label: "Figma API",
        service: "Figma API",
        hostPattern: "api.figma.com",
        token: "enc-api",
      },
    ];
    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });
    mockDecryptValue.mockImplementation((t) =>
      Promise.resolve(t === "enc-api" ? "api-token" : "generic-token"),
    );

    const result = await resolveServiceCredentials(
      {},
      "https://api.figma.com/v1/files",
    );

    expect(result?.service).toBe("Figma API");
    expect(result?.token).toBe("api-token");
    expect(result?.headerName).toBe("X-Figma-Token");
    expect(result?.headerValue).toBe("api-token");
  });

  it("falls back to default account ID when no hostPattern matches", async () => {
    const accounts = [
      {
        id: "1",
        label: "Notion",
        service: "Notion",
        hostPattern: "notion.so",
        token: "enc-notion",
      },
      {
        id: "2",
        label: "Figma",
        service: "Figma",
        hostPattern: "figma.com",
        token: "enc-figma",
      },
    ];
    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      if (key === "service_default_account") {
        return Promise.resolve("2");
      }

      return Promise.resolve(undefined);
    });
    mockDecryptValue.mockResolvedValue("figma-default-token");

    const result = await resolveServiceCredentials(
      {},
      "https://api.example.com/data",
    );

    expect(result?.service).toBe("Figma");
    expect(result?.token).toBe("figma-default-token");
    expect(result?.headerName).toBe("X-Figma-Token");
    expect(result?.headerValue).toBe("figma-default-token");
  });

  it("falls back to first account when no match and no default", async () => {
    const accounts = [
      {
        id: "1",
        label: "MyService",
        service: "MyService",
        hostPattern: "myservice.io",
        token: "enc-1",
      },
    ];
    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });
    mockDecryptValue.mockResolvedValue("my-token");

    const result = await resolveServiceCredentials(
      {},
      "https://unrelated.com/api",
    );

    expect(result?.service).toBe("MyService");
    expect(result?.token).toBe("my-token");
    expect(result?.headerName).toBe("Authorization");
    expect(result?.headerValue).toBe("Bearer my-token");
  });

  it("supports selecting an explicit service account id", async () => {
    const accounts = [
      {
        id: "1",
        label: "PAT Account",
        service: "Example",
        hostPattern: "api.example.com",
        token: "enc-pat",
        authMode: "pat",
      },
      {
        id: "2",
        label: "OAuth Account",
        service: "Example",
        hostPattern: "api.example.com",
        token: "enc-oauth",
        authMode: "oauth",
      },
    ];

    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });

    mockDecryptValue.mockImplementation((t) =>
      Promise.resolve(t === "enc-oauth" ? "oauth-token" : "pat-token"),
    );

    const result = await resolveServiceCredentials(
      {},
      "https://api.example.com/v1/resource",
      { accountId: "2" },
    );

    expect(result?.token).toBe("oauth-token");
    expect(result?.authMode).toBe("oauth");
    expect(result?.accountId).toBe("2");
  });

  it("prefers matching auth mode when multiple host matches tie", async () => {
    const accounts = [
      {
        id: "1",
        label: "PAT Account",
        service: "Example",
        hostPattern: "api.example.com",
        token: "enc-pat",
        authMode: "pat",
      },
      {
        id: "2",
        label: "OAuth Account",
        service: "Example",
        hostPattern: "api.example.com",
        token: "enc-oauth",
        authMode: "oauth",
      },
    ];

    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });

    mockDecryptValue.mockImplementation((t) =>
      Promise.resolve(t === "enc-oauth" ? "oauth-token" : "pat-token"),
    );

    const result = await resolveServiceCredentials(
      {},
      "https://api.example.com/v1/resource",
      { authMode: "oauth" },
    );

    expect(result?.token).toBe("oauth-token");
    expect(result?.authMode).toBe("oauth");
    expect(result?.accountId).toBe("2");
  });

  it("uses provider capability header format for GitHub PAT", async () => {
    const accounts = [
      {
        id: "gh-pat",
        label: "GitHub PAT",
        service: "GitHub",
        hostPattern: "api.github.com",
        token: "enc-gh-pat",
        authMode: "pat",
      },
    ];

    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });

    mockDecryptValue.mockResolvedValue("gh-pat-token");

    const result = await resolveServiceCredentials(
      {},
      "https://api.github.com",
    );

    expect(result?.headerName).toBe("Authorization");
    expect(result?.headerValue).toBe("token gh-pat-token");
  });

  it("uses provider capability header format for Figma OAuth", async () => {
    const accounts = [
      {
        id: "fig-oauth",
        label: "Figma OAuth",
        service: "Figma",
        hostPattern: "api.figma.com",
        token: "enc-fig-oauth",
        authMode: "oauth",
        oauthProviderId: "figma",
      },
    ];

    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });

    mockDecryptValue.mockResolvedValue("fig-oauth-token");

    const result = await resolveServiceCredentials(
      {},
      "https://api.figma.com/v1/files",
      { authMode: "oauth" },
    );

    expect(result?.headerName).toBe("Authorization");
    expect(result?.headerValue).toBe("Bearer fig-oauth-token");
  });

  it("treats legacy OAuth accounts without authMode as OAuth", async () => {
    const accounts = [
      {
        id: "fig-legacy-oauth",
        label: "Figma OAuth Legacy",
        service: "Figma",
        hostPattern: "api.figma.com",
        token: "enc-fig-oauth",
        oauthProviderId: "figma",
        oauthClientId: "client-1",
      },
    ];

    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });

    mockDecryptValue.mockResolvedValue("fig-legacy-token");

    const result = await resolveServiceCredentials(
      {},
      "https://api.figma.com/v1/me",
    );

    expect(result?.authMode).toBe("oauth");
    expect(result?.headerName).toBe("Authorization");
    expect(result?.headerValue).toBe("Bearer fig-legacy-token");
  });

  it("prefers provider default auth mode when host matches tie", async () => {
    const accounts = [
      {
        id: "fig-pat",
        label: "Figma PAT",
        service: "Figma",
        hostPattern: "api.figma.com",
        token: "enc-fig-pat",
        authMode: "pat",
      },
      {
        id: "fig-oauth",
        label: "Figma OAuth",
        service: "Figma",
        hostPattern: "api.figma.com",
        token: "enc-fig-oauth",
        authMode: "oauth",
        oauthProviderId: "figma",
      },
    ];

    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });

    mockDecryptValue.mockImplementation((value) =>
      Promise.resolve(value === "enc-fig-oauth" ? "oauth-token" : "pat-token"),
    );

    const result = await resolveServiceCredentials(
      {},
      "https://api.figma.com/v1/files/abc",
    );

    expect(result?.accountId).toBe("fig-oauth");
    expect(result?.authMode).toBe("oauth");
    expect(result?.headerValue).toBe("Bearer oauth-token");
  });

  it("proactively refreshes OAuth token when near expiry", async () => {
    const accounts = [
      {
        id: "oauth-1",
        label: "GitHub OAuth",
        service: "GitHub",
        hostPattern: "api.github.com",
        token: "enc-old-access",
        authMode: "oauth",
        oauthProviderId: "github",
        oauthClientId: "client-123",
        refreshToken: "enc-refresh",
        accessTokenExpiresAt: Date.now() - 1_000,
        scopes: ["repo"],
      },
    ];

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresIn: 3600,
        tokenType: "Bearer",
        scope: "repo read:user",
      }),
    });

    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      if (key === "service_default_account") {
        return Promise.resolve("oauth-1");
      }

      return Promise.resolve(undefined);
    });

    mockDecryptValue.mockImplementation((value) => {
      if (value === "enc-refresh") {
        return Promise.resolve("refresh-token");
      }

      if (value === "enc-new-access") {
        return Promise.resolve("new-access-token");
      }

      if (value === "enc-new-refresh") {
        return Promise.resolve("new-refresh-token");
      }

      return Promise.resolve("old-access-token");
    });

    mockEncryptValue.mockImplementation((value) => {
      if (value === "new-access-token") {
        return Promise.resolve("enc-new-access");
      }

      if (value === "new-refresh-token") {
        return Promise.resolve("enc-new-refresh");
      }

      return Promise.resolve(undefined);
    });

    const result = await resolveServiceCredentials(
      {},
      "https://api.github.com/user",
      { authMode: "oauth" },
    );

    expect(result?.token).toBe("new-access-token");
    expect(result?.authMode).toBe("oauth");
    expect(mockSetConfig).toHaveBeenCalledWith(
      {},
      "service_accounts",
      expect.arrayContaining([
        expect.objectContaining({
          id: "oauth-1",
          token: "enc-new-access",
          refreshToken: "enc-new-refresh",
        }),
      ]),
    );
  });

  it("forces OAuth refresh when forceRefresh option is true", async () => {
    const accounts = [
      {
        id: "oauth-2",
        label: "GitHub OAuth",
        service: "GitHub",
        hostPattern: "api.github.com",
        token: "enc-old-access",
        authMode: "oauth",
        oauthProviderId: "github",
        oauthClientId: "client-123",
        refreshToken: "enc-refresh",
        accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
        scopes: ["repo"],
      },
    ];

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: "forced-access-token",
        expiresIn: 1800,
      }),
    });

    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });

    mockDecryptValue.mockImplementation((value) => {
      if (value === "enc-refresh") {
        return Promise.resolve("refresh-token");
      }

      if (value === "enc-forced-access") {
        return Promise.resolve("forced-access-token");
      }

      return Promise.resolve("old-access-token");
    });

    mockEncryptValue.mockImplementation((value) => {
      if (value === "forced-access-token") {
        return Promise.resolve("enc-forced-access");
      }

      return Promise.resolve(undefined);
    });

    const result = await resolveServiceCredentials(
      {},
      "https://api.github.com/user",
      { authMode: "oauth", forceRefresh: true },
    );

    expect(result?.token).toBe("forced-access-token");
    expect((global as any).fetch).toHaveBeenCalledWith(
      "/oauth/refresh",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("marks account as reauth-required after repeated refresh failures", async () => {
    const accounts = [
      {
        id: "oauth-3",
        label: "GitHub OAuth",
        service: "GitHub",
        hostPattern: "api.github.com",
        token: "enc-old-access",
        authMode: "oauth",
        oauthProviderId: "github",
        oauthClientId: "client-123",
        refreshToken: "enc-refresh",
        accessTokenExpiresAt: Date.now() - 1_000,
      },
    ];

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid_grant" }),
    });

    mockGetConfig.mockImplementation((_db, key) => {
      if (key === "service_accounts") {
        return Promise.resolve(accounts);
      }

      return Promise.resolve(undefined);
    });

    mockDecryptValue.mockImplementation((value) => {
      if (value === "enc-refresh") {
        return Promise.resolve("refresh-token");
      }

      return Promise.resolve("old-access-token");
    });

    mockEncryptValue.mockResolvedValue(undefined);

    await resolveServiceCredentials({}, "https://api.github.com/user", {
      authMode: "oauth",
    });
    await resolveServiceCredentials({}, "https://api.github.com/user", {
      authMode: "oauth",
    });

    const third = await resolveServiceCredentials(
      {},
      "https://api.github.com/user",
      {
        authMode: "oauth",
      },
    );

    expect(third?.reauthRequired).toBe(true);
    expect(third?.headerValue).toBe("");
    expect(mockSetConfig).toHaveBeenLastCalledWith(
      {},
      "service_accounts",
      expect.arrayContaining([
        expect.objectContaining({
          id: "oauth-3",
          oauthRefreshFailureCount: 3,
          oauthReauthRequired: true,
        }),
      ]),
    );
  });
});
