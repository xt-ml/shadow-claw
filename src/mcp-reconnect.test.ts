import { jest } from "@jest/globals";

const mockGetConfig = jest.fn<any>();
const mockSetConfig = jest.fn<any>();
const mockGetRemoteMcpConnection = jest.fn<any>();
const mockClearRemoteMcpSession = jest.fn();
const mockEncryptValue = jest.fn<any>();
const mockDecryptValue = jest.fn<any>();

jest.unstable_mockModule("./db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("./db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

jest.unstable_mockModule("./mcp-connections.js", () => ({
  getRemoteMcpConnection: mockGetRemoteMcpConnection,
}));

jest.unstable_mockModule("./remote-mcp-client.js", () => ({
  clearRemoteMcpSession: mockClearRemoteMcpSession,
}));

jest.unstable_mockModule("./crypto.js", () => ({
  encryptValue: mockEncryptValue,
  decryptValue: mockDecryptValue,
}));

jest.unstable_mockModule("./config.js", () => ({
  CONFIG_KEYS: {
    SERVICE_ACCOUNTS: "service_accounts",
    GIT_ACCOUNTS: "git_accounts",
  },
  OAUTH_PROVIDER_DEFINITIONS: {},
}));

const { reconnectMcpOAuth } = await import("./mcp-reconnect.js");

describe("reconnectMcpOAuth", () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    mockSetConfig.mockReset();
    mockGetRemoteMcpConnection.mockReset();
    mockClearRemoteMcpSession.mockReset();
    mockEncryptValue.mockReset();
    mockDecryptValue.mockReset();
    (globalThis as any).fetch = jest.fn();
  });

  afterEach(() => {
    delete (globalThis as any).fetch;
  });

  it("returns error when connection not found", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue(null);

    const result = await reconnectMcpOAuth({} as any, "missing");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Connection not found");
  });

  it("returns error when connection has no credentialRef", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      credentialRef: null,
    });

    const result = await reconnectMcpOAuth({} as any, "conn-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Connection not found");
  });

  it("returns error when connection does not use OAuth", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      credentialRef: { authType: "pat", accountId: "acct-1" },
    });

    const result = await reconnectMcpOAuth({} as any, "conn-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("does not use OAuth");
  });

  it("returns error when linked service account not found", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      credentialRef: { authType: "oauth", accountId: "missing-acct" },
    });
    mockGetConfig
      .mockResolvedValueOnce([]) // service accounts
      .mockResolvedValueOnce([]); // git accounts

    const result = await reconnectMcpOAuth({} as any, "conn-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Linked account not found");
  });

  it("returns error when account lacks OAuth provider or client ID", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      credentialRef: { authType: "oauth", accountId: "acct-1" },
    });
    mockGetConfig
      .mockResolvedValueOnce([{ id: "acct-1" }]) // service accounts — no oauthProviderId
      .mockResolvedValueOnce([]); // git accounts

    const result = await reconnectMcpOAuth({} as any, "conn-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("missing OAuth provider or client ID");
  });

  it("returns error when /oauth/authorize fails", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      credentialRef: { authType: "oauth", accountId: "acct-1" },
    });
    mockGetConfig
      .mockResolvedValueOnce([
        {
          id: "acct-1",
          oauthProviderId: "custom_mcp",
          oauthClientId: "client-id",
        },
      ])
      .mockResolvedValueOnce([]);

    ((globalThis as any).fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "bad request" }),
    });

    const result = await reconnectMcpOAuth({} as any, "conn-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("bad request");
  });

  it("clears MCP session after successful reconnect", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      credentialRef: { authType: "oauth", accountId: "acct-1" },
    });
    mockGetConfig
      .mockResolvedValueOnce([
        {
          id: "acct-1",
          oauthProviderId: "custom_mcp",
          oauthClientId: "client-id",
        },
      ])
      .mockResolvedValueOnce([]);

    mockEncryptValue.mockResolvedValue("encrypted-token");
    mockSetConfig.mockResolvedValue(undefined);

    const windowOpenSpy = jest
      .spyOn(window, "open")
      .mockImplementation(() => ({ closed: false }) as any);

    ((globalThis as any).fetch as any)
      // /oauth/authorize
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: "state-123",
          authorizeUrl: "https://auth.example.com/authorize",
        }),
      })
      // /oauth/session poll — authorized
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "authorized" }),
      })
      // /oauth/token
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: "new-token",
          refreshToken: "new-refresh",
          expiresIn: 3600,
        }),
      });

    const result = await reconnectMcpOAuth({} as any, "conn-1");

    expect(result.success).toBe(true);
    expect(mockClearRemoteMcpSession).toHaveBeenCalledWith("conn-1");
    expect(mockSetConfig).toHaveBeenCalled();
    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://auth.example.com/authorize",
      "shadowclaw-oauth",
      expect.any(String),
    );

    windowOpenSpy.mockRestore();
  });

  it("succeeds via silent refresh without opening popup", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      credentialRef: { authType: "oauth", accountId: "acct-1" },
    });
    mockGetConfig
      .mockResolvedValueOnce([
        {
          id: "acct-1",
          oauthProviderId: "custom_mcp",
          oauthClientId: "client-id",
          refreshToken: "encrypted-refresh",
        },
      ])
      .mockResolvedValueOnce([]);

    mockDecryptValue.mockResolvedValue("decrypted-refresh-token");
    mockEncryptValue.mockResolvedValue("encrypted-token");
    mockSetConfig.mockResolvedValue(undefined);

    const windowOpenSpy = jest
      .spyOn(window, "open")
      .mockImplementation(() => ({ closed: false }) as any);

    ((globalThis as any).fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresIn: 3600,
      }),
    });

    const result = await reconnectMcpOAuth({} as any, "conn-1");

    expect(result.success).toBe(true);
    expect(mockClearRemoteMcpSession).toHaveBeenCalledWith("conn-1");
    expect(mockSetConfig).toHaveBeenCalled();
    // No popup should have been opened
    expect(windowOpenSpy).not.toHaveBeenCalled();

    windowOpenSpy.mockRestore();
  });

  it("returns error for silentOnly when refresh fails", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      credentialRef: { authType: "oauth", accountId: "acct-1" },
    });
    mockGetConfig
      .mockResolvedValueOnce([
        {
          id: "acct-1",
          oauthProviderId: "custom_mcp",
          oauthClientId: "client-id",
          refreshToken: "encrypted-refresh",
        },
      ])
      .mockResolvedValueOnce([]);

    mockDecryptValue.mockResolvedValue("decrypted-refresh-token");

    ((globalThis as any).fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "invalid_grant" }),
    });

    const result = await reconnectMcpOAuth({} as any, "conn-1", {
      silentOnly: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Silent token refresh failed");
  });
});
