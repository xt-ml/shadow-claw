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

jest.unstable_mockModule("../../../db/get-config.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../security/crypto.js", () => ({
  encryptValue: mockEncryptValue,
}));

jest.unstable_mockModule("../../../subsystems/mcp/mcp-connections.js", () => ({
  listRemoteMcpConnections: mockListConnections,
  upsertRemoteMcpConnection: mockUpsertConnection,
  bindRemoteMcpCredentialRef: mockBindCredential,
  deleteRemoteMcpConnection: mockDeleteConnection,
}));

jest.unstable_mockModule(
  "../../../subsystems/mcp/remote-mcp-client.js",
  () => ({
    testRemoteMcpConnection: mockTestConnection,
    clearRemoteMcpSession: jest.fn(),
  }),
);

jest.unstable_mockModule("../../../security/trusted-types.js", () => ({
  sanitizeToTrustedHtml: jest.fn((html: string) => html),
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
  toTrustedHtmlPresanitized: jest.fn((html: string) => html),
  toTrustedScriptUrl: jest.fn((url: string) => url),
}));

const mockReconnectMcpOAuth = jest.fn<any>();
jest.unstable_mockModule("../../../subsystems/mcp/mcp-reconnect.js", () => ({
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

  it("handles deleteConnection, reconnectOAuth, and testConnection", async () => {
    mockDeleteConnection.mockResolvedValue(true);
    mockReconnectMcpOAuth.mockResolvedValue({ success: true });
    mockTestConnection.mockResolvedValue({
      success: true,
      toolCount: 2,
      toolNames: ["search", "fetch"],
      steps: [{ step: "Ping", status: "ok" }],
    });

    const el = new ShadowClawMcpRemote() as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;
    el.connections = [{ id: "conn-1", label: "My Connection" }];

    // 1. Delete connection
    await el.deleteConnection("conn-1");
    expect(mockDeleteConnection).toHaveBeenCalledWith(el.db, "conn-1");

    // 2. Reconnect OAuth
    await el.reconnectOAuth("conn-1");
    expect(mockReconnectMcpOAuth).toHaveBeenCalledWith(el.db, "conn-1");

    // 3. Test connection
    await el.testConnection("conn-1");
    expect(mockTestConnection).toHaveBeenCalledWith(el.db, "conn-1");

    document.body.removeChild(el);
  });

  it("covers describeCredentialRef and getAuthSelectionFromCredentialRef", () => {
    const el = new ShadowClawMcpRemote();

    expect(el.describeCredentialRef(null)).toBe("No auth");
    expect(
      el.describeCredentialRef({
        serviceType: "mcp_remote",
        authType: "none",
        providerId: "test",
      }),
    ).toBe("No auth");
    expect(
      el.describeCredentialRef({
        serviceType: "mcp_remote",
        authType: "custom_header",
        providerId: "test",
        headerName: "X-Key",
      }),
    ).toBe("Custom header (X-Key)");
    expect(
      el.describeCredentialRef({
        serviceType: "mcp_remote",
        authType: "custom_header",
        providerId: "test",
      }),
    ).toBe("Custom header");
    expect(
      el.describeCredentialRef({
        serviceType: "mcp_remote",
        authType: "oauth",
        providerId: "test",
        accountId: "acc-1",
      }),
    ).toBe("Service account (OAUTH)");
    expect(
      el.describeCredentialRef({
        serviceType: "mcp_remote",
        authType: "token",
        providerId: "test",
        gitAccountId: "git-1",
      }),
    ).toBe("Git account (TOKEN)");
    expect(
      el.describeCredentialRef({
        serviceType: "mcp_remote",
        authType: "basic" as any,
        providerId: "test",
      }),
    ).toBe("BASIC");

    expect(el.getAuthSelectionFromCredentialRef(null)).toBe("none");
    expect(
      el.getAuthSelectionFromCredentialRef({
        serviceType: "mcp_remote",
        authType: "custom_header",
        providerId: "test",
      }),
    ).toBe("custom_header");
    expect(
      el.getAuthSelectionFromCredentialRef({
        serviceType: "mcp_remote",
        authType: "oauth",
        accountId: "a1",
        providerId: "test",
      }),
    ).toBe("service_oauth");
    expect(
      el.getAuthSelectionFromCredentialRef({
        serviceType: "mcp_remote",
        authType: "token",
        accountId: "a1",
        providerId: "test",
      }),
    ).toBe("service_pat");
    expect(
      el.getAuthSelectionFromCredentialRef({
        serviceType: "mcp_remote",
        authType: "oauth",
        gitAccountId: "g1",
        providerId: "test",
      }),
    ).toBe("git_oauth");
    expect(
      el.getAuthSelectionFromCredentialRef({
        serviceType: "mcp_remote",
        authType: "token",
        gitAccountId: "g1",
        providerId: "test",
      }),
    ).toBe("git_pat");
    expect(
      el.getAuthSelectionFromCredentialRef({
        serviceType: "mcp_remote",
        authType: "other" as any,
        providerId: "test",
      }),
    ).toBe("none");
  });

  it("renders git and service account options", () => {
    const el = new ShadowClawMcpRemote();
    expect(el.renderGitAccountOptions()).toContain(
      "No git accounts configured",
    );
    expect(el.renderServiceAccountOptions()).toContain(
      "No service accounts configured",
    );

    el.gitAccounts = [
      {
        id: "git-1",
        label: "GitHub Work",
        hostPattern: "github.com",
        username: "work",
        createdAt: 1,
        updatedAt: 1,
      } as any,
    ];
    expect(el.renderGitAccountOptions("git-1")).toContain(
      'value="git-1" selected',
    );

    el.serviceAccounts = [
      {
        id: "srv-1",
        label: "Srv Acc",
        hostPattern: "api.example.com",
        createdAt: 1,
        updatedAt: 1,
      } as any,
    ];
    expect(el.renderServiceAccountOptions("srv-1")).toContain(
      'value="srv-1" selected',
    );
  });

  it("handles event listeners for adding, editing, reconnecting and closing", async () => {
    mockListConnections.mockResolvedValue([
      {
        id: "conn-1",
        label: "Remote 1",
        serviceType: "mcp_remote",
        serverUrl: "https://mcp1.com",
        transport: "streamable_http",
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
        credentialRef: {
          serviceType: "mcp_remote",
          authType: "oauth",
          accountId: "acc-1",
        },
      },
    ]);

    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();

    // Click add-connection
    const addBtn = el.shadowRoot?.querySelector(
      '[data-action="add-connection"]',
    ) as HTMLElement;
    addBtn?.click();
    expect(el.editingConnectionId).toBe("new");

    // Click cancel-connection-form
    const cancelBtn = el.shadowRoot?.querySelector(
      '[data-action="cancel-connection-form"]',
    ) as HTMLElement;
    cancelBtn?.click();
    expect(el.editingConnectionId).toBeNull();

    // Trigger settings-action edit-connection
    const listEl = el.shadowRoot?.querySelector(
      '[data-region="connection-list"]',
    );
    listEl?.dispatchEvent(
      new CustomEvent("settings-action", {
        detail: { action: "edit-connection", id: "conn-1" },
        bubbles: true,
      }),
    );
    expect(el.editingConnectionId).toBe("conn-1");

    // Trigger settings-action with empty id
    listEl?.dispatchEvent(
      new CustomEvent("settings-action", {
        detail: { action: "edit-connection", id: "" },
        bubbles: true,
      }),
    );

    // Trigger reconnect click
    const reconnectBtn = el.shadowRoot?.querySelector(
      '[data-reconnect-connection="conn-1"]',
    ) as HTMLElement;
    reconnectBtn?.click();

    // Click something other than HTMLButtonElement in connection-list
    listEl?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    document.body.removeChild(el);
  });

  it("handles auth selection changes and visibility updates", async () => {
    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();

    el.showConnectionForm("new");
    const slot = el.shadowRoot?.querySelector(
      '[data-region="connection-form-slot"]',
    ) as HTMLElement;
    const authSelect = slot.querySelector(
      '[data-field="auth-selection"]',
    ) as HTMLSelectElement;

    authSelect.value = "service_pat";
    authSelect.dispatchEvent(new Event("change"));
    expect(
      (
        slot.querySelector(
          '[data-region="service-account-region"]',
        ) as HTMLElement
      ).style.display,
    ).toBe("block");

    authSelect.value = "git_oauth";
    authSelect.dispatchEvent(new Event("change"));
    expect(
      (slot.querySelector('[data-region="git-account-region"]') as HTMLElement)
        .style.display,
    ).toBe("block");

    authSelect.value = "custom_header";
    authSelect.dispatchEvent(new Event("change"));
    expect(
      (
        slot.querySelector(
          '[data-region="custom-header-region"]',
        ) as HTMLElement
      ).style.display,
    ).toBe("block");

    document.body.removeChild(el);
  });

  it("handles buildCredentialRef errors and variations", async () => {
    const el = new ShadowClawMcpRemote();
    const slot = document.createElement("div");
    slot.innerHTML = `
      <select data-field="service-account-id"><option value="">None</option></select>
      <select data-field="git-account-id"><option value="">None</option></select>
      <input data-field="custom-header-name" value="" />
      <input data-field="custom-header-value" value="" />
    `;

    // None
    expect(await el.buildCredentialRef(slot, "none", null)).toBeNull();

    // Service PAT without account
    await expect(
      el.buildCredentialRef(slot, "service_pat", null),
    ).rejects.toThrow("Select a service account");

    // Service PAT with account
    slot.querySelector("select")!.innerHTML =
      '<option value="srv-1">Srv</option>';
    slot.querySelector("select")!.value = "srv-1";
    const ref1 = await el.buildCredentialRef(slot, "service_pat", null);
    expect(ref1?.authType).toBe("token");
    expect(ref1?.accountId).toBe("srv-1");

    // Git PAT without account
    await expect(el.buildCredentialRef(slot, "git_pat", null)).rejects.toThrow(
      "Select a git account",
    );

    // Git OAuth with account
    const gitSelect = slot.querySelector(
      '[data-field="git-account-id"]',
    ) as HTMLSelectElement;
    gitSelect.innerHTML = '<option value="git-1">Git</option>';
    gitSelect.value = "git-1";
    const ref2 = await el.buildCredentialRef(slot, "git_oauth", null);
    expect(ref2?.authType).toBe("oauth");
    expect(ref2?.gitAccountId).toBe("git-1");

    // Custom header missing name
    await expect(
      el.buildCredentialRef(slot, "custom_header", null),
    ).rejects.toThrow("Header name is required");

    // Custom header missing value
    (
      slot.querySelector(
        '[data-field="custom-header-name"]',
      ) as HTMLInputElement
    ).value = "X-API-Key";
    await expect(
      el.buildCredentialRef(slot, "custom_header", null),
    ).rejects.toThrow("Header value is required");

    // Custom header reusing existing encrypted value
    const existing = {
      id: "c1",
      label: "C1",
      serviceType: "mcp_remote" as const,
      serverUrl: "http://example.com",
      transport: "streamable_http" as const,
      enabled: true,
      autoReconnectOAuth: false,
      createdAt: 1,
      updatedAt: 1,
      credentialRef: {
        serviceType: "mcp_remote" as const,
        authType: "custom_header" as const,
        providerId: "custom_mcp",
        headerName: "X-API-Key",
        encryptedValue: "existing-encrypted",
      },
    };
    const ref3 = await el.buildCredentialRef(slot, "custom_header", existing);
    expect(ref3?.encryptedValue).toBe("existing-encrypted");

    // Custom header with new raw value
    (
      slot.querySelector(
        '[data-field="custom-header-value"]',
      ) as HTMLInputElement
    ).value = "secret123";
    const ref4 = await el.buildCredentialRef(slot, "custom_header", null);
    expect(ref4?.encryptedValue).toBe("enc-secret");
  });

  it("handles form validation, save errors, and updating existing connection", async () => {
    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();

    el.showConnectionForm("new");
    // Missing label & URL
    await el.saveConnectionForm();
    expect(mockUpsertConnection).not.toHaveBeenCalled();

    // Fill label & URL but mockUpsertConnection fails
    const labelInput = el.shadowRoot?.querySelector(
      '[data-field="connection-label"]',
    ) as HTMLInputElement;
    const urlInput = el.shadowRoot?.querySelector(
      '[data-field="connection-url"]',
    ) as HTMLInputElement;
    labelInput.value = "Test MCP";
    urlInput.value = "https://example.com";

    mockUpsertConnection.mockRejectedValueOnce(new Error("Database error"));
    await el.saveConnectionForm();

    // Update existing connection
    el.connections = [
      {
        id: "existing-1",
        label: "Old",
        serviceType: "mcp_remote",
        serverUrl: "https://old.com",
        transport: "streamable_http",
        enabled: true,
        autoReconnectOAuth: false,
        createdAt: 1,
        updatedAt: 1,
        credentialRef: null,
      },
    ];
    el.showConnectionForm("existing-1");
    mockUpsertConnection.mockResolvedValueOnce({
      id: "existing-1",
      label: "New",
      serviceType: "mcp_remote",
      serverUrl: "https://new.com",
      transport: "streamable_http",
      enabled: true,
      createdAt: 1,
      updatedAt: 2,
    });
    await el.saveConnectionForm();
    expect(mockUpsertConnection).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: "existing-1" }),
    );

    document.body.removeChild(el);
  });

  it("handles failure branches in deleteConnection, reconnectOAuth, and testConnection", async () => {
    const el = new ShadowClawMcpRemote() as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;
    el.connections = [];

    // Delete connection not found
    mockDeleteConnection.mockResolvedValueOnce(false);
    await el.deleteConnection("missing-id");

    // Delete connection throws
    mockDeleteConnection.mockRejectedValueOnce(new Error("Delete crash"));
    await el.deleteConnection("err-id");

    // Reconnect failure
    mockReconnectMcpOAuth.mockResolvedValueOnce({
      success: false,
      error: "OAuth expired",
    });
    await el.reconnectOAuth("conn-fail");

    // testConnection with existing diagnostic element & dismiss button
    mockTestConnection.mockResolvedValueOnce({
      success: false,
      error: "Timeout",
      toolCount: 0,
      toolNames: [],
      steps: [{ step: "Handshake", status: "error", detail: "Timeout" }],
    });
    const card = document.createElement("div");
    card.className = "connection-card";
    card.setAttribute("data-connection-id", "conn-test");
    const existingDiag = document.createElement("div");
    existingDiag.className = "connection-diagnostic";
    card.appendChild(existingDiag);
    el.shadowRoot.appendChild(card);

    await el.testConnection("conn-test");
    expect(card.querySelector(".diagnostic-header")?.textContent).toContain(
      "Connection Failed",
    );

    const closeBtn = card.querySelector(
      '[data-action="close-diagnostic"]',
    ) as HTMLElement;
    closeBtn?.click();
    expect(card.querySelector(".connection-diagnostic")).toBeNull();

    document.body.removeChild(el);
  });

  it("catches render errors gracefully", async () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockListConnections.mockRejectedValueOnce(new Error("DB locked"));

    const el = new ShadowClawMcpRemote();
    document.body.appendChild(el);
    await el.connectedCallback();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    document.body.removeChild(el);
  });

  it("handles null db and shadowRoot guards across methods", async () => {
    const el = new ShadowClawMcpRemote() as any;
    el.db = null;
    expect(await el.saveConnectionForm()).toBeUndefined();
    expect(await el.testConnection("c1")).toBeUndefined();
    expect(await el.deleteConnection("c1")).toBeUndefined();
    expect(await el.reconnectOAuth("c1")).toBeUndefined();
    expect(await el.render()).toBeUndefined();

    // With db but without slot
    el.db = {} as any;
    expect(await el.saveConnectionForm()).toBeUndefined();
  });

  it("validates custom header authentication in buildCredentialRef", async () => {
    const el = new ShadowClawMcpRemote() as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;
    el.showConnectionForm("new");

    const slot = el.shadowRoot.querySelector(
      '[data-region="connection-form-slot"]',
    );
    const headerNameInput = slot.querySelector(
      '[data-field="custom-header-name"]',
    );
    const headerValueInput = slot.querySelector(
      '[data-field="custom-header-value"]',
    );

    // Missing header name
    headerNameInput.value = "";
    await expect(
      el.buildCredentialRef(slot, "custom_header", null),
    ).rejects.toThrow("Header name is required");

    // Header name provided but empty value without existing connection
    headerNameInput.value = "X-MCP-Token";
    headerValueInput.value = "";
    await expect(
      el.buildCredentialRef(slot, "custom_header", null),
    ).rejects.toThrow("Header value is required");

    // Header name provided, empty value, but existing connection has encryptedValue
    const existing = {
      credentialRef: {
        authType: "custom_header",
        encryptedValue: "enc-stored",
      },
    };
    const ref = await el.buildCredentialRef(slot, "custom_header", existing);
    expect(ref.encryptedValue).toBe("enc-stored");
    expect(ref.headerName).toBe("X-MCP-Token");

    document.body.removeChild(el);
  });

  it("handles null shadowRoot and hides connection form when deleting active editing connection", async () => {
    const el = new ShadowClawMcpRemote() as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    el.db = {} as any;

    // Delete connection while editing it
    mockDeleteConnection.mockResolvedValue(true);
    el.editingConnectionId = "conn-edit-me";
    const hideSpy = jest.spyOn(el, "hideConnectionForm");
    await el.deleteConnection("conn-edit-me");
    expect(hideSpy).toHaveBeenCalled();

    // With null shadowRoot
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    expect(await el.saveConnectionForm()).toBeUndefined();
    expect(await el.testConnection("conn-1")).toBeUndefined();

    el.remove();
  });
});
