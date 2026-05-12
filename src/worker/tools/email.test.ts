// @ts-nocheck
import { jest } from "@jest/globals";

let executeManageEmailTool: any;

describe("worker/tools/email", () => {
  let mockDecryptValue: any;
  let mockEncryptValue: any;
  let mockGetEmailPluginManifest: any;
  let mockListEmailPluginManifests: any;
  let mockBindEmailCredentialRef: any;
  let mockDeleteEmailConnection: any;
  let mockGetEmailConnection: any;
  let mockListEmailConnections: any;
  let mockUpsertEmailConnection: any;
  let mockListRemoteMcpConnections: any;
  let mockResolveServiceCredentials: any;
  let mockReadGroupFileBytes: any;
  let mockWriteGroupFileBytes: any;
  let mockGroupFileExists: any;
  let mockUlid: any;

  beforeEach(async () => {
    jest.resetModules();

    mockDecryptValue = jest.fn(async () => "pw");
    mockEncryptValue = jest.fn(async (value: string) => `enc:${value}`);
    mockGetEmailPluginManifest = jest.fn((id: string) =>
      id === "imap"
        ? {
            id: "imap",
            name: "IMAP",
            protocol: "imap",
            actions: ["messages.read", "messages.send"],
            authTypes: ["basic_userpass", "oauth"],
            configurableFields: [],
          }
        : null,
    );
    mockListEmailPluginManifests = jest.fn(() => [
      {
        id: "imap",
        name: "IMAP",
        protocol: "imap",
        actions: ["messages.read", "messages.send"],
        authTypes: ["basic_userpass", "oauth"],
        configurableFields: [],
      },
    ]);
    mockBindEmailCredentialRef = jest.fn();
    mockDeleteEmailConnection = jest.fn(async () => true);
    mockGetEmailConnection = jest.fn();
    mockListEmailConnections = jest.fn(async () => []);
    mockUpsertEmailConnection = jest.fn();
    mockListRemoteMcpConnections = jest.fn(async () => []);
    mockResolveServiceCredentials = jest.fn();
    mockReadGroupFileBytes = jest.fn();
    mockWriteGroupFileBytes = jest.fn();
    mockGroupFileExists = jest.fn(async () => false);
    mockUlid = jest.fn(() => "mock-ulid");

    jest.unstable_mockModule("../../crypto.js", () => ({
      decryptValue: mockDecryptValue,
      encryptValue: mockEncryptValue,
    }));

    jest.unstable_mockModule("../../email/catalog.js", () => ({
      getEmailPluginManifest: mockGetEmailPluginManifest,
      listEmailPluginManifests: mockListEmailPluginManifests,
    }));

    jest.unstable_mockModule("../../email/connections.js", () => ({
      bindEmailCredentialRef: mockBindEmailCredentialRef,
      deleteEmailConnection: mockDeleteEmailConnection,
      getEmailConnection: mockGetEmailConnection,
      listEmailConnections: mockListEmailConnections,
      upsertEmailConnection: mockUpsertEmailConnection,
    }));

    jest.unstable_mockModule("../../mcp-connections.js", () => ({
      listRemoteMcpConnections: mockListRemoteMcpConnections,
    }));

    jest.unstable_mockModule("../../accounts/service-accounts.js", () => ({
      resolveServiceCredentials: mockResolveServiceCredentials,
    }));

    jest.unstable_mockModule("../../storage/readGroupFileBytes.js", () => ({
      readGroupFileBytes: mockReadGroupFileBytes,
    }));

    jest.unstable_mockModule("../../storage/writeGroupFileBytes.js", () => ({
      writeGroupFileBytes: mockWriteGroupFileBytes,
    }));

    jest.unstable_mockModule("../../storage/groupFileExists.js", () => ({
      groupFileExists: mockGroupFileExists,
    }));

    jest.unstable_mockModule("../../ulid.js", () => ({
      ulid: mockUlid,
    }));

    const module = await import("./email.js");
    executeManageEmailTool = module.executeManageEmailTool;

    global.fetch = jest.fn();
  });

  it("returns validation error when action is missing", async () => {
    const result = await executeManageEmailTool({} as any, {}, "group-1");

    expect(result).toContain("requires action");
  });

  it("connect stores encrypted basic credentials", async () => {
    mockUpsertEmailConnection.mockResolvedValueOnce({
      id: "conn-1",
      label: "My Mail",
      pluginId: "imap",
    });

    const result = await executeManageEmailTool(
      {} as any,
      {
        action: "connect",
        label: "My Mail",
        plugin_id: "imap",
        username: "user@example.com",
        password: "secret",
      },
      "group-1",
    );

    expect(mockUpsertEmailConnection).toHaveBeenCalled();
    expect(mockEncryptValue).toHaveBeenCalledWith("secret");
    expect(mockBindEmailCredentialRef).toHaveBeenCalledWith(
      {} as any,
      "conn-1",
      expect.objectContaining({
        authType: "basic_userpass",
        username: "user@example.com",
        encryptedSecret: "enc:secret",
      }),
    );
    expect(result).toContain("Email connection created: conn-1");
  });

  it("read_messages retries once after oauth 401", async () => {
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-oauth",
      pluginId: "imap",
      enabled: true,
      config: { host: "imap.example.com", port: 993, secure: true },
      credentialRef: {
        authType: "oauth",
        accountId: "acct-1",
        providerId: "google",
        username: "user@example.com",
      },
    });

    mockResolveServiceCredentials
      .mockResolvedValueOnce({ token: "token-1" })
      .mockResolvedValueOnce({ token: "token-2" });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "unauthorized" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ messages: [] }),
      });

    const result = await executeManageEmailTool(
      {} as any,
      {
        action: "read_messages",
        connection_id: "conn-oauth",
      },
      "group-1",
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((global.fetch as any).mock.calls[1][1].body);
    expect(secondBody.accessToken).toBe("token-2");
    expect(result).toContain('"messages": []');
  });

  it("send_message encodes attachments and posts SMTP payload", async () => {
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-basic",
      pluginId: "imap",
      enabled: true,
      config: {
        smtpHost: "smtp.example.com",
        smtpPort: 587,
        smtpSecure: false,
      },
      credentialRef: {
        authType: "basic_userpass",
        encryptedSecret: "enc:pw",
        username: "sender@example.com",
      },
    });

    mockReadGroupFileBytes.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ sent: true }),
    });

    const result = await executeManageEmailTool(
      {} as any,
      {
        action: "send_message",
        connection_id: "conn-basic",
        to: ["dest@example.com"],
        subject: "Hello",
        body: "Body",
        attachments: ["docs/a.txt"],
      },
      "group-1",
    );

    const payload = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].contentBase64).toBe("AQID");
    expect(result).toContain('"sent": true');
  });

  it("download_attachments writes files into group storage", async () => {
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-dl",
      pluginId: "imap",
      enabled: true,
      config: {
        host: "imap.example.com",
        port: 993,
        secure: true,
      },
      credentialRef: {
        authType: "basic_userpass",
        encryptedSecret: "enc:pw",
        username: "user@example.com",
      },
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mailbox: "INBOX",
        attachments: [{ filename: "x.txt", contentBase64: "AQID" }],
      }),
    });

    const result = await executeManageEmailTool(
      {} as any,
      {
        action: "download_attachments",
        connection_id: "conn-dl",
        message_uid: 7,
      },
      "group-1",
    );

    expect(mockWriteGroupFileBytes).toHaveBeenCalledWith(
      {} as any,
      "group-1",
      "downloads/email/x.txt",
      expect.any(Uint8Array),
    );

    const parsed = JSON.parse(result);
    expect(parsed.downloaded_count).toBe(1);
    expect(parsed.saved_paths).toEqual(["downloads/email/x.txt"]);
  });

  it("mark_as_read validates message_uids", async () => {
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-mark",
      pluginId: "imap",
      enabled: true,
      config: { host: "imap.example.com", port: 993, secure: true },
      credentialRef: {
        authType: "basic_userpass",
        encryptedSecret: "enc:pw",
        username: "user@example.com",
      },
    });

    const result = await executeManageEmailTool(
      {} as any,
      {
        action: "mark_as_read",
        connection_id: "conn-mark",
      },
      "group-1",
    );

    expect(result).toContain("requires message_uids");
  });
});
