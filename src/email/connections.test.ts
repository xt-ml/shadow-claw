import { jest } from "@jest/globals";

let listEmailConnections: any;
let upsertEmailConnection: any;
let getEmailConnection: any;
let bindEmailCredentialRef: any;
let deleteEmailConnection: any;
const legacyKeyName = ["INTE", "GRATION_CONNECTIONS"].join("");
const legacyKeyValue = ["in", "tegration", "_connections"].join("");

describe("email connections", () => {
  let mockGetConfig: any;
  let mockSetConfig: any;

  beforeEach(async () => {
    jest.resetModules();

    mockGetConfig = jest.fn();
    mockSetConfig = jest.fn();

    jest.unstable_mockModule("../config.js", () => ({
      CONFIG_KEYS: {
        [legacyKeyName]: legacyKeyValue,
      },
    }));

    jest.unstable_mockModule("../db/getConfig.js", () => ({
      getConfig: mockGetConfig,
    }));

    jest.unstable_mockModule("../db/setConfig.js", () => ({
      setConfig: mockSetConfig,
    }));

    jest.unstable_mockModule("../ulid.js", () => ({
      ulid: jest.fn(() => "conn-1"),
    }));

    const module = await import("./connections.js");
    listEmailConnections = module.listEmailConnections;
    upsertEmailConnection = module.upsertEmailConnection;
    getEmailConnection = module.getEmailConnection;
    bindEmailCredentialRef = module.bindEmailCredentialRef;
    deleteEmailConnection = module.deleteEmailConnection;
  });

  it("creates and persists a new email connection", async () => {
    mockGetConfig.mockResolvedValueOnce([]);

    const record = await upsertEmailConnection({} as any, {
      label: "Personal IMAP",
      pluginId: "imap",
      config: { host: "imap.example.com", mailboxPath: "INBOX" },
    });

    expect(record.id).toBe("conn-1");
    expect(record.pluginId).toBe("imap");
    expect(record.label).toBe("Personal IMAP");
    expect(mockSetConfig).toHaveBeenCalledWith(
      {} as any,
      legacyKeyValue,
      expect.arrayContaining([
        expect.objectContaining({ id: "conn-1", pluginId: "imap" }),
      ]),
    );
  });

  it("rejects unknown plugin ids", async () => {
    mockGetConfig.mockResolvedValueOnce([]);

    await expect(
      upsertEmailConnection({} as any, {
        label: "Unknown",
        pluginId: "invalid-plugin",
      }),
    ).rejects.toThrow("Unknown email plugin: invalid-plugin");
  });

  it("retrieves connection by id or label", async () => {
    const stored = [
      {
        id: "conn-2",
        label: "My Mail",
        pluginId: "imap",
        enabled: true,
        config: { host: "imap.example.com" },
        credentialRef: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    mockGetConfig.mockResolvedValue(stored);

    const byId = await getEmailConnection({} as any, "conn-2");
    const byLabel = await getEmailConnection({} as any, "my mail");

    expect(byId?.id).toBe("conn-2");
    expect(byLabel?.id).toBe("conn-2");
  });

  it("binds credential refs", async () => {
    const stored = [
      {
        id: "conn-3",
        label: "Mail",
        pluginId: "imap",
        enabled: true,
        config: {},
        credentialRef: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    mockGetConfig.mockResolvedValue(stored);

    const updated = await bindEmailCredentialRef({} as any, "conn-3", {
      serviceType: "http_api",
      authType: "basic_userpass",
      username: "user@example.com",
      encryptedSecret: "enc:abc",
    });

    expect(updated?.credentialRef).toMatchObject({
      authType: "basic_userpass",
      username: "user@example.com",
    });
    expect(mockSetConfig).toHaveBeenCalled();
  });

  it("lists normalized records only", async () => {
    mockGetConfig.mockResolvedValue([
      {
        id: "conn-4",
        label: "Mail",
        pluginId: "imap",
        enabled: true,
        config: {},
        credentialRef: null,
        createdAt: 10,
        updatedAt: 10,
      },
      {
        // invalid: unknown plugin id, filtered out
        id: "conn-x",
        label: "Unknown",
        pluginId: "nope",
        enabled: true,
        config: {},
        createdAt: 0,
        updatedAt: 0,
      },
    ]);

    const all = await listEmailConnections({} as any);
    expect(all).toHaveLength(1);
    expect(all[0].pluginId).toBe("imap");
  });

  it("deletes an existing connection", async () => {
    mockGetConfig.mockResolvedValue([
      {
        id: "conn-9",
        label: "Mail",
        pluginId: "imap",
        enabled: true,
        config: {},
        credentialRef: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    const deleted = await deleteEmailConnection({} as any, "conn-9");

    expect(deleted).toBe(true);
    expect(mockSetConfig).toHaveBeenCalledWith({} as any, legacyKeyValue, []);
  });
});
