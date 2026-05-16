import { jest } from "@jest/globals";

const mockGetDb = jest.fn<any>().mockResolvedValue({} as any);
const mockGetConfig = jest.fn<any>();
const mockListConnections = jest.fn<any>();
const mockUpsertConnection = jest.fn<any>();
const mockBindCredential = jest.fn<any>();
const mockDeleteConnection = jest.fn<any>();
const mockTestConnection = jest.fn<any>();
const mockEncryptValue = jest.fn<any>();

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: mockGetDb,
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../crypto.js", () => ({
  encryptValue: mockEncryptValue,
}));

jest.unstable_mockModule("../../../mcp-connections.js", () => ({
  listRemoteMcpConnections: mockListConnections,
  upsertRemoteMcpConnection: mockUpsertConnection,
  bindRemoteMcpCredentialRef: mockBindCredential,
  deleteRemoteMcpConnection: mockDeleteConnection,
}));

jest.unstable_mockModule("../../../remote-mcp-client.js", () => ({
  testRemoteMcpConnection: mockTestConnection,
  clearRemoteMcpSession: jest.fn(),
}));

jest.unstable_mockModule("../../../security/trusted-types.js", () => ({
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
}));

const mockReconnectMcpOAuth = jest.fn<any>();
jest.unstable_mockModule("../../../mcp-reconnect.js", () => ({
  reconnectMcpOAuth: mockReconnectMcpOAuth,
}));

const { ShadowClawMcpRemote } = await import("./shadow-claw-mcp-remote.js");
const { setSanitizedHtml } = await import("../../../security/trusted-types.js");

describe("shadow-claw-mcp-remote", () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    mockListConnections.mockReset();
    mockUpsertConnection.mockReset();
    mockBindCredential.mockReset();
    mockDeleteConnection.mockReset();
    mockTestConnection.mockReset();
    mockEncryptValue.mockReset();

    mockListConnections.mockResolvedValue([]);
    mockGetConfig.mockResolvedValue([]);
    mockBindCredential.mockResolvedValue(null);
    mockEncryptValue.mockResolvedValue("enc-secret");
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-mcp-remote")).toBe(
      ShadowClawMcpRemote,
    );
  });

  it("renders empty state when no connections exist", async () => {
    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    const empty = el.shadowRoot?.querySelector("shadow-claw-empty-state");
    expect(empty?.getAttribute("message")).toContain(
      "No remote MCP connections configured",
    );

    document.body.removeChild(el);
  });

  it("saves a new connection with no auth", async () => {
    mockUpsertConnection.mockResolvedValue({
      id: "conn-1",
      label: "Figma MCP",
      serviceType: "mcp_remote",
      serverUrl: "https://mcp.example.com/rpc",
      transport: "streamable_http",
      enabled: true,
      createdAt: 1,
      updatedAt: 1,
      credentialRef: null,
    });

    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    el.showConnectionForm("new");

    const labelInput = el.shadowRoot?.querySelector(
      '[data-field="connection-label"]',
    ) as HTMLInputElement;
    const urlInput = el.shadowRoot?.querySelector(
      '[data-field="connection-url"]',
    ) as HTMLInputElement;

    labelInput.value = "Figma MCP";
    urlInput.value = "https://mcp.example.com/rpc";

    await el.saveConnectionForm();

    expect(mockUpsertConnection).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        label: "Figma MCP",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
        serviceType: "mcp_remote",
      }),
    );
    expect(mockBindCredential).toHaveBeenCalledWith({}, "conn-1", null);

    document.body.removeChild(el);
  });

  it("routes the connection form shell through the Trusted Types helper", async () => {
    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    el.showConnectionForm("new");

    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form-slot"]',
    ) as HTMLElement;

    expect(setSanitizedHtml).toHaveBeenCalledWith(
      slot,
      expect.stringContaining("Add Remote MCP Connection"),
    );

    document.body.removeChild(el);
  });

  it("tests a configured connection", async () => {
    mockListConnections.mockResolvedValue([
      {
        id: "conn-1",
        label: "Remote",
        serviceType: "mcp_remote",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
        credentialRef: null,
      },
    ]);
    mockTestConnection.mockResolvedValue({
      success: true,
      error: null,
      toolCount: 1,
      toolNames: ["read_file"],
      steps: [{ step: "Test", status: "ok" }],
    });

    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    const actions = el.shadowRoot?.querySelector("shadow-claw-actions");
    actions?.dispatchEvent(
      new CustomEvent("settings-action", {
        detail: { action: "test-connection", id: "conn-1" },
        bubbles: true,
        composed: true,
      }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(mockTestConnection).toHaveBeenCalledWith({}, "conn-1");

    document.body.removeChild(el);
  });

  it("routes diagnostic markup through the Trusted Types helper", async () => {
    const el = new ShadowClawMcpRemote();
    const container = document.createElement("div");

    el.renderDiagnostic(container, {
      success: true,
      error: null,
      toolCount: 1,
      toolNames: ["read_file"],
      steps: [{ step: "Connected", status: "ok", detail: "done" }],
    });

    expect(setSanitizedHtml).toHaveBeenCalledWith(
      container,
      expect.stringContaining("Connection OK"),
    );
  });

  it("renders reconnect button for OAuth connections", async () => {
    mockListConnections.mockResolvedValue([
      {
        id: "conn-oauth",
        label: "OAuth MCP",
        serviceType: "mcp_remote",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
        credentialRef: {
          serviceType: "mcp_remote",
          authType: "oauth",
          accountId: "acct-1",
        },
      },
      {
        id: "conn-pat",
        label: "PAT MCP",
        serviceType: "mcp_remote",
        serverUrl: "https://mcp.example.com/rpc2",
        transport: "streamable_http",
        enabled: true,
        createdAt: 2,
        updatedAt: 2,
        credentialRef: {
          serviceType: "mcp_remote",
          authType: "pat",
          accountId: "acct-2",
        },
      },
    ]);

    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    const reconnectBtns = el.shadowRoot?.querySelectorAll(".reconnect-btn");
    expect(reconnectBtns?.length).toBe(1);
    expect(reconnectBtns?.[0]?.getAttribute("data-reconnect-connection")).toBe(
      "conn-oauth",
    );

    document.body.removeChild(el);
  });

  it("does not render reconnect button for non-OAuth connections", async () => {
    mockListConnections.mockResolvedValue([
      {
        id: "conn-none",
        label: "No Auth MCP",
        serviceType: "mcp_remote",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
        credentialRef: null,
      },
    ]);

    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();
    await el.render();

    const reconnectBtns = el.shadowRoot?.querySelectorAll(".reconnect-btn");
    expect(reconnectBtns?.length).toBe(0);

    document.body.removeChild(el);
  });
});
