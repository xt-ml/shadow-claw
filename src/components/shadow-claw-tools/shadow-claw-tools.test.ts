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
  "../../core/orchestrator/utils/sync-web-mcp-registration.js",
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
    enabledTools: [{ name: "bash", description: "Bash tool." }],
    customTools: [{ name: "custom_tool", description: "A custom tool." }],
    declarativeTools: [],
    declarativeToolNamesEnabled: null,
    enabledDeclarativeTools: [],
    isDeclarativeToolEnabled: jest.fn(() => true),
    refreshDeclarativeTools: jest.fn(() => Promise.resolve([])),
    setDeclarativeToolEnabled: jest.fn(),
    setAllDeclarativeEnabled: jest.fn(),
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
    fetchRemoteDiscoveryManifest: jest.fn(),
    importFromRemoteSite: jest.fn(),
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
const { showSuccess, showInfo, showError } =
  (await import("../../ui/toast.js")) as any;

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

  it("should correctly compute total enabled tool count when built-in tools are disabled and declarative tools are enabled", async () => {
    // Simulate toolsStore where built-in enabledTools has 0 items and enabledDeclarativeTools has 3 items
    toolsStore.enabledTools = [];
    toolsStore.enabledDeclarativeTools = [
      { name: "scan_for_nearby_ores", description: "Scan" },
      { name: "fireworks", description: "Fireworks" },
      { name: "konami_code", description: "Konami" },
    ];
    toolsStore.allTools = [
      { name: "bash", description: "Bash" },
      { name: "custom_tool", description: "Custom" },
    ];
    toolsStore.declarativeTools = [
      { name: "scan_for_nearby_ores", description: "Scan" },
      { name: "fireworks", description: "Fireworks" },
      { name: "konami_code", description: "Konami" },
    ];

    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    const countEl = el.shadowRoot?.querySelector(".tools__count");
    expect(countEl?.textContent).toBe("3 of 5 enabled");

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

  it("handles handleAddTool, handleCloneTool, handleRestore, and handleSaveProfile", async () => {
    const el = new ShadowClawTools() as any;
    document.body.appendChild(el);
    await el.connectedCallback();
    const db = {} as any;

    const dialog = el.shadowRoot?.querySelector(".tools__dialog");
    if (dialog) (dialog as any).close = jest.fn();
    const cloneDialog = el.shadowRoot?.querySelector(".tools__clone-dialog");
    if (cloneDialog) (cloneDialog as any).close = jest.fn();
    const profileDialog = el.shadowRoot?.querySelector(
      ".tools__profile-dialog",
    );
    if (profileDialog) (profileDialog as any).close = jest.fn();

    // 1. Add Tool validation
    const form = document.createElement("form");
    form.innerHTML = `
      <input name="name" value="" />
      <input name="description" value="" />
    `;
    await el.handleAddTool(db, form);
    expect(toolsStore.addCustomTool).not.toHaveBeenCalled();

    // 2. Add Tool success
    form.innerHTML = `
      <input name="name" value="unique_tool" />
      <input name="description" value="A unique tool" />
      <input name="input_schema" value='{"type":"object"}' />
    `;
    await el.handleAddTool(db, form);
    expect(toolsStore.addCustomTool).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ name: "unique_tool" }),
    );

    // 3. Clone Tool
    const cloneForm = document.createElement("form");
    cloneForm.innerHTML = `
      <input name="source" value="bash" />
      <input name="name" value="bash_copy" />
      <input name="description" value="Cloned bash" />
    `;
    await el.handleCloneTool(db, cloneForm);
    expect(toolsStore.cloneTool).toHaveBeenCalledWith(
      db,
      "bash",
      "bash_copy",
      "Cloned bash",
    );

    // 4. Restore backup
    const restoreFile = {
      text: jest
        .fn<() => Promise<string>>()
        .mockResolvedValue(JSON.stringify({ tools: [] })),
    };
    const restoreInput = {
      files: [restoreFile],
      value: "backup.json",
    } as any;
    await el.handleRestore(db, restoreInput);
    expect(toolsStore.importBackup).toHaveBeenCalled();

    // 5. Save Profile
    const profileForm = document.createElement("form");
    profileForm.innerHTML = `
      <input name="name" value="Dev Profile" />
      <input name="providerId" value="anthropic" />
      <input name="model" value="claude-3" />
    `;
    await el.handleSaveProfile(db, profileForm);
    expect(toolsStore.addProfile).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ name: "Dev Profile", providerId: "anthropic" }),
    );

    // 6. Remote Site Import flow
    const fakeManifest = {
      name: "pwgen Knowledge Hub",
      description: "Password Generator Knowledge Hub",
      tools: [
        {
          name: "pwgen",
          description: "Generate password",
          url: "https://example.com/tools/pwgen.json",
        },
      ],
      skills: [
        {
          name: "pwgen",
          description: "Pwgen skill",
          url: "https://example.com/skills/pwgen/SKILL.md",
        },
      ],
      scripts: [
        {
          name: "pwgen",
          description: "Pwgen engine script",
          url: "https://example.com/scripts/pwgen.js",
        },
      ],
    };

    toolsStore.fetchRemoteDiscoveryManifest.mockResolvedValueOnce({
      manifest: fakeManifest,
      siteUrl: "https://example.com",
      manifestUrl: "https://example.com/.well-known/agent-skills/index.json",
    });

    await el.handleFetchSite(db, "https://example.com");
    expect(toolsStore.fetchRemoteDiscoveryManifest).toHaveBeenCalledWith(
      "https://example.com",
    );
    expect(el.currentRemoteManifest).toBe(fakeManifest);

    const root = el.shadowRoot;
    const siteNameEl = root?.querySelector(".tools__import-site-name");
    expect(siteNameEl?.textContent).toBe("pwgen Knowledge Hub");

    const catalogItems = root?.querySelectorAll(".tools__import-item");
    expect(catalogItems?.length).toBe(3); // 1 tool + 1 skill + 1 script

    toolsStore.importFromRemoteSite.mockResolvedValueOnce({
      tools: [
        {
          name: "pwgen",
          path: ".agents/tools/main/pwgen.json",
          status: "imported",
        },
      ],
      skills: [
        {
          name: "pwgen",
          path: ".agents/skills/main/pwgen/SKILL.md",
          status: "imported",
        },
      ],
      scripts: [
        {
          name: "pwgen",
          path: ".agents/scripts/main/pwgen.js",
          status: "imported",
        },
      ],
      diagnostics: [],
    });

    const importForm = root?.querySelector(
      ".tools__import-dialog-form",
    ) as HTMLFormElement;
    await el.handleImportSubmit(db, importForm);

    expect(toolsStore.importFromRemoteSite).toHaveBeenCalledWith(
      db,
      fakeManifest,
      expect.objectContaining({
        toolNames: ["pwgen"],
        skillNames: ["pwgen"],
        scriptNames: ["pwgen"],
      }),
      expect.objectContaining({
        autoEnable: true,
        overwrite: false,
      }),
    );
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Successfully imported 3 items"),
    );

    document.body.removeChild(el);
  });

  it("handles back button, add button, restore button, and select all/none", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const root = el.shadowRoot!;

    // 1. Back button
    let backNavigated = false;
    el.addEventListener("navigate-back", () => {
      backNavigated = true;
    });
    const backBtn = root.querySelector(".tools__back-btn") as HTMLButtonElement;
    backBtn?.dispatchEvent(new Event("click"));
    expect(backNavigated).toBe(true);

    // 2. Add button
    const dialog = root.querySelector("dialog") as HTMLDialogElement;
    dialog.showModal = jest.fn();
    const addBtn = root.querySelector(".tools__add-btn") as HTMLButtonElement;
    addBtn?.dispatchEvent(new Event("click"));
    expect(dialog.showModal).toHaveBeenCalled();

    // 3. Restore button
    const restoreBtn = root.querySelector(
      ".tools__restore-btn",
    ) as HTMLButtonElement;
    const restoreInput = root.querySelector(
      ".tools__hidden-restore",
    ) as HTMLInputElement;
    const clickSpy = jest
      .spyOn(restoreInput, "click")
      .mockImplementation(() => {});
    restoreBtn?.dispatchEvent(new Event("click"));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();

    // 4. Select all / none
    const selectAllBtn = root.querySelector(
      ".tools__select-all-btn",
    ) as HTMLButtonElement;
    selectAllBtn?.dispatchEvent(new Event("click"));
    expect(toolsStore.setAllEnabled).toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith("All tools enabled");

    const selectNoneBtn = root.querySelector(
      ".tools__select-none-btn",
    ) as HTMLButtonElement;
    selectNoneBtn?.dispatchEvent(new Event("click"));
    expect(showInfo).toHaveBeenCalledWith("All tools disabled");

    document.body.removeChild(el);
  });

  it("handles WebMCP, internet access, and Web Search toggles", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const root = el.shadowRoot!;

    // 1. WebMCP toggle
    const webMcpToggle = root.querySelector(
      ".tools__webmcp-toggle",
    ) as HTMLInputElement;
    if (webMcpToggle) {
      webMcpToggle.checked = true;
      webMcpToggle.dispatchEvent(new Event("change"));
      await new Promise((r) => setTimeout(r, 20));
      expect(showInfo).toHaveBeenCalledWith("WebMCP tool registration enabled");

      // Without orchestrator
      el.orchestrator = null;
      (orchestratorStore as any).orchestrator = null;
      webMcpToggle.checked = true;
      webMcpToggle.dispatchEvent(new Event("change"));
      await new Promise((r) => setTimeout(r, 20));
      expect(showError).toHaveBeenCalledWith("Orchestrator is not ready");

      // Restore orchestrator
      (orchestratorStore as any).orchestrator = {
        getWebMcpToolsEnabled: jest.fn(() => true),
        getWebMcpMode: jest.fn(() => "native"),
        setWebMcpToolsEnabled: jest.fn(),
        setWebMcpMode: jest.fn(),
      };
    }

    // 2. Internet access toggle
    const internetToggle = root.querySelector(
      ".tools__internet-access-toggle",
    ) as HTMLInputElement;
    if (internetToggle) {
      internetToggle.checked = true;
      internetToggle.dispatchEvent(new Event("change"));
      await new Promise((r) => setTimeout(r, 20));
      expect(orchestratorStore.setVMBashFullInternetAccess).toHaveBeenCalled();
      expect(showInfo).toHaveBeenCalledWith(
        "Full internet access enabled for Bash and JavaScript tools",
      );
    }

    // 3. Web Search proxy toggle
    const proxyToggle = root.querySelector(
      ".tools__websearch-proxy-toggle",
    ) as HTMLInputElement;
    if (proxyToggle) {
      proxyToggle.checked = true;
      proxyToggle.dispatchEvent(new Event("change"));
      await new Promise((r) => setTimeout(r, 20));
      expect(toolsStore.setWebSearchUseProxy).toHaveBeenCalled();
      expect(showInfo).toHaveBeenCalledWith("Web Search local proxy enabled");
    }

    document.body.removeChild(el);
  });

  it("handles prompt override save, clear, and dialog controls", async () => {
    const el = new ShadowClawTools();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const root = el.shadowRoot!;

    // 1. Save and Clear prompt
    const textarea = root.querySelector(
      ".tools__prompt-area",
    ) as HTMLTextAreaElement;
    if (textarea) textarea.value = "Custom system instructions";

    const savePromptBtn = root.querySelector(
      ".tools__save-prompt-btn",
    ) as HTMLButtonElement;
    savePromptBtn?.dispatchEvent(new Event("click"));
    expect(toolsStore.setSystemPromptOverride).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith("System prompt override saved");

    const clearPromptBtn = root.querySelector(
      ".tools__clear-prompt-btn",
    ) as HTMLButtonElement;
    clearPromptBtn?.dispatchEvent(new Event("click"));
    expect(showSuccess).toHaveBeenCalledWith("System prompt override cleared");

    // 2. Dialog controls (close, cancel, backdrop)
    const dialog = root.querySelector(".tools__dialog") as HTMLDialogElement;
    if (dialog) {
      dialog.close = jest.fn();
      const closeBtn = dialog.querySelector(
        ".tools__dialog-close",
      ) as HTMLButtonElement;
      closeBtn?.dispatchEvent(new Event("click"));
      expect(dialog.close).toHaveBeenCalledTimes(1);

      const cancelBtn = dialog.querySelector(
        ".tools__btn-cancel",
      ) as HTMLButtonElement;
      cancelBtn?.dispatchEvent(new Event("click"));
      expect(dialog.close).toHaveBeenCalledTimes(2);

      Object.defineProperty(dialog, "target", { value: dialog });
      dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(dialog.close).toHaveBeenCalledTimes(3);
    }

    // 3. Clone dialog controls
    const cloneDialog = root.querySelector(
      ".tools__clone-dialog",
    ) as HTMLDialogElement;
    if (cloneDialog) {
      cloneDialog.close = jest.fn();
      const cloneCloseBtn = root.querySelector(
        ".tools__clone-dialog-close",
      ) as HTMLButtonElement;
      cloneCloseBtn?.dispatchEvent(new Event("click"));
      expect(cloneDialog.close).toHaveBeenCalledTimes(1);

      const cloneCancelBtn = root.querySelector(
        ".tools__clone-cancel-btn",
      ) as HTMLButtonElement;
      cloneCancelBtn?.dispatchEvent(new Event("click"));
      expect(cloneDialog.close).toHaveBeenCalledTimes(2);
    }

    // 4. Profile dialog controls and Profile select
    const profileDialog = root.querySelector(
      ".tools__profile-dialog",
    ) as HTMLDialogElement;
    if (profileDialog) {
      profileDialog.close = jest.fn();
      const profileCloseBtn = root.querySelector(
        ".tools__profile-dialog-close",
      ) as HTMLButtonElement;
      profileCloseBtn?.dispatchEvent(new Event("click"));
      expect(profileDialog.close).toHaveBeenCalledTimes(1);

      const profileCancelBtn = root.querySelector(
        ".tools__profile-cancel-btn",
      ) as HTMLButtonElement;
      profileCancelBtn?.dispatchEvent(new Event("click"));
      expect(profileDialog.close).toHaveBeenCalledTimes(2);

      Object.defineProperty(profileDialog, "target", { value: profileDialog });
      profileDialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(profileDialog.close).toHaveBeenCalledTimes(3);
    }

    const profileSelect = root.querySelector(
      ".tools__profile-select",
    ) as HTMLSelectElement;
    if (profileSelect) {
      profileSelect.value = "custom_profile";
      profileSelect.dispatchEvent(new Event("change"));
      expect(toolsStore.activateProfile).toHaveBeenCalled();
      expect(showInfo).toHaveBeenCalledWith("Profile activated");

      profileSelect.value = "";
      profileSelect.dispatchEvent(new Event("change"));
      expect(toolsStore.deactivateProfile).toHaveBeenCalled();
      expect(showInfo).toHaveBeenCalledWith("Profile deactivated");
    }

    document.body.removeChild(el);
  });

  it("handles event listener failure paths and UI interactions", async () => {
    const el = new ShadowClawTools() as any;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    const root = el.shadowRoot!;
    const db = {} as any;

    // 1. Add Tool dialog open via button
    const addBtn = root.querySelector(".tools__add-btn") as HTMLButtonElement;
    const addDialog = root.querySelector("dialog") as HTMLDialogElement;
    addDialog.showModal = jest.fn();
    addBtn?.click();
    expect(addDialog.showModal).toHaveBeenCalled();

    // 2. WebMCP toggle when orchestrator is null
    el.orchestrator = null;
    orchestratorStore.orchestrator = null;
    const webMcpToggle = root.querySelector(
      ".tools__webmcp-toggle",
    ) as HTMLInputElement;
    webMcpToggle.checked = true;
    webMcpToggle.dispatchEvent(new Event("change"));
    expect(showError).toHaveBeenCalledWith("Orchestrator is not ready");
    expect(webMcpToggle.checked).toBe(false);

    // Restore orchestrator and test WebMCP toggle error throw (Error and string error)
    orchestratorStore.orchestrator = {
      getWebMcpToolsEnabled: jest.fn(() => true),
      getWebMcpMode: jest.fn(() => "native"),
    };
    mockSetWebMcpToolsEnabled.mockRejectedValueOnce(
      new Error("WebMCP toggle failure"),
    );
    webMcpToggle.checked = true;
    webMcpToggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to update WebMCP setting: WebMCP toggle failure",
    );
    expect(webMcpToggle.checked).toBe(false);

    mockSetWebMcpToolsEnabled.mockRejectedValueOnce("WebMCP string error");
    webMcpToggle.checked = true;
    webMcpToggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to update WebMCP setting: WebMCP string error",
    );

    // 3. Internet access toggle error throw (string error and Error)
    orchestratorStore.setVMBashFullInternetAccess.mockRejectedValueOnce(
      "String error",
    );
    const internetToggle = root.querySelector(
      ".tools__internet-access-toggle",
    ) as HTMLInputElement;
    internetToggle.checked = true;
    internetToggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to update internet access setting: String error",
    );
    expect(internetToggle.checked).toBe(false);

    orchestratorStore.setVMBashFullInternetAccess.mockRejectedValueOnce(
      new Error("Err obj"),
    );
    internetToggle.checked = true;
    internetToggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to update internet access setting: Err obj",
    );

    // Internet access toggle success (disabled branch)
    orchestratorStore.setVMBashFullInternetAccess.mockResolvedValueOnce(
      undefined,
    );
    internetToggle.checked = false;
    internetToggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showInfo).toHaveBeenCalledWith(
      "Full internet access disabled for Bash and JavaScript tools",
    );

    // 4. Web Search Proxy toggle error throw (Error and string)
    toolsStore.setWebSearchUseProxy.mockRejectedValueOnce(
      new Error("Proxy error"),
    );
    const webSearchProxyToggle = root.querySelector(
      ".tools__websearch-proxy-toggle",
    ) as HTMLInputElement;
    webSearchProxyToggle.checked = true;
    webSearchProxyToggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to update Web Search proxy setting: Proxy error",
    );

    toolsStore.setWebSearchUseProxy.mockRejectedValueOnce("Proxy string error");
    webSearchProxyToggle.checked = true;
    webSearchProxyToggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to update Web Search proxy setting: Proxy string error",
    );

    // Web Search Proxy toggle success (disabled branch)
    toolsStore.setWebSearchUseProxy.mockResolvedValueOnce(undefined);
    webSearchProxyToggle.checked = false;
    webSearchProxyToggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showInfo).toHaveBeenCalledWith("Web Search local proxy disabled");

    // 5. Search files save button error throw (Error and string) and with invalid numbers
    const maxFileBytesInput = root.querySelector(
      ".tools__searchfiles-max-file-bytes-input",
    ) as HTMLInputElement;
    const maxFilesVisitedInput = root.querySelector(
      ".tools__searchfiles-max-files-visited-input",
    ) as HTMLInputElement;
    maxFileBytesInput.value = "-5"; // <= 0 branch
    maxFilesVisitedInput.value = "abc"; // NaN branch

    toolsStore.setSearchFilesSkipDirs.mockRejectedValueOnce(
      new Error("SkipDirs error"),
    );
    const saveSearchBtn = root.querySelector(
      ".tools__save-searchfiles-btn",
    ) as HTMLButtonElement;
    saveSearchBtn?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to save Search Files settings: SkipDirs error",
    );

    toolsStore.setSearchFilesSkipDirs.mockRejectedValueOnce(
      "SkipDirs string error",
    );
    saveSearchBtn?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to save Search Files settings: SkipDirs string error",
    );

    // 6. Web Search save button error throw and defaults (empty strings)
    const proxyInput = root.querySelector(
      ".tools__websearch-proxy-url-input",
    ) as HTMLInputElement;
    const searchUrlInput = root.querySelector(
      ".tools__websearch-url-input",
    ) as HTMLInputElement;
    proxyInput.value = "";
    searchUrlInput.value = "";
    toolsStore.setWebSearchProxyUrl.mockRejectedValueOnce(
      new Error("Save URL error"),
    );
    const saveWebSearchBtn = root.querySelector(
      ".tools__save-websearch-btn",
    ) as HTMLButtonElement;
    saveWebSearchBtn?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to save Web Search settings: Save URL error",
    );

    toolsStore.setWebSearchProxyUrl.mockRejectedValueOnce(
      "Save URL string error",
    );
    saveWebSearchBtn?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to save Web Search settings: Save URL string error",
    );

    // 7. WebMCP mode select: null orchestrator vs error (Error and string)
    const webMcpModeSelect = root.querySelector(
      ".tools__webmcp-mode",
    ) as HTMLSelectElement;
    el.orchestrator = null;
    orchestratorStore.orchestrator = null;
    webMcpModeSelect.value = "native";
    webMcpModeSelect.dispatchEvent(new Event("change")); // orchestrator null -> returns early

    const { setWebMcpMode } =
      (await import("../../core/orchestrator/utils/sync-web-mcp-registration.js")) as any;
    el.orchestrator = { webMcpToolsEnabled: true };
    setWebMcpMode.mockRejectedValueOnce(new Error("Mode error"));
    webMcpModeSelect.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to update WebMCP mode: Mode error",
    );

    setWebMcpMode.mockRejectedValueOnce("Mode string error");
    webMcpModeSelect.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showError).toHaveBeenCalledWith(
      "Failed to update WebMCP mode: Mode string error",
    );

    setWebMcpMode.mockResolvedValueOnce(undefined);
    webMcpModeSelect.value = "polyfill";
    webMcpModeSelect.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(showInfo).toHaveBeenCalledWith("WebMCP mode set to polyfill");

    // 8. Prompt buttons: save and clear
    const promptArea = root.querySelector(
      ".tools__prompt-area",
    ) as HTMLTextAreaElement;
    promptArea.value = "Custom system prompt";
    const savePromptBtn = root.querySelector(
      ".tools__save-prompt-btn",
    ) as HTMLButtonElement;
    savePromptBtn?.click();
    expect(toolsStore.setSystemPromptOverride).toHaveBeenCalledWith(
      expect.anything(),
      "Custom system prompt",
    );
    expect(showSuccess).toHaveBeenCalledWith("System prompt override saved");

    const clearPromptBtn = root.querySelector(
      ".tools__clear-prompt-btn",
    ) as HTMLButtonElement;
    clearPromptBtn?.click();
    expect(promptArea.value).toBe("");
    expect(toolsStore.setSystemPromptOverride).toHaveBeenCalledWith(
      expect.anything(),
      "",
    );
    expect(showSuccess).toHaveBeenCalledWith("System prompt override cleared");

    // 9. Profile controls: New, Save, Delete
    const profileNewBtn = root.querySelector(
      ".tools__profile-new-btn",
    ) as HTMLButtonElement;
    const profileDialog = root.querySelector(
      ".tools__profile-dialog",
    ) as HTMLDialogElement;
    profileDialog.showModal = jest.fn();
    profileNewBtn?.click();
    expect(profileDialog.showModal).toHaveBeenCalled();

    // Profile save when activeProfileId is null -> delegates to New Profile button
    toolsStore.activeProfileId = null;
    const profileSaveBtn = root.querySelector(
      ".tools__profile-save-btn",
    ) as HTMLButtonElement;
    profileSaveBtn?.click();

    // Profile save when activeProfileId is present
    toolsStore.activeProfileId = "custom_profile";
    toolsStore.saveToActiveProfile.mockResolvedValueOnce(undefined);
    profileSaveBtn?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(toolsStore.saveToActiveProfile).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith("Profile saved");

    // Profile delete: no active profile
    toolsStore.activeProfileId = null;
    const profileDeleteBtn = root.querySelector(
      ".tools__profile-delete-btn",
    ) as HTMLButtonElement;
    profileDeleteBtn?.click();
    expect(showInfo).toHaveBeenCalledWith("No profile selected");

    // Profile delete: builtin profile
    toolsStore.activeProfileId = "__builtin_default";
    profileDeleteBtn?.click();
    expect(showInfo).toHaveBeenCalledWith(
      "Built-in profiles cannot be deleted",
    );

    // Profile delete: custom profile
    toolsStore.activeProfileId = "custom_profile";
    toolsStore.deleteProfile.mockResolvedValueOnce(undefined);
    profileDeleteBtn?.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(toolsStore.deleteProfile).toHaveBeenCalledWith(
      expect.anything(),
      "custom_profile",
    );
    expect(showSuccess).toHaveBeenCalledWith("Profile deleted");

    // 10. Import Dialog controls: Import button, Close, Cancel, Backdrop, Preset btn, Fetch btn
    const importBtn = root.querySelector(
      ".tools__import-btn",
    ) as HTMLButtonElement;
    const importDialog = root.querySelector(
      ".tools__import-dialog",
    ) as HTMLDialogElement;
    importDialog.showModal = jest.fn();
    importDialog.close = jest.fn();
    importBtn?.click();
    expect(importDialog.showModal).toHaveBeenCalled();

    const importCloseBtn = root.querySelector(
      ".tools__import-dialog-close",
    ) as HTMLButtonElement;
    importCloseBtn?.click();
    expect(importDialog.close).toHaveBeenCalledTimes(1);

    const importCancelBtn = root.querySelector(
      ".tools__import-cancel-btn",
    ) as HTMLButtonElement;
    importCancelBtn?.click();
    expect(importDialog.close).toHaveBeenCalledTimes(2);

    // Click inside child element (bubbles up, target !== importDialog)
    const insideEl = document.createElement("div");
    importDialog.appendChild(insideEl);
    insideEl.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(importDialog.close).toHaveBeenCalledTimes(2); // Not called when target !== importDialog

    // Click backdrop (target === importDialog)
    importDialog.dispatchEvent(new MouseEvent("click", { bubbles: false }));
    expect(importDialog.close).toHaveBeenCalledTimes(3);

    // Preset button without url
    const presetBtn = root.querySelector(
      ".tools__preset-btn",
    ) as HTMLButtonElement;
    if (presetBtn) {
      delete presetBtn.dataset.url;
      const handleFetchSpy = jest
        .spyOn(el, "handleFetchSite")
        .mockImplementation(async () => {});
      presetBtn.click();
      expect(handleFetchSpy).not.toHaveBeenCalled();

      // Preset button with url
      presetBtn.dataset.url = "https://preset.example.com";
      presetBtn.click();
      expect(handleFetchSpy).toHaveBeenCalledWith(
        db,
        "https://preset.example.com",
      );

      // Fetch button with empty url
      const importUrlInput = root.querySelector(
        ".tools__import-url-input",
      ) as HTMLInputElement;
      importUrlInput.value = "   ";
      const fetchBtn = root.querySelector(
        ".tools__import-fetch-btn",
      ) as HTMLButtonElement;
      handleFetchSpy.mockClear();
      fetchBtn?.click();
      expect(handleFetchSpy).not.toHaveBeenCalled();

      importUrlInput.value = "https://manual.example.com";
      fetchBtn?.click();
      expect(handleFetchSpy).toHaveBeenCalledWith(
        db,
        "https://manual.example.com",
      );

      handleFetchSpy.mockRestore();
    }

    // 11. Form submissions
    const handleAddToolSpy = jest
      .spyOn(el, "handleAddTool")
      .mockImplementation(async () => {});
    const addForm = root.querySelector(
      ".tools__dialog-form",
    ) as HTMLFormElement;
    addForm?.dispatchEvent(new Event("submit"));
    expect(handleAddToolSpy).toHaveBeenCalled();

    const handleCloneToolSpy = jest
      .spyOn(el, "handleCloneTool")
      .mockImplementation(async () => {});
    const cloneForm = root.querySelector(
      ".tools__clone-dialog-form",
    ) as HTMLFormElement;
    cloneForm?.dispatchEvent(new Event("submit"));
    expect(handleCloneToolSpy).toHaveBeenCalled();

    const handleSaveProfileSpy = jest
      .spyOn(el, "handleSaveProfile")
      .mockImplementation(async () => {});
    const profileForm = root.querySelector(
      ".tools__profile-dialog-form",
    ) as HTMLFormElement;
    profileForm?.dispatchEvent(new Event("submit"));
    expect(handleSaveProfileSpy).toHaveBeenCalled();

    const handleImportSubmitSpy = jest
      .spyOn(el, "handleImportSubmit")
      .mockImplementation(async () => {});
    const importForm = root.querySelector(
      ".tools__import-dialog-form",
    ) as HTMLFormElement;
    importForm?.dispatchEvent(new Event("submit"));
    expect(handleImportSubmitSpy).toHaveBeenCalled();

    // 12. Clone dialog backdrop clicks
    const cloneDialogEl = root.querySelector(
      ".tools__clone-dialog",
    ) as HTMLDialogElement;
    cloneDialogEl.close = jest.fn();
    const cloneInside = document.createElement("div");
    cloneDialogEl.appendChild(cloneInside);
    cloneInside.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cloneDialogEl.close).not.toHaveBeenCalled();

    cloneDialogEl.dispatchEvent(new MouseEvent("click", { bubbles: false }));
    expect(cloneDialogEl.close).toHaveBeenCalled();

    // 13. Restore input change event (non-input target vs input target)
    const restoreInput = root.querySelector(
      ".tools__hidden-restore",
    ) as HTMLInputElement;
    const handleRestoreSpy = jest
      .spyOn(el, "handleRestore")
      .mockImplementation(async () => {});
    const dummyEvent = new Event("change");
    Object.defineProperty(dummyEvent, "target", {
      value: document.createElement("div"),
    });
    restoreInput?.dispatchEvent(dummyEvent);
    expect(handleRestoreSpy).not.toHaveBeenCalled();

    restoreInput?.dispatchEvent(new Event("change"));
    expect(handleRestoreSpy).toHaveBeenCalled();

    // DisconnectedCallback
    el.disconnectedCallback();

    document.body.removeChild(el);
  });

  it("handles early returns when shadowRoot or inner elements are missing", async () => {
    const el = new ShadowClawTools() as any;
    const db = {} as any;

    // 1. Calling methods with no shadowRoot
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    el.bindEventListeners(db);
    el.openCloneDialog("bash");
    el.renderImportCatalog({} as any);
    el.resetImportDialogState();
    el.setupEffects(db);
    el.updateProfileSelector();
    el.updateToolList(db);
    await el.handleFetchSite(db, "https://example.com");

    // 2. Calling openCloneDialog when cloneDialog or cloneForm is missing
    const dummyRoot = document.createElement("div");
    Object.defineProperty(el, "shadowRoot", {
      value: dummyRoot,
      configurable: true,
    });
    el.openCloneDialog("bash");

    // 3. Calling renderImportCatalog when catalog element is missing
    el.renderImportCatalog({ tools: [{ name: "t" }] });

    // 4. Calling updateProfileSelector when select is missing
    el.updateProfileSelector();

    // 5. Calling updateToolList when list is missing
    el.updateToolList(db);

    // 6. Calling bindEventListeners when restoreInput is not an HTMLInputElement
    const mockRoot = document.createElement("div");
    mockRoot.innerHTML = `
      <button class="tools__restore-btn"></button>
      <div class="tools__hidden-restore"></div>
    `;
    Object.defineProperty(el, "shadowRoot", {
      value: mockRoot,
      configurable: true,
    });
    el.bindEventListeners(db);
    const restoreBtn = mockRoot.querySelector(
      ".tools__restore-btn",
    ) as HTMLButtonElement;
    restoreBtn?.click(); // Should not throw when restoreInput is a div
  });

  it("handles handleAddTool validation errors and duplicate detection", async () => {
    const el = new ShadowClawTools() as any;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    const db = {} as any;

    toolsStore.allTools = [{ name: "existing_tool", description: "exists" }];

    // 1. Missing name or description
    const form1 = document.createElement("form");
    form1.innerHTML = `<input name="name" value="" /><input name="description" value="some desc" />`;
    await el.handleAddTool(db, form1);
    expect(showError).toHaveBeenCalledWith("Name and description are required");

    const form2 = document.createElement("form");
    form2.innerHTML = `<input name="name" value="tool_name" /><input name="description" value="" />`;
    await el.handleAddTool(db, form2);
    expect(showError).toHaveBeenCalledWith("Name and description are required");

    // 2. Duplicate tool name
    const form3 = document.createElement("form");
    form3.innerHTML = `<input name="name" value="existing_tool" /><input name="description" value="desc" />`;
    await el.handleAddTool(db, form3);
    expect(showError).toHaveBeenCalledWith(
      'A tool named "existing_tool" already exists',
    );

    // 3. Invalid JSON schema
    const form4 = document.createElement("form");
    form4.innerHTML = `
      <input name="name" value="new_valid_tool" />
      <input name="description" value="valid desc" />
      <input name="input_schema" value="{ invalid json }" />
    `;
    await el.handleAddTool(db, form4);
    expect(showError).toHaveBeenCalledWith("Invalid JSON in input schema");

    document.body.removeChild(el);
  });

  it("handles handleCloneTool validation errors and clone failure", async () => {
    const el = new ShadowClawTools() as any;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    const db = {} as any;

    // Missing source or name
    const form1 = document.createElement("form");
    form1.innerHTML = `<input name="source" value="" /><input name="name" value="new" />`;
    await el.handleCloneTool(db, form1);
    expect(showError).toHaveBeenCalledWith(
      "Source and new tool name are required",
    );

    // Clone failure (returns false)
    toolsStore.cloneTool.mockResolvedValueOnce(false);
    const form2 = document.createElement("form");
    form2.innerHTML = `<input name="source" value="src_tool" /><input name="name" value="cloned_tool" />`;
    await el.handleCloneTool(db, form2);
    expect(showError).toHaveBeenCalledWith(
      'Clone failed: source not found or name "cloned_tool" already exists.',
    );

    // Clone success with new description
    toolsStore.cloneTool.mockResolvedValueOnce(true);
    const form3 = document.createElement("form");
    form3.innerHTML = `
      <input name="source" value="src_tool" />
      <input name="name" value="cloned_tool_2" />
      <input name="description" value="Brand new description" />
    `;
    await el.handleCloneTool(db, form3);
    expect(toolsStore.cloneTool).toHaveBeenCalledWith(
      db,
      "src_tool",
      "cloned_tool_2",
      "Brand new description",
    );

    document.body.removeChild(el);
  });

  it("handles handleRestore edge cases and handleSaveProfile validation", async () => {
    const el = new ShadowClawTools() as any;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    const db = {} as any;

    // 1. handleRestore with no file
    const inputEmpty = { files: [] } as any;
    await el.handleRestore(db, inputEmpty);
    expect(toolsStore.importBackup).not.toHaveBeenCalled();

    // 2. handleRestore with error (Error and string error)
    const brokenFile = {
      text: jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error("Corrupt file")),
    };
    const inputBroken = { files: [brokenFile], value: "corrupt.json" } as any;
    await el.handleRestore(db, inputBroken);
    expect(showError).toHaveBeenCalledWith("Failed to restore: Corrupt file");
    expect(inputBroken.value).toBe("");

    const brokenFileString = {
      text: jest
        .fn<() => Promise<string>>()
        .mockRejectedValue("Corrupt string error"),
    };
    const inputBrokenString = {
      files: [brokenFileString],
      value: "corrupt.json",
    } as any;
    await el.handleRestore(db, inputBrokenString);
    expect(showError).toHaveBeenCalledWith(
      "Failed to restore: Corrupt string error",
    );

    // 3. handleSaveProfile with missing name
    const emptyForm = document.createElement("form");
    emptyForm.innerHTML = `<input name="name" value="" />`;
    await el.handleSaveProfile(db, emptyForm);
    expect(showError).toHaveBeenCalledWith("Profile name is required");

    // handleSaveProfile with empty providerId and empty model
    const minimalForm = document.createElement("form");
    minimalForm.innerHTML = `
      <input name="name" value="Minimal Profile" />
      <input name="providerId" value="" />
      <input name="model" value="" />
    `;
    await el.handleSaveProfile(db, minimalForm);
    expect(toolsStore.addProfile).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        name: "Minimal Profile",
        providerId: undefined,
        model: undefined,
      }),
    );

    document.body.removeChild(el);
  });

  it("handles handleFetchSite and handleImportSubmit error conditions and options", async () => {
    const el = new ShadowClawTools() as any;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    const db = {} as any;

    // 1. handleFetchSite failure with Error and string
    toolsStore.fetchRemoteDiscoveryManifest.mockRejectedValueOnce(
      new Error("Network timeout"),
    );
    await el.handleFetchSite(db, "https://invalid.example.com");
    expect(showError).toHaveBeenCalledWith(
      "Failed to fetch site: Network timeout",
    );

    toolsStore.fetchRemoteDiscoveryManifest.mockRejectedValueOnce(
      "Server crashed",
    );
    await el.handleFetchSite(db, "https://invalid.example.com");
    expect(showError).toHaveBeenCalledWith(
      "Failed to fetch site: Server crashed",
    );

    // 2. handleFetchSite success with manifest without description or name
    toolsStore.fetchRemoteDiscoveryManifest.mockResolvedValueOnce({
      manifest: { name: "", description: "" },
    });
    await el.handleFetchSite(db, "https://minimal.example.com");
    const siteNameEl = el.shadowRoot.querySelector(".tools__import-site-name");
    const siteDescEl = el.shadowRoot.querySelector(".tools__import-site-desc");
    expect(siteNameEl.textContent).toBe("Remote Site");
    expect(siteDescEl.textContent).toBe("No description provided.");

    // 3. handleImportSubmit with no manifest loaded
    el.currentRemoteManifest = null;
    const dummyForm = document.createElement("form");
    await el.handleImportSubmit(db, dummyForm);
    expect(showError).toHaveBeenCalledWith(
      "No remote discovery manifest loaded.",
    );

    // 4. handleImportSubmit with no items selected
    el.currentRemoteManifest = { name: "Test Site" };
    await el.handleImportSubmit(db, dummyForm);
    expect(showError).toHaveBeenCalledWith(
      "Please select at least one tool, skill, or script to import.",
    );

    // 5. handleImportSubmit with items selected and error thrown (Error and string error)
    const formWithItems = document.createElement("form");
    formWithItems.innerHTML = `
      <input type="checkbox" name="importTool" value="tool1" checked />
      <input type="checkbox" class="tools__import-auto-enable" checked />
      <input type="checkbox" class="tools__import-overwrite" checked />
      <button class="tools__import-submit-btn">Import</button>
    `;
    toolsStore.importFromRemoteSite.mockRejectedValueOnce(
      new Error("Import disk write failed"),
    );
    await el.handleImportSubmit(db, formWithItems);
    expect(showError).toHaveBeenCalledWith(
      "Import failed: Import disk write failed",
    );

    toolsStore.importFromRemoteSite.mockRejectedValueOnce(
      "Import string failure",
    );
    await el.handleImportSubmit(db, formWithItems);
    expect(showError).toHaveBeenCalledWith(
      "Import failed: Import string failure",
    );

    // 6. renderImportCatalog with items without descriptions and fallback execution type
    el.renderImportCatalog({
      tools: [{ name: "t_no_desc" }],
      skills: [{ name: "s_no_desc" }],
      scripts: [{ name: "sc_no_desc" }],
    });
    const catalogItems = el.shadowRoot.querySelectorAll(".tools__import-item");
    expect(catalogItems.length).toBe(3);

    // Empty catalog
    el.renderImportCatalog({ tools: [], skills: [], scripts: [] });
    const emptyCatalog = el.shadowRoot.querySelectorAll(".tools__import-item");
    expect(emptyCatalog.length).toBe(0);

    document.body.removeChild(el);
  });

  it("handles updateToolList with matching structure and profile selector display", async () => {
    const el = new ShadowClawTools() as any;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    const db = {} as any;

    // 1. Profiles with different formats: builtin, no provider, no model, provider without registered name
    const { getProvider } = (await import("../../config/config.js")) as any;
    getProvider.mockImplementationOnce((_id: string) => null);
    toolsStore.profiles = [
      { id: "__builtin_full", name: "Full Builtin" },
      { id: "custom_minimal", name: "Minimal Custom" },
      {
        id: "custom_unregistered_prov",
        name: "Unreg Prov",
        providerId: "unknown-prov",
      },
      {
        id: "custom_with_prov",
        name: "Custom Prov",
        providerId: "openai",
        model: "gpt-4o",
      },
    ];
    toolsStore.activeProfileId = "__builtin_full";
    el.updateProfileSelector();

    const deleteBtn = el.shadowRoot.querySelector(
      ".tools__profile-delete-btn",
    ) as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
    expect(deleteBtn.title).toBe("Built-in profiles cannot be deleted");

    toolsStore.activeProfileId = "custom_minimal";
    el.updateProfileSelector();
    expect(deleteBtn.disabled).toBe(false);
    expect(deleteBtn.title).toBe("");

    // 2. updateToolList with custom tools, clone button click, and delete button click
    toolsStore.allTools = [
      { name: "bash", description: "Builtin bash tool. More details." },
      { name: "custom_1", description: "A custom tool. More details." },
    ];
    toolsStore.enabledToolNames = new Set(["bash"]);
    toolsStore.declarativeTools = [
      { name: "decl_1", description: "Declarative tool 1. More details." },
    ];
    toolsStore.isDeclarativeToolEnabled = jest.fn((name) => name === "decl_1");

    el.updateToolList(db);

    const cloneBtns = el.shadowRoot.querySelectorAll(".tools__item-clone");
    const openCloneSpy = jest
      .spyOn(el, "openCloneDialog")
      .mockImplementation(() => {});
    (cloneBtns[0] as HTMLButtonElement)?.click();
    expect(openCloneSpy).toHaveBeenCalledWith("bash");
    openCloneSpy.mockRestore();

    const deleteBtns = el.shadowRoot.querySelectorAll(".tools__item-delete");
    (deleteBtns[0] as HTMLButtonElement)?.click();
    expect(toolsStore.removeCustomTool).toHaveBeenCalledWith(db, "custom_1");
    expect(showInfo).toHaveBeenCalledWith("Removed custom tool: custom_1");

    // Test declarative tool checkbox change
    const declCheckbox = el.shadowRoot.querySelector(
      '.tools__item-checkbox[data-tool="decl_1"]',
    ) as HTMLInputElement;
    declCheckbox.checked = false;
    declCheckbox.dispatchEvent(new Event("change"));
    expect(toolsStore.setDeclarativeToolEnabled).toHaveBeenCalledWith(
      db,
      "decl_1",
      false,
    );

    // 3. updateToolList when isSameStructure is true (updates checkboxes in place)
    // Add a checkbox without data-tool attribute to verify early continue guard
    const list = el.shadowRoot.querySelector(".tools__list") as HTMLElement;
    const dummyCb = document.createElement("input");
    dummyCb.type = "checkbox";
    dummyCb.className = "tools__item-checkbox";
    // no data-tool
    list.appendChild(dummyCb);

    toolsStore.enabledToolNames = new Set(["bash", "custom_1"]);
    el.updateToolList(db);
    const customCheckbox = el.shadowRoot.querySelector(
      '.tools__item-checkbox[data-tool="custom_1"]',
    ) as HTMLInputElement;
    expect(customCheckbox.checked).toBe(true);

    // 4. Focus state on inputs in setupEffects
    const webSearchProxyUrlInput = el.shadowRoot.querySelector(
      ".tools__websearch-proxy-url-input",
    ) as HTMLInputElement;
    const webSearchUrlInput = el.shadowRoot.querySelector(
      ".tools__websearch-url-input",
    ) as HTMLInputElement;
    const searchFilesMaxFileBytesInput = el.shadowRoot.querySelector(
      ".tools__searchfiles-max-file-bytes-input",
    ) as HTMLInputElement;
    const searchFilesMaxFilesVisitedInput = el.shadowRoot.querySelector(
      ".tools__searchfiles-max-files-visited-input",
    ) as HTMLInputElement;
    const searchFilesSkipDirsInput = el.shadowRoot.querySelector(
      ".tools__searchfiles-skip-dirs-input",
    ) as HTMLInputElement;
    const promptArea = el.shadowRoot.querySelector(
      ".tools__prompt-area",
    ) as HTMLTextAreaElement;

    // Simulate focus
    webSearchProxyUrlInput.matches = jest.fn(
      (selector) => selector === ":focus",
    );
    webSearchUrlInput.matches = jest.fn((selector) => selector === ":focus");
    searchFilesMaxFileBytesInput.matches = jest.fn(
      (selector) => selector === ":focus",
    );
    searchFilesMaxFilesVisitedInput.matches = jest.fn(
      (selector) => selector === ":focus",
    );
    searchFilesSkipDirsInput.matches = jest.fn(
      (selector) => selector === ":focus",
    );
    promptArea.matches = jest.fn((selector) => selector === ":focus");

    // Trigger effect re-runs
    toolsStore.webSearchProxyUrl = "/new-proxy";
    toolsStore.webSearchUrl = "https://new.url";
    toolsStore.searchFilesMaxFileBytes = 999;
    toolsStore.searchFilesMaxFilesVisited = 888;
    toolsStore.searchFilesSkipDirs = ".dist";
    toolsStore.systemPromptOverride = "Override when focused";
    el.updateToolList(db);

    document.body.removeChild(el);
  });
});
