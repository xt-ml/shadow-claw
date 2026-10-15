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
            actions: [
              "messages.read",
              "messages.send",
              "messages.mark_read",
              "messages.delete",
            ],
            authTypes: ["basic_userpass", "oauth"],
            configurableFields: ["host", "port"],
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
        configurableFields: ["host", "port"],
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

    jest.unstable_mockModule("../../../security/crypto.js", () => ({
      decryptValue: mockDecryptValue,
      encryptValue: mockEncryptValue,
    }));

    jest.unstable_mockModule("../../../subsystems/email/catalog.js", () => ({
      getEmailPluginManifest: mockGetEmailPluginManifest,
      listEmailPluginManifests: mockListEmailPluginManifests,
    }));

    jest.unstable_mockModule(
      "../../../subsystems/email/connections.js",
      () => ({
        bindEmailCredentialRef: mockBindEmailCredentialRef,
        deleteEmailConnection: mockDeleteEmailConnection,
        getEmailConnection: mockGetEmailConnection,
        listEmailConnections: mockListEmailConnections,
        upsertEmailConnection: mockUpsertEmailConnection,
      }),
    );

    jest.unstable_mockModule(
      "../../../subsystems/mcp/mcp-connections.js",
      () => ({
        listRemoteMcpConnections: mockListRemoteMcpConnections,
      }),
    );

    jest.unstable_mockModule(
      "../../../subsystems/accounts/service-accounts.js",
      () => ({
        resolveServiceCredentials: mockResolveServiceCredentials,
      }),
    );

    jest.unstable_mockModule(
      "../../../storage/read-group-file-bytes.js",
      () => ({
        readGroupFileBytes: mockReadGroupFileBytes,
      }),
    );

    jest.unstable_mockModule(
      "../../../storage/write-group-file-bytes.js",
      () => ({
        writeGroupFileBytes: mockWriteGroupFileBytes,
      }),
    );

    jest.unstable_mockModule("../../../storage/group-file-exists.js", () => ({
      groupFileExists: mockGroupFileExists,
    }));

    jest.unstable_mockModule("../../../utils/ulid.js", () => ({
      ulid: mockUlid,
    }));

    const module = await import("./email.js");
    executeManageEmailTool = module.executeManageEmailTool;

    global.fetch = jest.fn() as any;
  });

  it("returns validation error when action is missing", async () => {
    const result = await executeManageEmailTool({} as any, {}, "group-1");
    expect(result).toContain("requires action");
  });

  it("lists plugins, connections and status", async () => {
    const plugins = await executeManageEmailTool(
      {} as any,
      { action: "list_plugins" },
      "group-1",
    );
    expect(plugins).toContain("IMAP");

    mockListEmailConnections.mockResolvedValueOnce([
      {
        id: "conn-1",
        label: "Office 365",
        pluginId: "imap",
        enabled: true,
        config: { host: "outlook.office365.com" },
      },
    ]);

    const connections = await executeManageEmailTool(
      {} as any,
      { action: "list_connections" },
      "group-1",
    );
    expect(connections).toContain("conn-1 (Office 365)");

    mockListEmailConnections.mockResolvedValueOnce([
      {
        id: "conn-1",
        label: "Office 365",
        pluginId: "imap",
        enabled: true,
        config: {},
      },
    ]);

    const status = await executeManageEmailTool(
      {} as any,
      { action: "status" },
      "group-1",
    );
    expect(status).toContain("Configured plugin connections: 1");
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

  it("configure, enable, disable, delete and test connections", async () => {
    const existingConn = {
      id: "conn-cfg",
      label: "Old Label",
      pluginId: "imap",
      enabled: false,
      config: { host: "old.host" },
      credentialRef: {
        username: "user@mail.com",
        encryptedSecret: "enc:oldpw",
      },
    };

    mockGetEmailConnection.mockResolvedValue(existingConn);
    mockUpsertEmailConnection.mockImplementation(
      async (_db: any, val: any) => val,
    );

    // configure
    const cfgResult = await executeManageEmailTool(
      {} as any,
      {
        action: "configure",
        connection_id: "conn-cfg",
        label: "New Label",
        enabled: true,
      },
      "group-1",
    );
    expect(cfgResult).toContain("Integration connection updated: conn-cfg");

    // enable
    const enableResult = await executeManageEmailTool(
      {} as any,
      { action: "enable", connection_id: "conn-cfg" },
      "group-1",
    );
    expect(enableResult).toContain("enabled");

    // disable
    const disableResult = await executeManageEmailTool(
      {} as any,
      { action: "disable", connection_id: "conn-cfg" },
      "group-1",
    );
    expect(disableResult).toContain("disabled");

    // test
    const testResult = await executeManageEmailTool(
      {} as any,
      { action: "test", connection_id: "conn-cfg" },
      "group-1",
    );
    expect(testResult).toContain("passed for conn-cfg");

    // delete
    const deleteResult = await executeManageEmailTool(
      {} as any,
      { action: "delete", connection_id: "conn-cfg" },
      "group-1",
    );
    expect(deleteResult).toContain("Integration connection deleted: conn-cfg");
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

  it("mark_as_read and delete_messages execute flag modifications and delete requests", async () => {
    mockGetEmailConnection.mockResolvedValue({
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

    // mark_as_read missing uids
    const noUidResult = await executeManageEmailTool(
      {} as any,
      { action: "mark_as_read", connection_id: "conn-mark" },
      "group-1",
    );
    expect(noUidResult).toContain("requires message_uids");

    // mark_as_read success
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ updated: [101] }),
    });

    const markResult = await executeManageEmailTool(
      {} as any,
      {
        action: "mark_as_read",
        connection_id: "conn-mark",
        message_uids: [101],
      },
      "group-1",
    );
    expect(markResult).toContain('"updated": [');

    // delete_messages success
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ deleted: [102] }),
    });

    const deleteMsgResult = await executeManageEmailTool(
      {} as any,
      {
        action: "delete_messages",
        connection_id: "conn-mark",
        message_uids: [102],
      },
      "group-1",
    );
    expect(deleteMsgResult).toContain('"deleted": [');
  });

  it("send_message handles missing SMTP host, attachment read failure, and oauth 401 retry", async () => {
    // Missing SMTP host
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-no-smtp",
      pluginId: "imap",
      enabled: true,
      config: {},
      credentialRef: {
        authType: "basic_userpass",
        encryptedSecret: "enc:pw",
        username: "user@example.com",
      },
    });

    const noSmtpResult = await executeManageEmailTool(
      {} as any,
      {
        action: "send_message",
        connection_id: "conn-no-smtp",
        to: ["a@b.com"],
        subject: "Test",
        body: "Hello",
      },
      "group-1",
    );
    expect(noSmtpResult).toContain("missing SMTP host");

    // Attachment read error
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-att-fail",
      pluginId: "imap",
      enabled: true,
      config: { smtpHost: "smtp.example.com" },
      credentialRef: {
        authType: "basic_userpass",
        encryptedSecret: "enc:pw",
        username: "user@example.com",
      },
    });
    mockReadGroupFileBytes.mockRejectedValueOnce(new Error("File not found"));

    const attFailResult = await executeManageEmailTool(
      {} as any,
      {
        action: "send_message",
        connection_id: "conn-att-fail",
        to: ["a@b.com"],
        subject: "Test",
        body: "Hello",
        attachments: ["missing.txt"],
      },
      "group-1",
    );
    expect(attFailResult).toContain(
      "Attachment file not found or unreadable: missing.txt",
    );

    // OAuth 401 retry
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-oauth-send",
      pluginId: "imap",
      enabled: true,
      config: { smtpHost: "smtp.example.com" },
      credentialRef: {
        authType: "oauth",
        accountId: "acct-send",
        providerId: "google",
        username: "user@example.com",
      },
    });
    mockResolveServiceCredentials
      .mockResolvedValueOnce({ token: "token-s1" })
      .mockResolvedValueOnce({ token: "token-s2" });

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
        json: async () => ({ sent: true, refreshed: true }),
      });

    const retrySendResult = await executeManageEmailTool(
      {} as any,
      {
        action: "send_message",
        connection_id: "conn-oauth-send",
        to: ["target@example.com"],
        subject: "Test",
        body: "Hello",
      },
      "group-1",
    );
    expect(retrySendResult).toContain('"refreshed": true');
  });

  it("download_attachments handles missing IMAP host, oauth 401 retry, and failed response", async () => {
    // Missing IMAP host
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-no-imap",
      pluginId: "imap",
      enabled: true,
      config: {},
      credentialRef: {
        authType: "basic_userpass",
        encryptedSecret: "enc:pw",
        username: "user@example.com",
      },
    });

    const noImapResult = await executeManageEmailTool(
      {} as any,
      {
        action: "download_attachments",
        connection_id: "conn-no-imap",
        message_uid: 10,
      },
      "group-1",
    );
    expect(noImapResult).toContain("missing IMAP host");

    // OAuth 401 retry & download failure response
    mockGetEmailConnection.mockResolvedValue({
      id: "conn-oauth-dl",
      pluginId: "imap",
      enabled: true,
      config: { host: "imap.example.com" },
      credentialRef: {
        authType: "oauth",
        accountId: "acct-dl",
        providerId: "google",
        username: "user@example.com",
      },
    });
    mockResolveServiceCredentials
      .mockResolvedValueOnce({ token: "token-dl1" })
      .mockResolvedValueOnce({ token: "token-dl2" });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "unauthorized" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({ error: "disk error" }),
      });

    const failDlResult = await executeManageEmailTool(
      {} as any,
      {
        action: "download_attachments",
        connection_id: "conn-oauth-dl",
        message_uid: 10,
      },
      "group-1",
    );
    expect(failDlResult).toContain(
      "IMAP attachment download failed (500): disk error",
    );
  });

  it("mark_as_read handles oauth 401 retry and failed response", async () => {
    mockGetEmailConnection.mockResolvedValue({
      id: "conn-oauth-mark",
      pluginId: "imap",
      enabled: true,
      config: { host: "imap.example.com" },
      credentialRef: {
        authType: "oauth",
        accountId: "acct-mark",
        providerId: "google",
        username: "user@example.com",
      },
    });
    mockResolveServiceCredentials
      .mockResolvedValueOnce({ token: "token-m1" })
      .mockResolvedValueOnce({ token: "token-m2" });

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "unauthorized" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "invalid uids" }),
      });

    const failMarkResult = await executeManageEmailTool(
      {} as any,
      {
        action: "mark_as_read",
        connection_id: "conn-oauth-mark",
        message_uids: [999],
      },
      "group-1",
    );
    expect(failMarkResult).toContain("IMAP modify failed (400): invalid uids");

    // Plugin doesn't support messages.read
    mockGetEmailPluginManifest.mockReturnValueOnce({
      id: "imap",
      name: "IMAP",
      actions: ["messages.send"],
    });
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-unsupported",
      pluginId: "imap",
      enabled: true,
      config: { host: "imap.example.com" },
      credentialRef: {
        authType: "basic_userpass",
        username: "u",
        encryptedSecret: "enc:pw",
      },
    });
    const unsuppResult = await executeManageEmailTool(
      {} as any,
      {
        action: "mark_as_read",
        connection_id: "conn-unsupported",
        message_uids: [1],
      },
      "group-1",
    );
    expect(unsuppResult).toContain("does not support inbox message updates");

    // Missing IMAP host in mark_as_read
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-no-host",
      pluginId: "imap",
      enabled: true,
      config: {},
      credentialRef: {
        authType: "basic_userpass",
        username: "u",
        encryptedSecret: "enc:pw",
      },
    });
    const noHostResult = await executeManageEmailTool(
      {} as any,
      {
        action: "mark_as_read",
        connection_id: "conn-no-host",
        message_uids: [1],
      },
      "group-1",
    );
    expect(noHostResult).toContain("missing IMAP host");

    // OAuth 401 retry where refreshedAuth returns an error string
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-oauth-fail-refresh",
      pluginId: "imap",
      enabled: true,
      config: { host: "imap.example.com" },
      credentialRef: {
        authType: "oauth",
        accountId: "acc-refresh",
        username: "u",
      },
    });
    mockResolveServiceCredentials
      .mockResolvedValueOnce({ token: "initial-token" })
      .mockResolvedValueOnce(null); // Second resolve fails
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    });
    const refreshFailResult = await executeManageEmailTool(
      {} as any,
      {
        action: "mark_as_read",
        connection_id: "conn-oauth-fail-refresh",
        message_uids: [1],
      },
      "group-1",
    );
    expect(refreshFailResult).toContain("OAuth account reconnect required");
  });

  it("download_attachments validates missing uid, disabled connection, and not found", async () => {
    // Missing uid
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-uid",
      pluginId: "imap",
      enabled: true,
      config: {},
    });
    const noUid = await executeManageEmailTool(
      {} as any,
      { action: "download_attachments", connection_id: "conn-uid" },
      "group-1",
    );
    expect(noUid).toContain("requires message_uid");

    // Disabled connection
    mockGetEmailConnection.mockResolvedValueOnce({
      id: "conn-disabled",
      pluginId: "imap",
      enabled: false,
      config: {},
    });
    const disabledRes = await executeManageEmailTool(
      {} as any,
      {
        action: "download_attachments",
        connection_id: "conn-disabled",
        message_uid: 1,
      },
      "group-1",
    );
    expect(disabledRes).toContain("is disabled");

    // Not found
    mockGetEmailConnection.mockResolvedValueOnce(null);
    mockListEmailConnections.mockResolvedValueOnce([]);
    const notFoundRes = await executeManageEmailTool(
      {} as any,
      {
        action: "download_attachments",
        connection_id: "conn-missing",
        message_uid: 1,
      },
      "group-1",
    );
    expect(notFoundRes).toContain(
      "Integration connection not found: conn-missing",
    );
  });

  it("returns error on unsupported manage_email action", async () => {
    const result = await executeManageEmailTool(
      {} as any,
      { action: "unknown_action" },
      "group-1",
    );
    expect(result).toBe(
      "Error: Unsupported manage_email action: unknown_action",
    );
  });

  it("parses email attachment inputs and guesses mime types correctly", async () => {
    const { asEmailAttachmentInputs } =
      await import("./utils/as-email-attachment-inputs.js");
    const { guessMimeTypeFromFilename } =
      await import("../../../utils/mime.js");

    // asEmailAttachmentInputs
    expect(asEmailAttachmentInputs(null)).toEqual([]);
    expect(
      asEmailAttachmentInputs([
        "file1.txt",
        "   ",
        {
          path: "file2.pdf",
          filename: "doc.pdf",
          content_type: "application/pdf",
        },
        { path: "" },
        123,
      ]),
    ).toEqual([
      { path: "file1.txt" },
      {
        path: "file2.pdf",
        filename: "doc.pdf",
        contentType: "application/pdf",
      },
    ]);

    // guessMimeTypeFromFilename
    expect(guessMimeTypeFromFilename("photo.png")).toBe("image/png");
    expect(guessMimeTypeFromFilename("photo.jpg")).toBe("image/jpeg");
    expect(guessMimeTypeFromFilename("photo.jpeg")).toBe("image/jpeg");
    expect(guessMimeTypeFromFilename("anim.gif")).toBe("image/gif");
    expect(guessMimeTypeFromFilename("pic.webp")).toBe("image/webp");
    expect(guessMimeTypeFromFilename("doc.pdf")).toBe("application/pdf");
    expect(guessMimeTypeFromFilename("notes.txt")).toBe("text/plain");
    expect(guessMimeTypeFromFilename("readme.md")).toBe("text/plain");
    expect(guessMimeTypeFromFilename("archive.zip")).toBeUndefined();
  });
});
