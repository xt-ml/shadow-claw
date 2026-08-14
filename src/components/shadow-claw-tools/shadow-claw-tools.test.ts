import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("../../config/config.js", () => ({
  getAvailableProviders: jest.fn(() => ["anthropic", "openai"]),
  getProvider: jest.fn((id) => ({ name: `Provider ${id}` })),
  DEFAULT_GROUP_ID: "default",
  CONFIG_KEYS: {},
}));

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn((cb: any) => {
    cb();
    return () => {};
  }),
}));

const mockSetWebMcpToolsEnabled = jest.fn();
jest.unstable_mockModule(
  "../../core/orchestrator/utils/syncWebMcpRegistration.js",
  () => ({
    setWebMcpToolsEnabled: mockSetWebMcpToolsEnabled,
    setWebMcpMode: jest.fn(),
  }),
);

jest.unstable_mockModule(
  "../../core/orchestrator/utils/operations/provider.js",
  () => ({
    getProviderRuntimeHeaders: jest.fn(),
    getApiKeyForRequest: jest.fn(),
  }),
);

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn(() => Promise.resolve({})),
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    orchestrator: {
      getWebMcpToolsEnabled: jest.fn(() => true),
      getWebMcpMode: jest.fn(() => "native"),
      setWebMcpToolsEnabled: jest.fn(),
      setWebMcpMode: jest.fn(),
    },
    ready: true,
    vmBashFullInternetAccess: false,
    setVMBashFullInternetAccess: jest.fn(),
  },
}));

jest.unstable_mockModule("../../stores/tools.js", () => ({
  toolsStore: {
    allTools: [
      { name: "bash", description: "Bash tool." },
      { name: "custom_tool", description: "A custom tool." },
    ],
    enabledToolNames: new Set(["bash"]),
    customTools: [{ name: "custom_tool", description: "A custom tool." }],
    systemPromptOverride: "Test prompt",
    profiles: [
      { id: "__builtin_1", name: "Builtin Profile" },
      { id: "custom_profile", name: "Custom Profile" },
    ],
    activeProfileId: "custom_profile",
    webSearchUseProxy: false,
    webSearchProxyUrl: "/proxy",
    webSearchUrl: "https://html.duckduckgo.com/html/?q={query}",
    searchFilesMaxFileBytes: 524288,
    searchFilesMaxFilesVisited: 1000,
    searchFilesSkipDirs: ".git,node_modules,dist",
    setSearchFilesMaxFileBytes: jest.fn(),
    setSearchFilesMaxFilesVisited: jest.fn(),
    setSearchFilesSkipDirs: jest.fn(),
    setWebSearchUseProxy: jest.fn(),
    setWebSearchProxyUrl: jest.fn(),
    setWebSearchUrl: jest.fn(),
    setAllEnabled: jest.fn(),
    setToolEnabled: jest.fn(),
    removeCustomTool: jest.fn(),
    setSystemPromptOverride: jest.fn(),
    addCustomTool: jest.fn(),
    cloneTool: jest.fn(() => Promise.resolve(true)),
    exportBackup: jest.fn(() => JSON.stringify({ tools: [] })),
    importBackup: jest.fn(),
    activateProfile: jest.fn(),
    deactivateProfile: jest.fn(),
    saveToActiveProfile: jest.fn(),
    addProfile: jest.fn(),
    deleteProfile: jest.fn(),
  },
}));

jest.unstable_mockModule("../../subsystems/tools/tools.js", () => ({
  TOOL_DEFINITIONS: [{ name: "bash" }],
}));

jest.unstable_mockModule("../../ui/toast.js", () => ({
  showError: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.unstable_mockModule("../../utils/ulid.js", () => ({
  ulid: jest.fn(() => "mock-ulid"),
}));

const { ShadowClawTools } = await import("./shadow-claw-tools.js");
const { toolsStore } = (await import("../../stores/tools.js")) as any;
const { orchestratorStore } =
  (await import("../../stores/orchestrator.js")) as any;
const { showSuccess } = (await import("../../ui/toast.js")) as any;

describe("shadow-claw-tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render and setup effects correctly", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const root = el.shadowRoot;
    expect(root).toBeTruthy();

    // Check tool list
    const items = root?.querySelectorAll(".tools__item");
    expect(items?.length).toBe(2);

    document.body.removeChild(el);
  });

  it("should handle backup", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const mockRevoke = jest.fn();
    const mockCreateObjectURL = jest.fn(() => "blob:url");
    global.URL.createObjectURL = mockCreateObjectURL as any;
    global.URL.revokeObjectURL = mockRevoke as any;

    el.handleBackup();

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevoke).toHaveBeenCalled();
    expect(toolsStore.exportBackup).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith("Tools config exported");

    document.body.removeChild(el);
  });

  it("should open clone dialog", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const cloneDialog = el.shadowRoot?.querySelector(
      ".tools__clone-dialog",
    ) as HTMLDialogElement;
    if (cloneDialog) cloneDialog.showModal = jest.fn();

    el.openCloneDialog("bash");

    expect(cloneDialog.showModal).toHaveBeenCalled();
    const sourceInput = el.shadowRoot?.querySelector(
      '[name="source"]',
    ) as HTMLInputElement;
    expect(sourceInput.value).toBe("bash");

    document.body.removeChild(el);
  });

  it("should handle add tool", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const form = document.createElement("form");
    const nameInput = document.createElement("input");
    nameInput.name = "name";
    nameInput.value = "new_tool";
    const descInput = document.createElement("input");
    descInput.name = "description";
    descInput.value = "new description";
    form.append(nameInput, descInput);

    const dialog = el.shadowRoot?.querySelector(
      ".tools__dialog",
    ) as HTMLDialogElement;
    if (dialog) dialog.close = jest.fn();

    await el.handleAddTool({} as any, form);

    expect(toolsStore.addCustomTool).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: "new_tool",
        description: "new description",
      }),
    );
    expect(showSuccess).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("should handle clone tool", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const form = document.createElement("form");
    const sourceInput = document.createElement("input");
    sourceInput.name = "source";
    sourceInput.value = "bash";
    const nameInput = document.createElement("input");
    nameInput.name = "name";
    nameInput.value = "cloned_bash";
    form.append(sourceInput, nameInput);

    const dialog = el.shadowRoot?.querySelector(
      ".tools__clone-dialog",
    ) as HTMLDialogElement;
    if (dialog) dialog.close = jest.fn();

    await el.handleCloneTool({} as any, form);

    expect(toolsStore.cloneTool).toHaveBeenCalledWith(
      expect.anything(),
      "bash",
      "cloned_bash",
      undefined,
    );
    expect(showSuccess).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("should handle save profile", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const form = document.createElement("form");
    const nameInput = document.createElement("input");
    nameInput.name = "name";
    nameInput.value = "New Profile";
    form.append(nameInput);

    const dialog = el.shadowRoot?.querySelector(
      ".tools__profile-dialog",
    ) as HTMLDialogElement;
    if (dialog) dialog.close = jest.fn();

    await el.handleSaveProfile({} as any, form);

    expect(toolsStore.addProfile).toHaveBeenCalled();
    expect(toolsStore.activateProfile).toHaveBeenCalledWith(
      expect.anything(),
      "mock-ulid",
    );
    expect(showSuccess).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("should handle restore", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const input = document.createElement("input");
    const mockFile = new File(['{"tools":[]}'], "backup.json", {
      type: "application/json",
    });
    (mockFile as any).text = jest.fn<any>().mockResolvedValue('{"tools":[]}');
    Object.defineProperty(input, "files", {
      value: [mockFile],
    });

    await el.handleRestore({} as any, input);

    expect(toolsStore.importBackup).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("bindEventListeners toggles WebMCP", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const webMcpToggle = el.shadowRoot?.querySelector(
      ".tools__webmcp-toggle",
    ) as HTMLInputElement;
    if (webMcpToggle) {
      webMcpToggle.checked = false;
      webMcpToggle.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 0));
      expect(mockSetWebMcpToolsEnabled).toHaveBeenCalledWith(
        orchestratorStore.orchestrator,
        expect.anything(),
        false,
        { orchestrator: orchestratorStore.orchestrator },
      );
    }
    document.body.removeChild(el);
  });

  it("toggles Web Search proxy setting", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const toggle = el.shadowRoot?.querySelector(
      ".tools__websearch-proxy-toggle",
    ) as HTMLInputElement;
    expect(toggle).toBeTruthy();

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));

    await new Promise((r) => setTimeout(r, 0));
    expect(toolsStore.setWebSearchUseProxy).toHaveBeenCalledWith(
      expect.anything(),
      true,
    );

    document.body.removeChild(el);
  });

  it("saves Web Search Proxy URL and Search URL settings", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const proxyInput = el.shadowRoot?.querySelector(
      ".tools__websearch-proxy-url-input",
    ) as HTMLInputElement;
    const urlInput = el.shadowRoot?.querySelector(
      ".tools__websearch-url-input",
    ) as HTMLInputElement;
    const saveBtn = el.shadowRoot?.querySelector(
      ".tools__save-websearch-btn",
    ) as HTMLButtonElement;

    expect(proxyInput).toBeTruthy();
    expect(urlInput).toBeTruthy();
    expect(saveBtn).toBeTruthy();

    proxyInput.value = "/custom-proxy";
    urlInput.value = "https://search.example.com/?q={query}";
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 0));
    expect(toolsStore.setWebSearchProxyUrl).toHaveBeenCalledWith(
      expect.anything(),
      "/custom-proxy",
    );
    expect(toolsStore.setWebSearchUrl).toHaveBeenCalledWith(
      expect.anything(),
      "https://search.example.com/?q={query}",
    );

    document.body.removeChild(el);
  });

  it("saves Search Files settings (maxFileBytes, maxFilesVisited, skipDirs)", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const maxBytesInput = el.shadowRoot?.querySelector(
      ".tools__searchfiles-max-file-bytes-input",
    ) as HTMLInputElement;
    const maxVisitedInput = el.shadowRoot?.querySelector(
      ".tools__searchfiles-max-files-visited-input",
    ) as HTMLInputElement;
    const skipDirsInput = el.shadowRoot?.querySelector(
      ".tools__searchfiles-skip-dirs-input",
    ) as HTMLInputElement;
    const saveBtn = el.shadowRoot?.querySelector(
      ".tools__save-searchfiles-btn",
    ) as HTMLButtonElement;

    expect(maxBytesInput).toBeTruthy();
    expect(maxVisitedInput).toBeTruthy();
    expect(skipDirsInput).toBeTruthy();
    expect(saveBtn).toBeTruthy();

    maxBytesInput.value = "1048576";
    maxVisitedInput.value = "2000";
    skipDirsInput.value = ".git,node_modules,custom_dir";
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 0));
    expect(toolsStore.setSearchFilesMaxFileBytes).toHaveBeenCalledWith(
      expect.anything(),
      1048576,
    );
    expect(toolsStore.setSearchFilesMaxFilesVisited).toHaveBeenCalledWith(
      expect.anything(),
      2000,
    );
    expect(toolsStore.setSearchFilesSkipDirs).toHaveBeenCalledWith(
      expect.anything(),
      ".git,node_modules,custom_dir",
    );

    document.body.removeChild(el);
  });
});
