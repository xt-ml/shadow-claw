import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("../../config/config.js", () => ({
  getAvailableProviders: jest.fn(() => ["anthropic", "openai"]),
  getProvider: jest.fn((id) => ({ name: `Provider ${id}` })),
}));

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn((cb: any) => {
    cb();
    return () => {};
  }),
}));

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
      expect(
        orchestratorStore.orchestrator.setWebMcpToolsEnabled,
      ).toHaveBeenCalledWith(expect.anything(), false);
    }
    document.body.removeChild(el);
  });
});
