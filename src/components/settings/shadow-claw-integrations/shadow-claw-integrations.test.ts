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
});
