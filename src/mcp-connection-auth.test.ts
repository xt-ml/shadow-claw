import { jest } from "@jest/globals";

const mockGetRemoteMcpConnection = jest.fn() as any;
const mockDecryptValue = jest.fn() as any;
const mockResolveServiceCredentials = jest.fn() as any;
const mockResolveGitCredentials = jest.fn() as any;
const mockBuildAuthHeaders = jest.fn() as any;

jest.unstable_mockModule("./mcp-connections.js", () => ({
  getRemoteMcpConnection: mockGetRemoteMcpConnection,
}));

jest.unstable_mockModule("./crypto.js", () => ({
  decryptValue: mockDecryptValue,
}));

jest.unstable_mockModule("./accounts/service-accounts.js", () => ({
  resolveServiceCredentials: mockResolveServiceCredentials,
}));

jest.unstable_mockModule("./git/credentials.js", () => ({
  resolveGitCredentials: mockResolveGitCredentials,
  buildAuthHeaders: mockBuildAuthHeaders,
}));

const { resolveRemoteMcpConnectionAuth } =
  await import("./mcp-connection-auth.js");

describe("resolveRemoteMcpConnectionAuth", () => {
  const fakeDb: any = {};

  beforeEach(() => {
    mockGetRemoteMcpConnection.mockReset();
    mockDecryptValue.mockReset();
    mockResolveServiceCredentials.mockReset();
    mockResolveGitCredentials.mockReset();
    mockBuildAuthHeaders.mockReset();
  });

  it("returns null when connection does not exist", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue(null);

    const result = await resolveRemoteMcpConnectionAuth(fakeDb, "missing");

    expect(result).toBeNull();
  });

  it("returns empty headers when credential ref is absent", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      serverUrl: "https://mcp.example.com",
      credentialRef: null,
    });

    const result = await resolveRemoteMcpConnectionAuth(fakeDb, "conn-1");

    expect(result).toEqual(
      expect.objectContaining({
        headers: {},
        authType: "none",
      }),
    );
  });

  it("resolves custom header auth by decrypting stored value", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      serverUrl: "https://mcp.example.com",
      credentialRef: {
        serviceType: "mcp_remote",
        authType: "custom_header",
        headerName: "X-API-Key",
        encryptedValue: "enc-value",
      },
    });
    mockDecryptValue.mockResolvedValue("decrypted-secret");

    const result = await resolveRemoteMcpConnectionAuth(fakeDb, "conn-1");

    expect(result?.headers).toEqual({ "X-API-Key": "decrypted-secret" });
  });

  it("resolves service account OAuth headers", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      serverUrl: "https://mcp.example.com",
      credentialRef: {
        serviceType: "mcp_remote",
        authType: "oauth",
        accountId: "svc-1",
      },
    });
    mockResolveServiceCredentials.mockResolvedValue({
      headerName: "Authorization",
      headerValue: "Bearer token-1",
      service: "Custom MCP",
      hostPattern: "mcp.example.com",
      authMode: "oauth",
    });

    const result = await resolveRemoteMcpConnectionAuth(fakeDb, "conn-1");

    expect(mockResolveServiceCredentials).toHaveBeenCalledWith(
      fakeDb,
      "https://mcp.example.com",
      {
        accountId: "svc-1",
        authMode: "oauth",
      },
    );
    expect(result?.headers).toEqual({ Authorization: "Bearer token-1" });
  });

  it("returns reconnect flag when bound OAuth service account needs reauth", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      serverUrl: "https://mcp.example.com",
      credentialRef: {
        serviceType: "mcp_remote",
        authType: "oauth",
        accountId: "svc-1",
      },
    });
    mockResolveServiceCredentials.mockResolvedValue({
      reauthRequired: true,
      service: "Custom MCP",
      hostPattern: "mcp.example.com",
      authMode: "oauth",
    });

    const result = await resolveRemoteMcpConnectionAuth(fakeDb, "conn-1");

    expect(result?.headers).toEqual({});
    expect(result?.reauthRequired).toBe(true);
  });

  it("resolves git account PAT/OAuth headers for git-backed MCPs", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      serverUrl: "https://mcp.example.com",
      credentialRef: {
        serviceType: "mcp_remote",
        authType: "pat",
        gitAccountId: "git-1",
      },
    });
    mockResolveGitCredentials.mockResolvedValue({ token: "abc" });
    mockBuildAuthHeaders.mockReturnValue({ Authorization: "Bearer abc" });

    const result = await resolveRemoteMcpConnectionAuth(fakeDb, "conn-1");

    expect(mockResolveGitCredentials).toHaveBeenCalledWith(
      fakeDb,
      "https://mcp.example.com",
      {
        accountId: "git-1",
        authMode: "pat",
      },
    );
    expect(result?.headers).toEqual({ Authorization: "Bearer abc" });
  });

  it("returns reconnect flag when bound Git OAuth account needs reauth", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      serverUrl: "https://mcp.example.com",
      credentialRef: {
        serviceType: "mcp_remote",
        authType: "oauth",
        gitAccountId: "git-1",
      },
    });
    mockResolveGitCredentials.mockResolvedValue({
      reauthRequired: true,
      authMode: "oauth",
      hostPattern: "github.com",
    });

    const result = await resolveRemoteMcpConnectionAuth(fakeDb, "conn-1");

    expect(result?.headers).toEqual({});
    expect(result?.reauthRequired).toBe(true);
  });
});
