import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../config.js", () => ({
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

jest.unstable_mockModule("../../../email/catalog.js", () => ({
  getEmailPluginManifest: jest.fn<any>().mockReturnValue(null),
  listEmailPluginManifests: jest.fn<any>().mockReturnValue([]),
}));

jest.unstable_mockModule("../../../email/connections.js", () => ({
  listEmailConnections: jest.fn<any>().mockResolvedValue([]),
  upsertEmailConnection: jest.fn<any>().mockResolvedValue({ id: "conn-1" }),
  deleteEmailConnection: jest.fn<any>().mockResolvedValue(undefined),
  bindEmailCredentialRef: jest.fn<any>().mockResolvedValue(null),
}));

jest.unstable_mockModule("../../../crypto.js", () => ({
  encryptValue: jest.fn<any>().mockResolvedValue("encrypted"),
}));

jest.unstable_mockModule("../../../toast.js", () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
}));

jest.unstable_mockModule("../../../ulid.js", () => ({
  ulid: jest.fn(() => "test-id"),
}));

jest.unstable_mockModule("./connection-test-auth.js", () => ({
  resolveConnectionTestAuth: jest
    .fn<any>()
    .mockReturnValue({ error: "no auth" }),
}));

jest.unstable_mockModule("../../../security/trusted-types.js", () => ({
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
}));

const { setSanitizedHtml } = await import("../../../security/trusted-types.js");
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
      await import("../../../email/connections.js");
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
});
