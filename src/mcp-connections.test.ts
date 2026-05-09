import { jest } from "@jest/globals";

const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;

jest.unstable_mockModule("./db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("./db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

jest.unstable_mockModule("./config.js", () => ({
  CONFIG_KEYS: {
    REMOTE_MCP_CONNECTIONS: "remote_mcp_connections",
  },
}));

jest.unstable_mockModule("./ulid.js", () => ({
  ulid: () => "01TESTREMOTE0000000000000000",
}));

const {
  listRemoteMcpConnections,
  upsertRemoteMcpConnection,
  bindRemoteMcpCredentialRef,
  deleteRemoteMcpConnection,
  getRemoteMcpConnection,
} = await import("./mcp-connections.js");

describe("mcp-connections", () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    mockSetConfig.mockReset();
    mockGetConfig.mockResolvedValue(undefined);
  });

  it("creates a new remote MCP connection with defaults", async () => {
    const db: any = {};

    const result = await upsertRemoteMcpConnection(db, {
      label: "Figma MCP",
      serverUrl: "https://mcp.example.com",
      transport: "streamable_http",
    });

    expect(result.id).toBe("01TESTREMOTE0000000000000000");
    expect(result.enabled).toBe(true);
    expect(result.serviceType).toBe("mcp_remote");
    expect(result.credentialRef).toBeNull();
    expect(mockSetConfig).toHaveBeenCalledWith(
      db,
      "remote_mcp_connections",
      expect.arrayContaining([
        expect.objectContaining({
          id: "01TESTREMOTE0000000000000000",
          label: "Figma MCP",
        }),
      ]),
    );
  });

  it("binds credential refs using shared service/auth taxonomy fields", async () => {
    const db: any = {};

    mockGetConfig.mockResolvedValue([
      {
        id: "conn-1",
        label: "Remote MCP",
        serviceType: "mcp_remote",
        serverUrl: "https://mcp.example.com",
        transport: "streamable_http",
        enabled: true,
        createdAt: 10,
        updatedAt: 10,
        credentialRef: null,
      },
    ]);

    const updated = await bindRemoteMcpCredentialRef(db, "conn-1", {
      serviceType: "mcp_remote",
      authType: "oauth",
      providerId: "custom_mcp",
      accountId: "svc-acct-1",
    });

    expect(updated?.credentialRef).toEqual({
      serviceType: "mcp_remote",
      authType: "oauth",
      providerId: "custom_mcp",
      accountId: "svc-acct-1",
    });
  });

  it("rejects credential refs with mismatched service type", async () => {
    const db: any = {};

    mockGetConfig.mockResolvedValue([
      {
        id: "conn-1",
        label: "Remote MCP",
        serviceType: "mcp_remote",
        serverUrl: "https://mcp.example.com",
        transport: "streamable_http",
        enabled: true,
        createdAt: 10,
        updatedAt: 10,
        credentialRef: null,
      },
    ]);

    await expect(
      bindRemoteMcpCredentialRef(db, "conn-1", {
        serviceType: "git_remote",
        authType: "pat",
        accountId: "git-acct-1",
      }),
    ).rejects.toThrow(
      "Credential ref serviceType must match connection serviceType",
    );
  });

  it("lists only valid records from stored config", async () => {
    const db: any = {};

    mockGetConfig.mockResolvedValue([
      {
        id: "conn-1",
        label: "Valid",
        serviceType: "mcp_remote",
        serverUrl: "https://mcp.example.com",
        transport: "streamable_http",
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "bad",
        label: "Invalid",
        serverUrl: "not-a-url",
      },
    ]);

    const list = await listRemoteMcpConnections(db);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("conn-1");
  });

  it("gets and deletes a connection by id", async () => {
    const db: any = {};

    mockGetConfig.mockResolvedValue([
      {
        id: "conn-1",
        label: "Valid",
        serviceType: "mcp_remote",
        serverUrl: "https://mcp.example.com",
        transport: "streamable_http",
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    const found = await getRemoteMcpConnection(db, "conn-1");
    expect(found?.id).toBe("conn-1");

    const deleted = await deleteRemoteMcpConnection(db, "conn-1");
    expect(deleted).toBe(true);
    expect(mockSetConfig).toHaveBeenCalledWith(
      db,
      "remote_mcp_connections",
      [],
    );
  });

  it("defaults autoReconnectOAuth to false on create", async () => {
    const db: any = {};

    const result = await upsertRemoteMcpConnection(db, {
      label: "No Reconnect",
      serverUrl: "https://mcp.example.com",
      transport: "streamable_http",
    });

    expect(result.autoReconnectOAuth).toBe(false);
  });

  it("persists autoReconnectOAuth when set to true", async () => {
    const db: any = {};

    const result = await upsertRemoteMcpConnection(db, {
      label: "Auto Reconnect",
      serverUrl: "https://mcp.example.com",
      transport: "streamable_http",
      autoReconnectOAuth: true,
    });

    expect(result.autoReconnectOAuth).toBe(true);
    expect(mockSetConfig).toHaveBeenCalledWith(
      db,
      "remote_mcp_connections",
      expect.arrayContaining([
        expect.objectContaining({
          autoReconnectOAuth: true,
        }),
      ]),
    );
  });
});
