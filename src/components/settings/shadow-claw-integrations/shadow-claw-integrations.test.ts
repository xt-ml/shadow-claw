import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../config/config.js", () => ({
  CONFIG_KEYS: {
    EMAIL_CONNECTIONS: "email_connections",
    SERVICE_ACCOUNTS: "service_accounts",
  },
}));

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({}),
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue([]),
}));

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../subsystems/email/catalog.js", () => ({
  getEmailPluginManifest: jest.fn<any>().mockReturnValue(null),
  listEmailPluginManifests: jest.fn<any>().mockReturnValue([]),
}));

jest.unstable_mockModule("../../../subsystems/email/connections.js", () => ({
  listEmailConnections: jest.fn<any>().mockResolvedValue([]),
  upsertEmailConnection: jest.fn<any>().mockResolvedValue({ id: "conn-1" }),
  deleteEmailConnection: jest.fn<any>().mockResolvedValue(undefined),
  bindEmailCredentialRef: jest.fn<any>().mockResolvedValue(null),
}));

jest.unstable_mockModule("../../../security/crypto.js", () => ({
  encryptValue: jest.fn<any>().mockResolvedValue("encrypted"),
}));

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
}));

jest.unstable_mockModule("../../../utils/ulid.js", () => ({
  ulid: jest.fn(() => "test-id"),
}));

jest.unstable_mockModule("./connection-test-auth.js", () => ({
  resolveConnectionTestAuth: jest
    .fn<any>()
    .mockReturnValue({ error: "no auth" }),
}));

jest.unstable_mockModule("../../../security/trusted-types.js", () => ({
  sanitizeToTrustedHtml: jest.fn((html: string) => html),
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
  toTrustedHtmlPresanitized: jest.fn((html: string) => html),
  toTrustedScriptUrl: jest.fn((url: string) => url),
}));

const { setSanitizedHtml } = await import("../../../security/trusted-types.js");
const { getEmailPluginManifest } =
  await import("../../../subsystems/email/catalog.js");
const { ShadowClawIntegrations } =
  await import("./shadow-claw-integrations.js");

describe("shadow-claw-integrations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-integrations")).toBe(
      ShadowClawIntegrations,
    );
  });

  it("routes renderConnectionList card.innerHTML through the Trusted Types helper", async () => {
    const { listEmailConnections } =
      await import("../../../subsystems/email/connections.js");
    (listEmailConnections as jest.Mock<any>).mockResolvedValue([
      {
        id: "conn-1",
        label: "My IMAP",
        pluginId: "imap",
        enabled: true,
        config: { executionMode: "manual" },
        credentialRef: null,
      },
    ]);

    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    (setSanitizedHtml as jest.Mock).mockClear();

    await el.renderConnectionList();

    expect(setSanitizedHtml).toHaveBeenCalledWith(
      expect.any(Element),
      expect.stringContaining("My IMAP"),
    );

    document.body.removeChild(el);
  });

  it("routes showForm slot.innerHTML through the Trusted Types helper", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.render();

    (setSanitizedHtml as jest.Mock).mockClear();

    el.showForm(null);

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;

    expect(setSanitizedHtml).toHaveBeenCalledWith(
      slot,
      expect.stringContaining("Add Email Connection"),
    );

    document.body.removeChild(el);
  });

  it("resolves IMAP presets correctly", () => {
    const el = new ShadowClawIntegrations();
    expect(el.resolveImapPreset("gmail", "test@anything.com")).toBeTruthy();
    expect(el.resolveImapPreset("auto", "test@gmail.com")?.imapHost).toBe(
      "imap.gmail.com",
    );
    expect(el.resolveImapPreset("auto", "test@outlook.com")?.imapHost).toBe(
      "outlook.office365.com",
    );
    expect(el.resolveImapPreset("auto", "test@yahoo.com")?.imapHost).toBe(
      "imap.mail.yahoo.com",
    );
    expect(el.resolveImapPreset("auto", "test@icloud.com")?.imapHost).toBe(
      "imap.mail.me.com",
    );
    expect(el.resolveImapPreset("auto", "test@fastmail.com")?.imapHost).toBe(
      "imap.fastmail.com",
    );
    expect(el.resolveImapPreset("auto", "test@unknown.com")).toBeNull();
  });

  it("gets Email OAuth Provider correctly", () => {
    const el = new ShadowClawIntegrations();
    expect(el.getEmailOAuthProvider("google").id).toBe("google");
    expect(el.getEmailOAuthProvider("microsoft_graph").id).toBe(
      "microsoft_graph",
    );
    expect(el.getEmailOAuthProvider("yahoo_mail").id).toBe("yahoo_mail");
    expect(el.getEmailOAuthProvider("unknown_provider").id).toBe("google");
  });

  it("updates Auth Mode Visibility", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.showForm(null);

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;
    const authModeSelect = slot.querySelector(
      "#int-auth-mode",
    ) as HTMLSelectElement;

    if (authModeSelect) {
      authModeSelect.value = "oauth";
      authModeSelect.dispatchEvent(new Event("change"));

      const passwordFields = slot.querySelector(
        '[data-region="password-auth-fields"]',
      ) as HTMLElement;
      const oauthFields = slot.querySelector(
        '[data-region="oauth-auth-fields"]',
      ) as HTMLElement;

      expect(passwordFields.style.display).toBe("none");
      expect(oauthFields.style.display).toBe("block");
    }

    document.body.removeChild(el);
  });

  it("applies IMAP preset to form", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();

    el.manifests = [
      {
        id: "imap",
        name: "IMAP",
        configurableFields: [
          "host",
          "port",
          "secure",
          "smtpHost",
          "smtpPort",
          "smtpSecure",
        ],
        description: "",
      } as any,
    ];
    (getEmailPluginManifest as jest.Mock).mockReturnValue(el.manifests[0]);
    el.showForm(null);

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;
    const usernameInput = slot.querySelector(
      "#int-username",
    ) as HTMLInputElement;
    if (usernameInput) usernameInput.value = "test@gmail.com";

    const presetSelect = slot.querySelector(
      "#int-imap-preset",
    ) as HTMLSelectElement;
    if (presetSelect) presetSelect.value = "auto";

    el.applyImapPreset(slot);

    const hostInput = slot.querySelector("#cfg-host") as HTMLInputElement;
    if (hostInput) expect(hostInput.value).toBe("imap.gmail.com");

    document.body.removeChild(el);
  });

  it("builds credential ref for password auth", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();

    el.manifests = [
      {
        id: "imap",
        name: "IMAP",
        configurableFields: [],
        description: "",
      } as any,
    ];
    (getEmailPluginManifest as jest.Mock).mockReturnValue(el.manifests[0]);
    el.showForm(null);

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;
    const authModeSelect = slot.querySelector(
      "#int-auth-mode",
    ) as HTMLSelectElement;
    if (authModeSelect) authModeSelect.value = "basic_userpass";

    const usernameInput = slot.querySelector(
      "#int-username",
    ) as HTMLInputElement;
    if (usernameInput) usernameInput.value = "test@example.com";

    const passwordInput = slot.querySelector(
      "#int-password",
    ) as HTMLInputElement;
    if (passwordInput) passwordInput.value = "password123";

    const ref = await el.buildCredentialRef(slot, {} as any);
    expect(ref).toEqual({
      serviceType: "http_api",
      authType: "basic_userpass",
      username: "test@example.com",
      encryptedSecret: "encrypted",
    });

    document.body.removeChild(el);
  });
  it("deletes connection", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();

    el.connections = [
      {
        id: "conn-1",
        label: "My IMAP",
        pluginId: "imap",
        enabled: true,
        config: {},
      },
    ] as any;
    el.db = {} as any;
    el.requestConfirmation = jest.fn<any>().mockResolvedValue(true);

    await el.deleteConnection("conn-1");

    const { deleteEmailConnection } =
      await import("../../../subsystems/email/connections.js");
    expect(deleteEmailConnection).toHaveBeenCalledWith(el.db, "conn-1");

    document.body.removeChild(el);
  });

  it("toggles connection", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();

    el.connections = [
      {
        id: "conn-1",
        label: "My IMAP",
        pluginId: "imap",
        enabled: true,
        config: {},
      },
    ] as any;
    el.db = {} as any;

    await el.toggleConnection("conn-1");

    const { upsertEmailConnection } =
      await import("../../../subsystems/email/connections.js");
    expect(upsertEmailConnection).toHaveBeenCalledWith(
      el.db,
      expect.objectContaining({
        id: "conn-1",
        enabled: false,
      }),
    );

    document.body.removeChild(el);
  });

  it("saves form", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();

    el.manifests = [
      {
        id: "imap",
        name: "IMAP",
        configurableFields: ["host"],
        description: "",
      } as any,
    ];
    (getEmailPluginManifest as jest.Mock).mockReturnValue(el.manifests[0]);
    el.showForm(null);

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;

    const labelInput = slot.querySelector("#int-label") as HTMLInputElement;
    if (labelInput) labelInput.value = "New IMAP";

    const modeInput = slot.querySelector("#int-mode") as HTMLSelectElement;
    if (modeInput) modeInput.value = "auto";

    const pollInput = slot.querySelector("#int-poll") as HTMLInputElement;
    if (pollInput) pollInput.value = "60";

    const hostInput = slot.querySelector("#cfg-host") as HTMLInputElement;
    if (hostInput) hostInput.value = "imap.test.com";

    el.db = {} as any;
    el.editingConnectionId = null;

    el.buildCredentialRef = jest.fn<any>().mockResolvedValue({});

    await el.saveForm();

    const { upsertEmailConnection, bindEmailCredentialRef } =
      await import("../../../subsystems/email/connections.js");
    expect(upsertEmailConnection).toHaveBeenCalled();
    expect(bindEmailCredentialRef).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("handles testConnectionFromForm with success and error responses", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();

    el.manifests = [
      {
        id: "imap",
        name: "IMAP",
        configurableFields: ["host", "port", "mailboxPath"],
        description: "",
      } as any,
    ];
    (getEmailPluginManifest as jest.Mock).mockReturnValue(el.manifests[0]);
    el.showForm(null);

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;

    const userInput = slot.querySelector("#int-username") as HTMLInputElement;
    if (userInput) userInput.value = "user@test.com";

    const hostInput = slot.querySelector("#cfg-host") as HTMLInputElement;
    if (hostInput) hostInput.value = "imap.test.com";

    const passInput = slot.querySelector("#int-password") as HTMLInputElement;
    if (passInput) passInput.value = "secret-pass";

    const { resolveConnectionTestAuth } =
      await import("./connection-test-auth.js");
    (resolveConnectionTestAuth as jest.Mock<any>).mockReturnValue({
      authType: "basic_userpass",
      password: "secret-pass",
    });

    // Mock fetch for /integrations/email/read success
    (global.fetch as any) = (jest.fn() as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ count: 5 }),
    });

    await el.testConnectionFromForm(slot);
    expect(global.fetch).toHaveBeenCalledWith(
      "/integrations/email/read",
      expect.objectContaining({ method: "POST" }),
    );

    // Mock fetch for failure
    (global.fetch as any) = (jest.fn() as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "Auth failed" }),
    });

    await el.testConnectionFromForm(slot);

    // Toggle connection test
    el.connections = [
      {
        id: "conn-1",
        label: "My IMAP",
        pluginId: "imap",
        enabled: true,
        config: {},
        credentialRef: null,
        createdAt: 0,
        updatedAt: 0,
      } as any,
    ];
    const { upsertEmailConnection } =
      await import("../../../subsystems/email/connections.js");
    await el.toggleConnection("conn-1");
    expect(upsertEmailConnection).toHaveBeenCalledWith(
      el.db,
      expect.objectContaining({
        id: "conn-1",
        enabled: false,
      }),
    );

    // OAuth connect from form tests
    const oauthSlot = document.createElement("div");
    oauthSlot.innerHTML = `
      <select id="int-oauth-provider"><option value="google">Google</option></select>
      <input id="int-oauth-client-id" value="client-id-123" />
      <input id="int-oauth-client-secret" value="secret-xyz" />
      <input id="int-oauth-scope" value="https://mail.google.com/" />
      <div data-region="oauth-status"></div>
      <button data-action="connect-oauth"></button>
    `;
    el.shadowRoot?.appendChild(oauthSlot);

    (global.fetch as any) = jest.fn<any>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authUrl: "https://accounts.google.com/o/oauth2/auth",
      }),
    });

    const windowOpenSpy = jest
      .spyOn(window, "open")
      .mockImplementation(() => null);
    await el.connectOAuthFromForm(oauthSlot);
    expect(global.fetch).toHaveBeenCalledWith(
      "/oauth/authorize",
      expect.objectContaining({ method: "POST" }),
    );
    windowOpenSpy.mockRestore();

    document.body.removeChild(el);
  });

  it("connectOAuthFromForm handles successful OAuth flow through polling and token exchange", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();

    const oauthSlot = document.createElement("div");
    oauthSlot.innerHTML = `
      <select id="int-oauth-provider"><option value="google" selected>Google</option></select>
      <input id="int-oauth-client-id" value="client-id-123" />
      <input id="int-oauth-client-secret" value="secret-xyz" />
      <input id="int-oauth-scope" value="https://mail.google.com/" />
      <div data-region="oauth-status"></div>
      <button data-action="connect-oauth"></button>
    `;
    el.shadowRoot?.appendChild(oauthSlot);

    (global.fetch as any) = jest.fn((url: string) => {
      if (url === "/oauth/authorize") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            state: "state-123",
            authorizeUrl:
              "https://accounts.google.com/o/oauth2/auth?state=state-123",
          }),
        });
      }
      if (url.startsWith("/oauth/session/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "authorized" }),
        });
      }
      if (url === "/oauth/token") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: "test-access-token",
            refreshToken: "test-refresh-token",
            expiresIn: 3600,
            scope: "mail.read",
            tokenType: "Bearer",
          }),
        });
      }
      return Promise.reject(new Error("Unknown URL: " + url));
    });

    const windowOpenSpy = jest
      .spyOn(window, "open")
      .mockImplementation(() => null);
    await el.connectOAuthFromForm(oauthSlot);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2/auth?state=state-123",
      expect.any(String),
      expect.any(String),
    );
    expect(el.pendingOauthResult).toEqual(
      expect.objectContaining({
        providerId: "google",
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
      }),
    );
    expect(
      oauthSlot.querySelector('[data-region="oauth-status"]')?.textContent,
    ).toBe("OAuth connected");

    // Also test missing client ID
    (
      oauthSlot.querySelector("#int-oauth-client-id") as HTMLInputElement
    ).value = "";
    await el.connectOAuthFromForm(oauthSlot);

    windowOpenSpy.mockRestore();
    document.body.removeChild(el);
  });

  it("upsertLinkedOAuthAccount handles full account linking and validation errors", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    const savedConn = {
      id: "conn-1",
      label: "My IMAP",
      pluginId: "imap",
      enabled: true,
      config: {},
      credentialRef: null,
      createdAt: 0,
      updatedAt: 0,
    } as any;

    const slot = document.createElement("div");
    slot.innerHTML = `
      <select id="int-auth-mode"><option value="oauth" selected>OAuth</option></select>
      <input id="int-username" value="user@gmail.com" />
      <select id="int-oauth-provider"><option value="google" selected>Google</option></select>
      <input id="int-oauth-client-id" value="client-id-123" />
      <input id="int-oauth-client-secret" value="secret-xyz" />
      <input id="int-oauth-scope" value="https://mail.google.com/" />
    `;

    // 1. Missing token without pendingOauthResult throws
    el.pendingOauthResult = null;
    await expect(el.upsertLinkedOAuthAccount(slot, savedConn)).rejects.toThrow(
      "Connect OAuth first to obtain an access token.",
    );

    // 2. Missing username throws
    (slot.querySelector("#int-username") as HTMLInputElement).value = "";
    await expect(el.upsertLinkedOAuthAccount(slot, savedConn)).rejects.toThrow(
      "Email login address is required for OAuth authentication.",
    );
    (slot.querySelector("#int-username") as HTMLInputElement).value =
      "user@gmail.com";

    // 3. Missing client ID throws
    (slot.querySelector("#int-oauth-client-id") as HTMLInputElement).value = "";
    await expect(el.upsertLinkedOAuthAccount(slot, savedConn)).rejects.toThrow(
      "OAuth client ID is required for OAuth authentication.",
    );
    (slot.querySelector("#int-oauth-client-id") as HTMLInputElement).value =
      "client-id-123";

    // 4. Success path with pendingOauthResult
    el.pendingOauthResult = {
      providerId: "google",
      accessToken: "plain-access-token",
      refreshToken: "plain-refresh-token",
      expiresAt: Date.now() + 3600000,
      scope: "https://mail.google.com/",
      tokenType: "Bearer",
    };

    const account = await el.upsertLinkedOAuthAccount(slot, savedConn);
    expect(account).toBeDefined();
    expect(account.authMode).toBe("oauth");
    expect(account.oauthClientId).toBe("client-id-123");
    expect(account.token).toBe("encrypted");

    // 5. Calling buildCredentialRef with oauth returns correct structure
    const credRef = await el.buildCredentialRef(slot, savedConn);
    expect(credRef).toEqual({
      serviceType: "http_api",
      authType: "oauth",
      providerId: "google",
      accountId: account.id,
      username: "user@gmail.com",
    });

    document.body.removeChild(el);
  });

  it("buildCredentialRef enforces username and password rules for basic_userpass", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();

    const savedConn = { id: "conn-1" } as any;
    const slot = document.createElement("div");
    slot.innerHTML = `
      <select id="int-auth-mode"><option value="basic_userpass" selected>Password</option></select>
      <input id="int-username" value="" />
      <input id="int-password" value="" />
    `;

    // 1. Both empty -> returns null
    const refNull = await el.buildCredentialRef(slot, savedConn);
    expect(refNull).toBeNull();

    // 2. Password without username -> throws
    (slot.querySelector("#int-password") as HTMLInputElement).value = "pass123";
    await expect(el.buildCredentialRef(slot, savedConn)).rejects.toThrow(
      "Auth username is required when a password is configured.",
    );

    // 3. Username without password -> throws
    (slot.querySelector("#int-password") as HTMLInputElement).value = "";
    (slot.querySelector("#int-username") as HTMLInputElement).value =
      "user@test.com";
    await expect(el.buildCredentialRef(slot, savedConn)).rejects.toThrow(
      "Auth password is required when username is configured.",
    );

    document.body.removeChild(el);
  });

  it("renderConnectionList handles card action button clicks and delete confirmation cancel", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    el.connections = [
      {
        id: "conn-1",
        label: "My IMAP",
        pluginId: "imap",
        enabled: true,
        config: { executionMode: "auto", pollIntervalSec: 120 },
        credentialRef: { encryptedSecret: "enc" },
      },
    ] as any;

    el.renderConnectionList();

    const list = el.shadowRoot?.querySelector(
      '[data-region="connection-list"]',
    );
    const editBtn = list?.querySelector(
      'button[data-action="edit"]',
    ) as HTMLButtonElement;
    const toggleBtn = list?.querySelector(
      'button[data-action="toggle"]',
    ) as HTMLButtonElement;
    const deleteBtn = list?.querySelector(
      'button[data-action="delete"]',
    ) as HTMLButtonElement;

    expect(editBtn).not.toBeNull();
    expect(toggleBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();

    // Click edit -> calls showForm
    const showFormSpy = jest.spyOn(el, "showForm");
    editBtn.click();
    expect(showFormSpy).toHaveBeenCalledWith("conn-1");

    // Click toggle
    const toggleSpy = jest.spyOn(el, "toggleConnection");
    toggleBtn.click();
    expect(toggleSpy).toHaveBeenCalledWith("conn-1");

    // Click delete with confirmation cancelled
    el.requestConfirmation = jest.fn<any>().mockResolvedValue(false);
    const { deleteEmailConnection } =
      await import("../../../subsystems/email/connections.js");
    (deleteEmailConnection as jest.Mock).mockClear();
    await el.deleteConnection("conn-1");
    expect(deleteEmailConnection).not.toHaveBeenCalled();

    // toggleConnection with unknown id
    await el.toggleConnection("non-existent-id");

    document.body.removeChild(el);
  });

  it("saveForm parses form values, handles validation errors, extra config JSON, and cancel action", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    el.manifests = [
      {
        id: "imap",
        name: "IMAP",
        configurableFields: ["port", "secure", "mailboxPath"],
        description: "",
      } as any,
    ];
    (getEmailPluginManifest as jest.Mock).mockReturnValue(el.manifests[0]);
    el.showForm(null);

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;

    // 1. Missing label shows error
    (slot.querySelector("#int-label") as HTMLInputElement).value = "";
    await el.saveForm();

    // 2. Invalid extra config JSON shows error
    (slot.querySelector("#int-label") as HTMLInputElement).value =
      "Valid Label";
    (slot.querySelector("#int-extra-config") as HTMLTextAreaElement).value =
      "{ not-json";
    await el.saveForm();

    // 3. Valid config with data-config-fields and extra config JSON
    (slot.querySelector("#int-extra-config") as HTMLTextAreaElement).value =
      '{"customProp": true}';
    const portInput = slot.querySelector("#cfg-port") as HTMLInputElement;
    if (portInput) portInput.value = "993";
    const secureInput = slot.querySelector("#cfg-secure") as HTMLInputElement;
    if (secureInput) secureInput.value = "true";
    const mailboxInput = slot.querySelector(
      "#cfg-mailboxPath",
    ) as HTMLInputElement;
    if (mailboxInput) mailboxInput.value = "INBOX";

    el.buildCredentialRef = jest.fn<any>().mockResolvedValue(null);
    await el.saveForm();

    const { upsertEmailConnection } =
      await import("../../../subsystems/email/connections.js");
    expect(upsertEmailConnection).toHaveBeenCalledWith(
      el.db,
      expect.objectContaining({
        label: "Valid Label",
        config: expect.objectContaining({
          port: 993,
          secure: true,
          mailboxPath: "INBOX",
          customProp: true,
        }),
      }),
    );

    // Cancel action hides form
    el.showForm(null);
    expect(slot.hidden).toBe(false);
    const cancelBtn = slot.querySelector(
      'button[data-action="cancel"]',
    ) as HTMLButtonElement;
    cancelBtn.click();
    expect(slot.hidden).toBe(true);

    document.body.removeChild(el);
  });
});
