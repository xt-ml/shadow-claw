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

jest.unstable_mockModule("../../../db/get-config.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue([]),
}));

jest.unstable_mockModule("../../../db/set-config.js", () => ({
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
const { getEmailPluginManifest, listEmailPluginManifests } =
  await import("../../../subsystems/email/catalog.js");
const { ShadowClawIntegrations } =
  await import("./shadow-claw-integrations.js");

describe("shadow-claw-integrations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listEmailPluginManifests as jest.Mock).mockReturnValue([
      {
        id: "imap",
        name: "IMAP",
        configurableFields: ["port", "secure", "smtpSecure"],
        description: "",
      },
    ]);
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

  it("handles renderConnectionList empty state and disabled connection toggle", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    // 1. Empty list
    el.connections = [];
    el.renderConnectionList();
    const list = el.shadowRoot?.querySelector(
      '[data-region="connection-list"]',
    );
    expect(list?.textContent).toContain("No email connections configured");

    // Click handler ignores clicks on empty / non-action targets
    list?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // 2. Disabled connection
    const { upsertEmailConnection } =
      await import("../../../subsystems/email/connections.js");
    const { showSuccess, showError } = await import("../../../ui/toast.js");

    el.connections = [
      {
        id: "conn-disabled",
        label: "Disabled Conn",
        pluginId: "imap",
        enabled: false,
        config: { executionMode: "manual" },
        credentialRef: null,
      },
    ] as any;
    el.renderConnectionList();

    const badge = list?.querySelector(".connection-badge");
    expect(badge?.classList.contains("disabled")).toBe(true);
    expect(badge?.textContent?.trim()).toBe("Disabled");

    const toggleBtn = list?.querySelector(
      'button[data-action="toggle"]',
    ) as HTMLButtonElement;
    expect(toggleBtn.textContent?.trim()).toBe("Enable");

    // Toggle to enable
    await el.toggleConnection("conn-disabled");
    expect(upsertEmailConnection).toHaveBeenCalledWith(
      el.db,
      expect.objectContaining({ id: "conn-disabled", enabled: true }),
    );
    expect(showSuccess).toHaveBeenCalledWith("Email enabled", 2500);

    // Toggle error handling
    // Re-set connections before testing second toggle failure
    el.connections = [
      {
        id: "conn-disabled",
        label: "Disabled Conn",
        pluginId: "imap",
        enabled: true,
        config: { executionMode: "manual" },
        credentialRef: null,
      },
    ] as any;
    (upsertEmailConnection as jest.Mock).mockRejectedValueOnce(
      new Error("Toggle failed"),
    );
    await el.toggleConnection("conn-disabled");
    expect(showError).toHaveBeenCalledWith(
      "Failed to update email connection: Toggle failed",
      6000,
    );

    // Delete connection confirmed
    el.connections = [
      {
        id: "conn-disabled",
        label: "Disabled Conn",
        pluginId: "imap",
        enabled: true,
        config: { executionMode: "manual" },
        credentialRef: null,
      },
    ] as any;
    el.requestConfirmation = jest.fn<any>().mockResolvedValue(true);
    const { deleteEmailConnection } =
      await import("../../../subsystems/email/connections.js");
    (deleteEmailConnection as jest.Mock).mockResolvedValueOnce(true);
    (showSuccess as jest.Mock).mockClear();
    await el.deleteConnection("conn-disabled");
    expect(deleteEmailConnection).toHaveBeenCalledWith(el.db, "conn-disabled");
    expect(showSuccess).toHaveBeenCalledWith("Email connection deleted", 2500);

    // Delete connection error handling
    el.connections = [
      {
        id: "conn-disabled",
        label: "Disabled Conn",
        pluginId: "imap",
        enabled: true,
        config: { executionMode: "manual" },
        credentialRef: null,
      },
    ] as any;
    (deleteEmailConnection as jest.Mock).mockRejectedValueOnce(
      new Error("Delete failed"),
    );
    await el.deleteConnection("conn-disabled");
    expect(showError).toHaveBeenCalledWith(
      "Failed to delete email connection: Delete failed",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles requestConfirmation with appShell and without appShell", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);

    // Without appShell
    expect(await el.requestConfirmation({ title: "T", message: "M" })).toBe(
      false,
    );

    // With appShell
    const mockAppShell = document.createElement("shadow-claw") as any;
    mockAppShell.requestDialog = jest.fn<any>().mockResolvedValue(true);
    document.body.appendChild(mockAppShell);

    expect(await el.requestConfirmation({ title: "T", message: "M" })).toBe(
      true,
    );
    expect(mockAppShell.requestDialog).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "confirm", title: "T", message: "M" }),
    );

    document.body.removeChild(mockAppShell);
    document.body.removeChild(el);
  });

  it("renders showForm for an existing connection with linked OAuth account", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    el.accounts = [
      {
        id: "acc-oauth-1",
        label: "Google Account",
        service: "google",
        hostPattern: "imap.gmail.com",
        token: "enc-token",
        authMode: "oauth",
        oauthProviderId: "google",
        oauthClientId: "client-id-123",
        oauthClientSecret: "enc-secret",
        oauthReauthRequired: true,
      },
    ] as any;

    el.connections = [
      {
        id: "conn-oauth",
        label: "My Gmail OAuth",
        pluginId: "imap",
        enabled: true,
        config: {
          executionMode: "scheduled",
          pollIntervalSec: 60,
          unreadOnly: true,
        },
        credentialRef: {
          authType: "oauth",
          accountId: "acc-oauth-1",
        },
      },
    ] as any;

    el.manifests = [
      {
        id: "imap",
        name: "IMAP",
        configurableFields: ["host", "port"],
        description: "",
      } as any,
    ];
    (getEmailPluginManifest as jest.Mock).mockReturnValue(el.manifests[0]);

    el.showForm("conn-oauth");
    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;

    expect(slot.hidden).toBe(false);
    expect((slot.querySelector("#int-label") as HTMLInputElement).value).toBe(
      "My Gmail OAuth",
    );
    expect((slot.querySelector("#int-mode") as HTMLSelectElement).value).toBe(
      "scheduled",
    );
    expect(
      (slot.querySelector("#int-unread-only") as HTMLInputElement).checked,
    ).toBe(true);

    document.body.removeChild(el);
  });

  it("handles testConnection branches for validation, auth resolution, and API response", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    const { showError, showSuccess } = await import("../../../ui/toast.js");
    const { resolveConnectionTestAuth } =
      await import("./connection-test-auth.js");

    el.manifests = [
      {
        id: "imap",
        name: "IMAP",
        configurableFields: ["host", "port"],
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
    const hostInput = slot.querySelector("#cfg-host") as HTMLInputElement;
    const portInput = slot.querySelector("#cfg-port") as HTMLInputElement;
    const authModeSelect = slot.querySelector(
      "#int-auth-mode",
    ) as HTMLSelectElement;

    // 1. Missing username
    usernameInput.value = "";
    await el.testConnectionFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      "Auth username (email login) is required.",
      4000,
    );

    // 2. Missing host
    usernameInput.value = "user@test.com";
    hostInput.value = "";
    await el.testConnectionFromForm(slot);
    expect(showError).toHaveBeenCalledWith("IMAP host is required.", 4000);

    hostInput.value = "imap.test.com";
    portInput.value = "993";

    // 3. OAuth mode with resolveConnectionTestAuth returning error
    authModeSelect.value = "oauth";
    (resolveConnectionTestAuth as jest.Mock).mockReturnValueOnce({
      error: "OAuth token missing",
    });
    await el.testConnectionFromForm(slot);
    expect(showError).toHaveBeenCalledWith("OAuth token missing", 6000);

    // 4. Basic userpass with resolveConnectionTestAuth returning error
    authModeSelect.value = "basic_userpass";
    (resolveConnectionTestAuth as jest.Mock).mockReturnValueOnce({
      error: "Password missing",
    });
    await el.testConnectionFromForm(slot);
    expect(showError).toHaveBeenCalledWith("Password missing", 6000);

    // 5. Successful test call returning count
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn<any>().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 12 }),
    }) as any;

    (resolveConnectionTestAuth as jest.Mock).mockReturnValueOnce({
      authType: "basic_userpass",
      password: "secretpassword",
    });
    await el.testConnectionFromForm(slot);
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining("IMAP login succeeded (12 messages returned)."),
      4500,
    );

    // 6. Test call failing with HTTP error
    globalThis.fetch = jest.fn<any>().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Error",
      json: async () => ({ error: "Auth rejected" }),
    }) as any;
    (resolveConnectionTestAuth as jest.Mock).mockReturnValueOnce({
      authType: "basic_userpass",
      password: "secretpassword",
    });
    await el.testConnectionFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      "Connection test failed (500): Auth rejected",
      7000,
    );

    // 7. Network exception thrown
    globalThis.fetch = jest
      .fn<any>()
      .mockRejectedValue(new Error("Network drop"));
    (resolveConnectionTestAuth as jest.Mock).mockReturnValueOnce({
      authType: "basic_userpass",
      password: "secretpassword",
    });
    await el.testConnectionFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      "Connection test failed: Network drop",
      7000,
    );

    globalThis.fetch = originalFetch;
    document.body.removeChild(el);
  });

  it("handles startOauthFlow error and success paths", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    const { showError, showSuccess } = await import("../../../ui/toast.js");

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
    const clientIdInput = slot.querySelector(
      "#int-oauth-client-id",
    ) as HTMLInputElement;

    // 1. Missing clientId
    clientIdInput.value = "";
    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      "OAuth client ID is required.",
      4000,
    );

    clientIdInput.value = "my-client-id";

    const originalFetch = globalThis.fetch;
    const originalOpen = window.open;
    window.open = jest.fn() as any;

    // 2. Authorize fails
    globalThis.fetch = jest.fn<any>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Invalid client" }),
    });
    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      "Gmail (Google OAuth) connect failed: Invalid client",
      6000,
    );

    // 3. Successful flow
    globalThis.fetch = jest
      .fn<any>()
      // Authorize
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: "s-123",
          authorizeUrl: "https://auth.example.com",
        }),
      })
      // Session status
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "authorized" }),
      })
      // Token exchange
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: "token-abc",
          refreshToken: "refresh-xyz",
          expiresIn: 3600,
          scope: "email imap",
        }),
      });

    await el.connectOAuthFromForm(slot);
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining("connected"),
      3000,
    );
    expect(el.pendingOauthResult?.accessToken).toBe("token-abc");

    window.open = originalOpen;
    globalThis.fetch = originalFetch;
    document.body.removeChild(el);
  });

  it("handles upsertLinkedOAuthAccount validation and account storage", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    const slot = document.createElement("div");

    // Missing username
    await expect(
      el.upsertLinkedOAuthAccount(slot, { id: "c-1", label: "C1" } as any),
    ).rejects.toThrow("Email login address is required");

    // Missing clientId
    slot.innerHTML = '<input id="int-username" value="user@gmail.com" />';
    await expect(
      el.upsertLinkedOAuthAccount(slot, { id: "c-1", label: "C1" } as any),
    ).rejects.toThrow("OAuth client ID is required");

    // Missing token
    slot.innerHTML =
      '<input id="int-username" value="user@gmail.com" />' +
      '<input id="int-oauth-client-id" value="client-123" />';
    await expect(
      el.upsertLinkedOAuthAccount(slot, { id: "c-1", label: "C1" } as any),
    ).rejects.toThrow("Connect OAuth first to obtain an access token");

    // With pending OAuth result and client secret
    slot.innerHTML =
      '<input id="int-username" value="user@gmail.com" />' +
      '<input id="int-oauth-client-id" value="client-123" />' +
      '<input id="int-oauth-client-secret" value="secret-xyz" />';

    el.pendingOauthResult = {
      providerId: "google",
      accessToken: "access-token-123",
      refreshToken: "refresh-token-456",
      expiresAt: Date.now() + 3600000,
      scope: "read write",
      tokenType: "Bearer",
    };

    const account = await el.upsertLinkedOAuthAccount(slot, {
      id: "c-1",
      label: "C1",
    } as any);

    expect(account.authMode).toBe("oauth");
    expect(account.id).toBeDefined();
    expect(el.accounts.length).toBe(1);

    // Update existing account path
    el.connections = [
      {
        id: "c-1",
        label: "C1",
        pluginId: "imap",
        enabled: true,
        config: {},
        credentialRef: { accountId: account.id },
      },
    ] as any;
    const updated = await el.upsertLinkedOAuthAccount(slot, {
      id: "c-1",
      label: "C1",
    } as any);
    expect(updated.id).toBe(account.id);

    document.body.removeChild(el);
  });

  it("handles buildCredentialRef branches for oauth and password credentials", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    const { encryptValue } = await import("../../../security/crypto.js");

    const slot = document.createElement("div");

    // 1. Neither username nor password -> returns null
    slot.innerHTML =
      '<select id="int-auth-mode"><option value="basic_userpass">Basic</option></select>';
    expect(await el.buildCredentialRef(slot, { id: "c-1" } as any)).toBeNull();

    // 2. Username without password -> throws
    slot.innerHTML =
      '<select id="int-auth-mode"><option value="basic_userpass">Basic</option></select>' +
      '<input id="int-username" value="user@mail.com" />';
    await expect(
      el.buildCredentialRef(slot, { id: "c-1" } as any),
    ).rejects.toThrow("Auth password is required when username is configured");

    // 3. Password without username -> throws
    slot.innerHTML =
      '<select id="int-auth-mode"><option value="basic_userpass">Basic</option></select>' +
      '<input id="int-password" value="mysecret" />';
    await expect(
      el.buildCredentialRef(slot, { id: "c-1" } as any),
    ).rejects.toThrow(
      "Auth username is required when a password is configured",
    );

    // 4. encryptValue fails -> throws
    (encryptValue as jest.Mock).mockResolvedValueOnce(undefined as any);
    slot.innerHTML =
      '<select id="int-auth-mode"><option value="basic_userpass">Basic</option></select>' +
      '<input id="int-username" value="user@mail.com" />' +
      '<input id="int-password" value="mysecret" />';
    await expect(
      el.buildCredentialRef(slot, { id: "c-1" } as any),
    ).rejects.toThrow("Could not encrypt email password");

    // 5. OAuth mode without username -> throws
    slot.innerHTML =
      '<select id="int-auth-mode"><option value="oauth">OAuth</option></select>';
    await expect(
      el.buildCredentialRef(slot, { id: "c-1" } as any),
    ).rejects.toThrow(
      "Email login address is required for OAuth authentication",
    );

    // 6. OAuth mode valid -> calls upsertLinkedOAuthAccount
    slot.innerHTML =
      '<select id="int-auth-mode"><option value="oauth">OAuth</option></select>' +
      '<input id="int-username" value="user@mail.com" />';
    el.upsertLinkedOAuthAccount = jest.fn<any>().mockResolvedValue({
      id: "acc-1",
      oauthProviderId: "google",
    });

    const ref = await el.buildCredentialRef(slot, { id: "c-1" } as any);
    expect(ref?.authType).toBe("oauth");
    expect(ref?.accountId).toBe("acc-1");

    document.body.removeChild(el);
  });

  it("handles OAuth session errors, timeouts, and non-Error rejections", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    const { showError } = await import("../../../ui/toast.js");

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
    const clientIdInput = slot.querySelector(
      "#int-oauth-client-id",
    ) as HTMLInputElement;
    clientIdInput.value = "test-client";

    const originalFetch = globalThis.fetch;
    const originalOpen = window.open;
    window.open = jest.fn() as any;

    // 1. Session returns not ok
    globalThis.fetch = jest
      .fn<any>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: "s-1",
          authorizeUrl: "http://example.com",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Session missing" }),
      });

    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Session missing"),
      6000,
    );

    // 2. Session returns status === 'error'
    globalThis.fetch = jest
      .fn<any>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: "s-1",
          authorizeUrl: "http://example.com",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "error", error: "User denied consent" }),
      });

    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("User denied consent"),
      6000,
    );

    // 3. Token exchange returns not ok
    globalThis.fetch = jest
      .fn<any>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: "s-1",
          authorizeUrl: "http://example.com",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "authorized" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Token expired" }),
      });

    await el.connectOAuthFromForm(slot);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Token expired"),
      6000,
    );

    window.open = originalOpen;
    globalThis.fetch = originalFetch;
    document.body.removeChild(el);
  });

  it("handles applyImapPreset with and without matching preset and mailbox", async () => {
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
          "mailboxPath",
          "fromAddress",
        ],
        description: "",
      } as any,
    ];
    (getEmailPluginManifest as jest.Mock).mockReturnValue(el.manifests[0]);
    el.showForm(null);

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;
    const presetSelect = slot.querySelector(
      "#int-imap-preset",
    ) as HTMLSelectElement;
    const usernameInput = slot.querySelector(
      "#int-username",
    ) as HTMLInputElement;
    const mailboxInput = slot.querySelector(
      "#cfg-mailboxPath",
    ) as HTMLInputElement;

    // 1. Preset with no match -> returns early
    presetSelect.value = "auto";
    usernameInput.value = "user@customdomain.org";
    el.applyImapPreset(slot);

    // 2. Preset with match and empty mailbox -> populates mailbox and fromAddress
    usernameInput.value = "user@gmail.com";
    if (mailboxInput) mailboxInput.value = "";
    el.applyImapPreset(slot);
    if (mailboxInput) expect(mailboxInput.value).toBe("INBOX");

    // 3. Preset with presetSelect null
    const dummyDiv = document.createElement("div");
    el.applyImapPreset(dummyDiv);

    document.body.removeChild(el);
  });

  it("handles renderConfigFieldRows with boolean options", async () => {
    const el = new ShadowClawIntegrations();
    const manifest: any = {
      id: "imap",
      configurableFields: ["secure", "smtpSecure"],
    };

    // Config with boolean false and boolean true
    const html = el.renderConfigFieldRows(manifest, {
      secure: false,
      smtpSecure: true,
    });
    expect(html).toContain('value="false" selected');
    expect(html).toContain('value="true" selected');
  });

  it("handles handleConnectionListClick event routing for toggle and delete actions", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    el.connections = [
      {
        id: "conn-1",
        label: "Conn 1",
        pluginId: "imap",
        enabled: true,
        config: { executionMode: "event-driven" },
        credentialRef: { encryptedSecret: "secret" },
      },
    ] as any;
    el.renderConnectionList();

    const list = el.shadowRoot?.querySelector(
      '[data-region="connection-list"]',
    ) as HTMLElement;

    const toggleSpy = jest
      .spyOn(el, "toggleConnection")
      .mockResolvedValue(undefined as any);
    const deleteSpy = jest
      .spyOn(el, "deleteConnection")
      .mockResolvedValue(undefined as any);

    // Click toggle button
    const toggleBtn = list.querySelector(
      'button[data-action="toggle"]',
    ) as HTMLButtonElement;
    toggleBtn.click();
    expect(toggleSpy).toHaveBeenCalledWith("conn-1");

    // Click delete button
    const deleteBtn = list.querySelector(
      'button[data-action="delete"]',
    ) as HTMLButtonElement;
    deleteBtn.click();
    expect(deleteSpy).toHaveBeenCalledWith("conn-1");

    // Click on element without data-action or data-id
    const badge = list.querySelector(".connection-badge") as HTMLElement;
    badge.click();

    document.body.removeChild(el);
  });

  it("handles saveForm editing existing connection, null db, and error handling", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    const { showError } = await import("../../../ui/toast.js");
    const { upsertEmailConnection } =
      await import("../../../subsystems/email/connections.js");

    el.manifests = [
      {
        id: "imap",
        name: "IMAP",
        configurableFields: ["port"],
        description: "",
      } as any,
    ];
    (getEmailPluginManifest as jest.Mock).mockReturnValue(el.manifests[0]);

    // 1. Save with db = null -> early return
    el.db = null;
    await el.saveForm();

    // Restore db
    el.db = {} as any;

    // 2. Editing existing connection
    el.connections = [
      {
        id: "existing-conn-123",
        label: "Old Label",
        pluginId: "imap",
        enabled: true,
        config: {},
        credentialRef: null,
      },
    ] as any;
    el.showForm("existing-conn-123");

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;
    (slot.querySelector("#int-label") as HTMLInputElement).value =
      "Updated Label";
    el.buildCredentialRef = jest.fn<any>().mockResolvedValue(null);

    await el.saveForm();
    expect(upsertEmailConnection).toHaveBeenCalledWith(
      el.db,
      expect.objectContaining({
        id: "existing-conn-123",
        label: "Updated Label",
      }),
    );

    // 3. Upsert throws error
    (showError as jest.Mock).mockClear();
    el.showForm(null);
    const slot2 = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;
    (slot2.querySelector("#int-label") as HTMLInputElement).value =
      "Error Label";
    (upsertEmailConnection as jest.Mock).mockRejectedValueOnce(
      new Error("Disk write error"),
    );
    await el.saveForm();
    expect(showError).toHaveBeenCalledWith(
      "Failed to save email connection: Disk write error",
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles non-IMAP manifests, getInitialPluginId variations, and showForm OAuth statuses", async () => {
    const el = new ShadowClawIntegrations();
    document.body.appendChild(el);
    await el.connectedCallback();

    // 1. getInitialPluginId branches
    expect(el.getInitialPluginId({ pluginId: "custom" } as any)).toBe("custom");
    el.manifests = [
      { id: "other", name: "Other", configurableFields: [] } as any,
    ];
    expect(el.getInitialPluginId(null)).toBe("other");
    el.manifests = [];
    expect(el.getInitialPluginId(null)).toBe("");

    // 2. renderConfigFieldRows with non-imap manifest
    const nonImapManifest: any = {
      id: "smtp",
      configurableFields: ["customField"],
    };
    const html = el.renderConfigFieldRows(nonImapManifest, {
      customField: "hello",
    });
    expect(html).toContain('label for="cfg-customField">customField</label>');

    // 3. showForm with event-driven execution mode, saved OAuth token, and no-token OAuth account
    el.manifests = [
      {
        id: "imap",
        name: "IMAP",
        configurableFields: ["fromAddress", "mailboxPath"],
        description: "",
      } as any,
    ];
    el.accounts = [
      {
        id: "acc-with-token",
        token: "existing-valid-token",
        oauthReauthRequired: false,
      },
      {
        id: "acc-no-token",
        token: "",
        oauthReauthRequired: false,
      },
    ] as any;

    el.connections = [
      {
        id: "conn-saved-token",
        label: "Saved Token Conn",
        pluginId: "imap",
        enabled: true,
        config: { executionMode: "event-driven" },
        credentialRef: { authType: "oauth", accountId: "acc-with-token" },
      },
      {
        id: "conn-no-token",
        label: "No Token Conn",
        pluginId: "imap",
        enabled: true,
        config: {},
        credentialRef: { authType: "oauth", accountId: "acc-no-token" },
      },
    ] as any;

    el.showForm("conn-saved-token");
    const slot1 = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;
    expect(slot1.innerHTML).toContain("OAuth token already saved");
    expect(slot1.innerHTML).toContain('value="event-driven" selected');

    // fromAddress in applyImapPreset
    const usernameInput = slot1.querySelector(
      "#int-username",
    ) as HTMLInputElement;
    const fromInput = slot1.querySelector(
      "#cfg-fromAddress",
    ) as HTMLInputElement;
    if (usernameInput && fromInput) {
      usernameInput.value = "myfrom@gmail.com";
      fromInput.value = "";
      el.applyImapPreset(slot1);
      expect(fromInput.value).toBe("myfrom@gmail.com");
    }

    el.showForm("conn-no-token");
    const slot2 = el.shadowRoot?.querySelector(
      '[data-region="connection-form"]',
    ) as HTMLElement;
    expect(slot2.innerHTML).toContain("Not connected");

    // showForm with non-imap plugin
    el.manifests = [
      { id: "sendgrid", name: "SendGrid", configurableFields: [] } as any,
    ];
    el.connections = [
      {
        id: "conn-sg",
        label: "SendGrid",
        pluginId: "sendgrid",
        enabled: true,
        config: {},
        credentialRef: null,
      },
    ] as any;
    el.showForm("conn-sg");

    document.body.removeChild(el);
  });
});
