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
});
