import { jest } from "@jest/globals";

// Mock imports used by the component
const mockListGroups = jest.fn();
const mockCreateGroup = jest.fn();
const mockRenameGroup = jest.fn();
const mockDeleteGroupMetadata = jest.fn();
const mockClearGroupMessages = jest.fn();
const mockSetConfig = jest.fn();

jest.unstable_mockModule("../../db/groups.js", () => ({
  listGroups: mockListGroups,
  createGroup: mockCreateGroup,
  renameGroup: mockRenameGroup,
  deleteGroupMetadata: mockDeleteGroupMetadata,
  getGroupMetadata: (jest.fn() as any).mockResolvedValue([]),
  saveGroupMetadata: (jest.fn() as any).mockResolvedValue(undefined),
  reorderGroups: (jest.fn() as any).mockResolvedValue(undefined),
  cloneGroup: (jest.fn() as any).mockResolvedValue(null),
  updateGroupPinnedProvider: (jest.fn() as any).mockResolvedValue(undefined),
  updateGroupSubagentSettings: (jest.fn() as any).mockResolvedValue(undefined),
  updateGroupProviderRuntimeOverrides: (jest.fn() as any).mockResolvedValue(
    undefined,
  ),
  updateGroupToolTags: (jest.fn() as any).mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../db/clearGroupMessages.js", () => ({
  clearGroupMessages: mockClearGroupMessages,
}));

jest.unstable_mockModule("../../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

// Mock the orchestratorStore
const mockOrchStore: any = {
  groups: [{ groupId: "br:main", name: "Main", createdAt: 0 }],
  activeGroupId: "br:main",
  unreadGroupIds: new Set(),
  activePage: "chat",
  sidebarDefaultPage: "chat",
  _groups: { get: () => mockOrchStore.groups },
  _activeGroupId: { get: () => mockOrchStore.activeGroupId },
  _unreadGroupIds: { get: () => mockOrchStore.unreadGroupIds },
  loadGroups: jest.fn(),
  createConversation: jest.fn(),
  renameConversation: jest.fn(),
  deleteConversation: jest.fn(),
  switchConversation: jest.fn(),
  reorderConversations: jest.fn(),
  cloneConversation: jest.fn(),
  updateConversationPinnedProvider: jest.fn(),
  updateConversationProviderRuntimeOverrides: jest.fn(),
  updateConversationSubagentSettings: jest.fn(),
  updateConversationToolTags: jest.fn(),
  orchestrator: {
    channelRegistry: {
      getBadge: (groupId: string) =>
        groupId.startsWith("tg:") ? "Telegram" : "Browser",
    },
    getAvailableProviders: jest.fn(() => []),
  },
};

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: mockOrchStore,
}));

// Mock effect
jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn((fn: any) => {
    fn();

    return () => {};
  }),
}));

const { ShadowClawConversations } =
  await import("./shadow-claw-conversations.js");
const { toolsStore } = await import("../../stores/tools.js");

describe("ShadowClawConversations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrchStore.groups = [{ groupId: "br:main", name: "Main", createdAt: 0 }];
    mockOrchStore.activeGroupId = "br:main";
    mockOrchStore.unreadGroupIds = new Set();
    mockOrchStore.activePage = "chat";
    mockOrchStore.sidebarDefaultPage = "chat";
  });

  it("is a defined custom element", () => {
    expect(ShadowClawConversations).toBeDefined();
    expect(customElements.get("shadow-claw-conversations")).toBe(
      ShadowClawConversations,
    );
  });

  it("renders conversation list items", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const items = el.shadowRoot?.querySelectorAll(".conversation-item");
    expect(items?.length).toBeGreaterThanOrEqual(1);

    document.body.removeChild(el);
  });

  it("renders channel badges for conversations", async () => {
    mockOrchStore.groups = [
      { groupId: "tg:8352127045", name: "Telegram 8352127045", createdAt: 1 },
    ];
    mockOrchStore.activeGroupId = "tg:8352127045";

    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const badge = el.shadowRoot?.querySelector(".channel-badge");
    expect(badge?.textContent).toBe("Telegram");

    document.body.removeChild(el);
  });

  it("picks up channel registry when orchestrator becomes available after mount", async () => {
    const originalOrchestrator = mockOrchStore.orchestrator;
    mockOrchStore.orchestrator = null;
    mockOrchStore.groups = [
      { groupId: "tg:8352127045", name: "Telegram 8352127045", createdAt: 1 },
    ];
    mockOrchStore.activeGroupId = "tg:8352127045";

    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);

    mockOrchStore.orchestrator = originalOrchestrator;
    await el.render();

    const badge = el.shadowRoot?.querySelector(".channel-badge");
    expect(badge?.textContent).toBe("Telegram");

    document.body.removeChild(el);
  });

  it("marks the active group with an active class", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const active = el.shadowRoot?.querySelector(".conversation-item.active");
    expect(active).not.toBeNull();
    expect(active?.getAttribute("data-group-id")).toBe("br:main");

    document.body.removeChild(el);
  });

  it("has a create button", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const btn = el.shadowRoot?.querySelector("[data-action='create']");
    expect(btn).not.toBeNull();

    document.body.removeChild(el);
  });

  it("hides delete button when only one conversation exists", async () => {
    mockOrchStore.groups = [{ groupId: "br:main", name: "Main", createdAt: 0 }];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const deleteBtn = el.shadowRoot?.querySelector("[data-action='delete']");
    expect(deleteBtn).toBeNull();

    document.body.removeChild(el);
  });

  it("shows delete button when multiple conversations exist", async () => {
    mockOrchStore.groups = [
      { groupId: "br:main", name: "Main", createdAt: 0 },
      { groupId: "br:second", name: "Second", createdAt: 1 },
    ];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const deleteBtns = el.shadowRoot?.querySelectorAll(
      "[data-action='delete']",
    );
    expect(deleteBtns?.length).toBe(2);

    document.body.removeChild(el);
  });

  it("shows a clone button on each conversation item", async () => {
    mockOrchStore.groups = [
      { groupId: "br:main", name: "Main", createdAt: 0 },
      { groupId: "br:second", name: "Second", createdAt: 1 },
    ];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const cloneBtns = el.shadowRoot?.querySelectorAll("[data-action='clone']");
    expect(cloneBtns?.length).toBe(2);

    document.body.removeChild(el);
  });

  it("opens clone dialog and clones only after confirmation", async () => {
    mockOrchStore.groups = [
      { groupId: "br:main", name: "Main", createdAt: 0 },
      { groupId: "br:second", name: "Second", createdAt: 1 },
    ];

    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;

    const cloneDialog = el.shadowRoot?.querySelector(
      ".conversations__clone-dialog",
    ) as HTMLDialogElement | null;
    if (cloneDialog) {
      (cloneDialog as any).showModal = jest.fn();
      (cloneDialog as any).close = jest.fn();
    }

    await el.handleClone("br:main");

    expect(mockOrchStore.cloneConversation).not.toHaveBeenCalled();

    const cloneName = el.shadowRoot?.querySelector(
      ".conversations__clone-name",
    );
    expect(cloneName?.textContent).toBe("Main");

    await el._submitCloneDialog();

    expect(mockOrchStore.cloneConversation).toHaveBeenCalledWith(
      expect.anything(),
      "br:main",
    );

    document.body.removeChild(el);
  });

  it("focuses delete dialog cancel button when opened", async () => {
    mockOrchStore.groups = [
      { groupId: "br:main", name: "Main", createdAt: 0 },
      { groupId: "br:second", name: "Second", createdAt: 1 },
    ];

    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const deleteDialog = el.shadowRoot?.querySelector(
      ".conversations__delete-dialog",
    ) as HTMLDialogElement | null;
    if (deleteDialog) {
      (deleteDialog as any).showModal = jest.fn();
    }

    el.openDeleteDialog("Second");

    const cancelButton = el.shadowRoot?.querySelector(
      ".conversations__delete-dialog .conversations__cancel",
    ) as HTMLButtonElement | null;
    expect(cancelButton).not.toBeNull();
    expect(el.shadowRoot?.activeElement).toBe(cancelButton);

    document.body.removeChild(el);
  });

  it("styles delete action with distinct hover/focus colors", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const style = el.shadowRoot?.querySelector("style");
    expect(style?.textContent).toContain("--shadow-claw-important-color-hover");
    expect(style?.textContent).toContain(
      ".conversations__delete-ok:focus-visible",
    );

    document.body.removeChild(el);
  });

  it("renders a drag handle on each conversation item", async () => {
    mockOrchStore.groups = [
      { groupId: "br:main", name: "Main", createdAt: 0 },
      { groupId: "br:second", name: "Second", createdAt: 1 },
    ];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const handles = el.shadowRoot?.querySelectorAll(".drag-handle");
    expect(handles?.length).toBe(2);

    document.body.removeChild(el);
  });

  it("drag handle has grab cursor style", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const style = el.shadowRoot?.querySelector("style");
    expect(style?.textContent).toContain("cursor: grab");

    document.body.removeChild(el);
  });

  it("drag handle has grabbing cursor on :active", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const style = el.shadowRoot?.querySelector("style");
    expect(style?.textContent).toContain("cursor: grabbing");

    document.body.removeChild(el);
  });

  it("conversation items have role=listitem and tabindex for keyboard access", async () => {
    mockOrchStore.groups = [{ groupId: "br:main", name: "Main", createdAt: 0 }];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const item = el.shadowRoot?.querySelector(".conversation-item");
    expect(item?.getAttribute("role")).toBe("listitem");
    expect(item?.getAttribute("tabindex")).toBe("0");
    expect(item?.getAttribute("aria-describedby")).toBe("reorder-instructions");

    document.body.removeChild(el);
  });

  it("has an ARIA live region for reorder announcements", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const liveRegion = el.shadowRoot?.querySelector("#live-region");
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute("aria-live")).toBe("assertive");
    expect(liveRegion?.getAttribute("role")).toBe("status");

    document.body.removeChild(el);
  });

  it("has hidden reorder instructions for screen readers", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const instructions = el.shadowRoot?.querySelector("#reorder-instructions");
    expect(instructions).not.toBeNull();
    expect(instructions?.textContent?.replace(/\s+/g, " ")).toContain(
      "Press M to grab",
    );
    expect(instructions?.classList.contains("sr-only")).toBe(true);

    document.body.removeChild(el);
  });

  it("conversation list has role=list", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const list = el.shadowRoot?.querySelector(".conversation-list");
    expect(list?.getAttribute("role")).toBe("list");

    document.body.removeChild(el);
  });

  it("drag handle has touch-action: none for touch support", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const style = el.shadowRoot?.querySelector("style");
    expect(style?.textContent).toContain("touch-action: none");

    document.body.removeChild(el);
  });

  it("action buttons have accessible aria-labels", async () => {
    mockOrchStore.groups = [
      { groupId: "br:main", name: "Main", createdAt: 0 },
      { groupId: "br:second", name: "Second", createdAt: 1 },
    ];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const cloneBtn = el.shadowRoot?.querySelector("[data-action='clone']");
    expect(cloneBtn?.getAttribute("aria-label")).toBe("Clone Main");

    const detailsBtn = el.shadowRoot?.querySelector("[data-action='details']");
    expect(detailsBtn?.getAttribute("aria-label")).toBe("Details for Main");

    const deleteBtn = el.shadowRoot?.querySelector("[data-action='delete']");
    expect(deleteBtn?.getAttribute("aria-label")).toBe("Delete Main");

    document.body.removeChild(el);
  });

  describe("resizable conversation list", () => {
    it("has a resize handle", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const handle = el.shadowRoot?.querySelector(".resize-handle");
      expect(handle).not.toBeNull();

      document.body.removeChild(el);
    });

    it("resize handle has row-resize cursor style", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain("cursor: row-resize");

      document.body.removeChild(el);
    });

    it("resize handle renders a visible grab affordance", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain(".resize-handle::before");
      expect(style?.textContent).toContain(".resize-handle::after");

      document.body.removeChild(el);
    });

    it("conversation list has scrollable styling", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain("overflow-y: auto");

      document.body.removeChild(el);
    });

    it("host uses flex-direction column", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain("flex-direction: column");

      document.body.removeChild(el);
    });

    it("conversation list has flex: 1 to fill available space", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toMatch(
        /\.conversation-list\s*\{[^}]*flex:\s*1/s,
      );

      document.body.removeChild(el);
    });
  });

  describe("unread message pulse", () => {
    it("applies unread class to conversation items with unread messages", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0 },
        { groupId: "br:other", name: "Other", createdAt: 1 },
      ];
      mockOrchStore.unreadGroupIds = new Set(["br:other"]);

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const items = el.shadowRoot?.querySelectorAll(".conversation-item");
      const otherItem = Array.from(items || []).find(
        (item: any) => item.getAttribute("data-group-id") === "br:other",
      ) as any;

      expect(otherItem?.classList.contains("unread")).toBe(true);

      document.body.removeChild(el);
    });

    it("does not apply unread class to the active conversation", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0 },
      ];
      mockOrchStore.activeGroupId = "br:main";
      mockOrchStore.unreadGroupIds = new Set(["br:main"]);

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const item = el.shadowRoot?.querySelector("[data-group-id='br:main']");
      expect(item?.classList.contains("unread")).toBe(false);

      document.body.removeChild(el);
    });

    it("has pulse animation keyframes in styles", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain("@keyframes pulse-unread");

      document.body.removeChild(el);
    });

    it("unread class applies pulse animation", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain(".conversation-item.unread");
      expect(style?.textContent).toContain("pulse-unread");

      document.body.removeChild(el);
    });
  });

  describe("details dialog: datalist filtering", () => {
    it("excludes already-pinned tools from the datalist options", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          toolTags: ["bash", "fetch_url"],
        },
      ];
      mockOrchStore.activeGroupId = "br:main";

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      // Stub showModal since jsdom doesn't support it
      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
      }

      // Open the details dialog for Main which has bash and fetch_url pinned
      await el.handleDetails("br:main", "Main");

      const datalist = el.shadowRoot?.querySelector(
        "#conversations-available-tools",
      ) as HTMLDataListElement;
      const options = Array.from(datalist.querySelectorAll("option")).map(
        (o: any) => o.value,
      );

      // bash and fetch_url should NOT be in the datalist since they are pinned
      expect(options).not.toContain("bash");
      expect(options).not.toContain("fetch_url");
      // Other tools should still be available
      expect(options.length).toBeGreaterThan(0);

      document.body.removeChild(el);
    });

    it("updates datalist when a tool chip is removed", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          toolTags: ["bash", "fetch_url"],
        },
      ];
      mockOrchStore.activeGroupId = "br:main";

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const datalist = el.shadowRoot?.querySelector(
        "#conversations-available-tools",
      ) as HTMLDataListElement;

      // Initially bash should NOT be in datalist
      let options = Array.from(datalist.querySelectorAll("option")).map(
        (o: any) => o.value,
      );
      expect(options).not.toContain("bash");

      // Remove the bash chip by clicking its remove button
      const chips = el.shadowRoot?.querySelectorAll(
        ".conversations__tool-chip",
      );
      const bashChip = Array.from(chips || []).find(
        (c: any) => c.querySelector("span")?.textContent === "bash",
      ) as HTMLElement | undefined;

      const removeBtn = bashChip?.querySelector(
        ".conversations__tool-chip-remove",
      ) as HTMLButtonElement;
      removeBtn?.click();

      // After removing, bash should now appear in the datalist
      options = Array.from(datalist.querySelectorAll("option")).map(
        (o: any) => o.value,
      );
      expect(options).toContain("bash");

      document.body.removeChild(el);
    });

    it("updates datalist when a new tool is added", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0, toolTags: [] },
      ];
      mockOrchStore.activeGroupId = "br:main";

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const datalist = el.shadowRoot?.querySelector(
        "#conversations-available-tools",
      ) as HTMLDataListElement;
      const toolInput = el.shadowRoot?.querySelector(
        "#conversations-tool-input",
      ) as HTMLInputElement;
      const addBtn = el.shadowRoot?.querySelector(
        "#conversations-add-tool-btn",
      ) as HTMLButtonElement;

      // Initially bash should be in datalist (no pinned tools)
      let options = Array.from(datalist.querySelectorAll("option")).map(
        (o: any) => o.value,
      );
      expect(options).toContain("bash");

      // Add bash via the input
      toolInput.value = "bash";
      addBtn.click();

      // Now bash should be excluded from the datalist
      options = Array.from(datalist.querySelectorAll("option")).map(
        (o: any) => o.value,
      );
      expect(options).not.toContain("bash");

      document.body.removeChild(el);
    });

    it("allows adding a declaratively registered tool to pinned tools", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0, toolTags: [] },
      ];
      mockOrchStore.activeGroupId = "br:main";

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const toolInput = el.shadowRoot?.querySelector(
        "#conversations-tool-input",
      ) as HTMLInputElement;
      const addBtn = el.shadowRoot?.querySelector(
        "#conversations-add-tool-btn",
      ) as HTMLButtonElement;

      // Add declarative tool 'generate_random_number' via input
      toolInput.value = "generate_random_number";
      addBtn.click();

      // Check if a chip with 'generate_random_number' was created
      const chips = el.shadowRoot?.querySelectorAll(
        ".conversations__tool-chip",
      );
      const declarativeChip = Array.from(chips || []).find(
        (c: any) =>
          c.querySelector("span")?.textContent === "generate_random_number",
      );
      expect(declarativeChip).toBeDefined();

      document.body.removeChild(el);
    });
  });

  describe("details dialog: provider/model pinning", () => {
    it("hides subagent settings when pinned tools exclude spawn_subagent", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          toolTags: ["git_clone"],
        },
      ];
      mockOrchStore.activeGroupId = "br:main";

      const enabled = toolsStore.enabledToolNames;
      enabled.add("spawn_subagent");

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const subagentSettingsContainer = el.shadowRoot?.querySelector(
        "#conversations-subagent-settings-container",
      ) as HTMLElement | null;

      expect(subagentSettingsContainer?.style.display).toBe("none");

      document.body.removeChild(el);
    });

    it("shows subagent settings when no pinned tools are set and spawn_subagent is globally enabled", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          toolTags: [],
        },
      ];
      mockOrchStore.activeGroupId = "br:main";

      const enabled = toolsStore.enabledToolNames;
      enabled.add("spawn_subagent");

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const subagentSettingsContainer = el.shadowRoot?.querySelector(
        "#conversations-subagent-settings-container",
      ) as HTMLElement | null;

      expect(subagentSettingsContainer?.style.display).toBe("flex");

      document.body.removeChild(el);
    });

    it("shows subagent settings when spawn_subagent is pinned even if it is globally disabled", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          toolTags: ["spawn_subagent"],
        },
      ];
      mockOrchStore.activeGroupId = "br:main";

      const enabled = toolsStore.enabledToolNames;
      enabled.delete("spawn_subagent");

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const subagentSettingsContainer = el.shadowRoot?.querySelector(
        "#conversations-subagent-settings-container",
      ) as HTMLElement | null;

      expect(subagentSettingsContainer?.style.display).toBe("flex");

      document.body.removeChild(el);
    });

    it("allows custom model id even when provider has no static model list", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          pinnedProvider: "provider-no-models",
          pinnedModel: "custom-model-id",
          subagentModelSelectionMode: "automatic",
        },
      ];
      mockOrchStore.activeGroupId = "br:main";
      mockOrchStore.orchestrator.getAvailableProviders.mockReturnValue([
        {
          id: "provider-no-models",
          name: "Provider Without Models",
        },
      ]);

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
        (dialog as any).close = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const mainPicker = el.shadowRoot?.querySelector(
        "#conversations-main-picker",
      ) as HTMLElement | null;
      const modelSelect = mainPicker?.shadowRoot?.querySelector(
        '[data-role="model-select"]',
      ) as HTMLSelectElement | null;
      const customInput = mainPicker?.shadowRoot?.querySelector(
        '[data-role="custom-model-input"]',
      ) as HTMLInputElement | null;

      expect(modelSelect?.value).toBe("__custom__");
      expect(customInput?.value).toBe("custom-model-id");

      await el._submitDetailsDialog();

      expect(
        mockOrchStore.updateConversationPinnedProvider,
      ).toHaveBeenCalledWith(
        expect.anything(),
        "br:main",
        "provider-no-models",
        "custom-model-id",
        undefined,
      );

      document.body.removeChild(el);
    });

    it("saves agent max tokens override from details dialog", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          pinnedProvider: "openai",
          pinnedModel: "gpt-4o",
          pinnedMaxTokens: 4096,
        },
      ];
      mockOrchStore.activeGroupId = "br:main";
      mockOrchStore.orchestrator.getAvailableProviders.mockReturnValue([
        { id: "openai", name: "OpenAI", models: ["gpt-4o"] },
      ]);

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
        (dialog as any).close = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const maxTokensInput = el.shadowRoot?.querySelector(
        "#conversations-agent-max-tokens",
      ) as HTMLInputElement | null;

      expect(maxTokensInput?.value).toBe("4096");

      if (!maxTokensInput) {
        throw new Error("agent max tokens input missing");
      }

      maxTokensInput.value = "32000";
      maxTokensInput.dispatchEvent(new Event("input"));

      await el._submitDetailsDialog();

      expect(
        mockOrchStore.updateConversationPinnedProvider,
      ).toHaveBeenCalledWith(
        expect.anything(),
        "br:main",
        "openai",
        "gpt-4o",
        32000,
      );

      document.body.removeChild(el);
    });

    it("saves subagent manual mode provider/model settings", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          toolTags: ["spawn_subagent"],
          subagentModelSelectionMode: "manual",
          subagentPinnedProvider: "openai",
          subagentPinnedModel: "gpt-4o",
        },
      ];
      mockOrchStore.activeGroupId = "br:main";
      mockOrchStore.orchestrator.getAvailableProviders.mockReturnValue([
        { id: "openai", name: "OpenAI", models: ["gpt-4o"] },
      ]);

      const enabled = toolsStore.enabledToolNames;
      enabled.add("spawn_subagent");

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
        (dialog as any).close = jest.fn();
      }

      await el.handleDetails("br:main", "Main");
      await el._submitDetailsDialog();

      expect(
        mockOrchStore.updateConversationSubagentSettings,
      ).toHaveBeenCalledWith(
        expect.anything(),
        "br:main",
        "manual",
        "openai",
        "gpt-4o",
        undefined,
      );

      expect(
        mockOrchStore.updateConversationProviderRuntimeOverrides,
      ).toHaveBeenCalledWith(expect.anything(), "br:main", expect.any(Object));

      document.body.removeChild(el);
    });

    it("saves subagent max tokens override from details dialog", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          toolTags: ["spawn_subagent"],
          subagentModelSelectionMode: "automatic",
          subagentMaxTokens: 4096,
        },
      ];
      mockOrchStore.activeGroupId = "br:main";
      mockOrchStore.orchestrator.getAvailableProviders.mockReturnValue([
        { id: "openai", name: "OpenAI", models: ["gpt-4o"] },
      ]);

      const enabled = toolsStore.enabledToolNames;
      enabled.add("spawn_subagent");

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
        (dialog as any).close = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const maxTokensInput = el.shadowRoot?.querySelector(
        "#conversations-subagent-max-tokens",
      ) as HTMLInputElement | null;

      expect(maxTokensInput?.value).toBe("4096");

      if (!maxTokensInput) {
        throw new Error("subagent max tokens input missing");
      }

      maxTokensInput.value = "32000";
      maxTokensInput.dispatchEvent(new Event("input"));

      await el._submitDetailsDialog();

      expect(
        mockOrchStore.updateConversationSubagentSettings,
      ).toHaveBeenCalledWith(
        expect.anything(),
        "br:main",
        "automatic",
        undefined,
        undefined,
        32000,
      );

      document.body.removeChild(el);
    });

    it("captures bedrock module overrides from shared settings component", async () => {
      mockOrchStore.groups = [
        {
          groupId: "br:main",
          name: "Main",
          createdAt: 0,
          pinnedProvider: "bedrock_proxy",
          pinnedModel: "anthropic.claude-3-5-sonnet",
        },
      ];
      mockOrchStore.activeGroupId = "br:main";
      mockOrchStore.orchestrator.getAvailableProviders.mockReturnValue([
        {
          id: "bedrock_proxy",
          name: "AWS Bedrock",
        },
      ]);

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      ) as HTMLDialogElement | null;
      if (dialog) {
        (dialog as any).showModal = jest.fn();
        (dialog as any).close = jest.fn();
      }

      await el.handleDetails("br:main", "Main");

      const moduleSettings = el.shadowRoot?.querySelector(
        "#conversations-main-provider-module-settings",
      ) as HTMLElement | null;
      const authModeSelect = moduleSettings?.shadowRoot?.querySelector(
        '[data-role="bedrock-auth-mode"]',
      ) as HTMLSelectElement | null;

      if (!authModeSelect) {
        throw new Error("bedrock auth mode select missing");
      }

      authModeSelect.value = "sso";
      authModeSelect.dispatchEvent(new Event("change"));

      await el._submitDetailsDialog();

      expect(
        mockOrchStore.updateConversationProviderRuntimeOverrides,
      ).toHaveBeenCalledWith(
        expect.anything(),
        "br:main",
        expect.objectContaining({
          bedrock_proxy: expect.objectContaining({ authMode: "sso" }),
        }),
      );

      document.body.removeChild(el);
    });
  });

  describe("keyboard selection and navigation", () => {
    it("selects a conversation when Space or Enter is pressed on the item", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0 },
        { groupId: "br:second", name: "Second", createdAt: 1 },
      ];
      mockOrchStore.activeGroupId = "br:main";

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const items = el.shadowRoot?.querySelectorAll(".conversation-item");
      const secondItem = items[1] as HTMLElement;

      const navigateEvents: CustomEvent[] = [];
      const captureNavigate = (e: Event) =>
        navigateEvents.push(e as CustomEvent);
      document.addEventListener("shadow-claw-navigate", captureNavigate);

      // Press Enter
      secondItem.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(navigateEvents).toHaveLength(1);
      expect(navigateEvents[0].detail).toMatchObject({
        page: "chat",
        groupId: "br:second",
      });

      navigateEvents.length = 0;

      // Press Space
      secondItem.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
      expect(navigateEvents).toHaveLength(1);
      expect(navigateEvents[0].detail).toMatchObject({
        page: "chat",
        groupId: "br:second",
      });

      document.removeEventListener("shadow-claw-navigate", captureNavigate);

      document.body.removeChild(el);
    });

    it("never navigates to the pages tab when switching conversations, since its route can't carry a bare groupId", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0 },
        { groupId: "br:second", name: "Second", createdAt: 1 },
      ];
      mockOrchStore.activeGroupId = "br:main";
      mockOrchStore.activePage = "pages";
      mockOrchStore.sidebarDefaultPage = "pages";

      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();
      el.db = {} as any;

      const navigateEvents: CustomEvent[] = [];
      const captureNavigate = (e: Event) =>
        navigateEvents.push(e as CustomEvent);
      document.addEventListener("shadow-claw-navigate", captureNavigate);

      await el.handleSwitch("br:second");

      expect(navigateEvents).toHaveLength(1);
      expect(navigateEvents[0].detail).toMatchObject({
        page: "chat",
        groupId: "br:second",
      });

      document.removeEventListener("shadow-claw-navigate", captureNavigate);

      document.body.removeChild(el);
    });

    it("moves focus between conversation items with ArrowDown and ArrowUp", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0 },
        { groupId: "br:second", name: "Second", createdAt: 1 },
      ];
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const items = el.shadowRoot?.querySelectorAll(".conversation-item");
      const firstItem = items[0] as HTMLElement;
      const secondItem = items[1] as HTMLElement;

      // Focus first item
      firstItem.focus();
      expect(el.shadowRoot.activeElement).toBe(firstItem);

      // ArrowDown should focus the second item (skipping buttons in first item)
      firstItem.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
      expect(el.shadowRoot.activeElement).toBe(secondItem);

      // ArrowUp should focus the first item
      secondItem.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
      );
      expect(el.shadowRoot.activeElement).toBe(firstItem);

      document.body.removeChild(el);
    });

    it("moves focus like Tab with ArrowRight and ArrowLeft", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0 },
      ];
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const item = el.shadowRoot?.querySelector(
        ".conversation-item",
      ) as HTMLElement;
      const cloneBtn = item.querySelector(
        '[data-action="clone"]',
      ) as HTMLElement;

      // Focus item
      item.focus();

      // ArrowRight should focus clone button
      item.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(el.shadowRoot.activeElement).toBe(cloneBtn);

      // ArrowLeft should focus the item back
      cloneBtn.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
      expect(el.shadowRoot.activeElement).toBe(item);

      document.body.removeChild(el);
    });

    it("grabs a conversation for reordering when 'm' is pressed", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0 },
      ];
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const item = el.shadowRoot?.querySelector(
        ".conversation-item",
      ) as HTMLElement;
      item.dispatchEvent(
        new KeyboardEvent("keydown", { key: "m", bubbles: true }),
      );

      expect(el._keyboardGrabbedId).toBe("br:main");

      const updatedItem = el.shadowRoot?.querySelector(
        ".conversation-item",
      ) as HTMLElement;
      expect(updatedItem.classList.contains("keyboard-grabbed")).toBe(true);

      document.body.removeChild(el);
    });

    it("shows action buttons when conversation item has focus-within", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0 },
      ];
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toMatch(
        /\.conversation-item:focus-within\s+\.conversation-actions/,
      );

      document.body.removeChild(el);
    });
  });

  describe("dialog functionality (non-blocking)", () => {
    it("has a create dialog element", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__create-dialog",
      );
      expect(dialog).toBeTruthy();
      expect(dialog?.tagName).toBe("DIALOG");

      document.body.removeChild(el);
    });

    it("has a details dialog element", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__details-dialog",
      );
      expect(dialog).toBeTruthy();
      expect(dialog?.tagName).toBe("DIALOG");

      document.body.removeChild(el);
    });

    it("has a delete dialog element", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__delete-dialog",
      );
      expect(dialog).toBeTruthy();
      expect(dialog?.tagName).toBe("DIALOG");

      document.body.removeChild(el);
    });

    it("has a clone dialog element", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.render();

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__clone-dialog",
      );
      expect(dialog).toBeTruthy();
      expect(dialog?.tagName).toBe("DIALOG");

      document.body.removeChild(el);
    });
  });
});

describe("shadow-claw-conversations dialog submission methods", () => {
  it("submits create dialog", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;

    const dialog = el.shadowRoot?.querySelector(
      ".conversations__create-dialog",
    ) as HTMLDialogElement;
    if (dialog) {
      (dialog as any).showModal = jest.fn();
      (dialog as any).close = jest.fn();
    }

    const input = el.shadowRoot?.querySelector(
      ".conversations__create-dialog .conversations__input",
    ) as HTMLInputElement;
    if (input) input.value = "New Group";

    await el._submitCreateDialog();
    expect(mockOrchStore.createConversation).toHaveBeenCalledWith(
      expect.anything(),
      "New Group",
    );
    document.body.removeChild(el);
  });

  it("submits delete dialog", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;
    el._pendingDeleteGroupId = "br:main";

    const dialog = el.shadowRoot?.querySelector(
      ".conversations__delete-dialog",
    ) as HTMLDialogElement;
    if (dialog) (dialog as any).close = jest.fn();

    await el._submitDeleteDialog();
    expect(mockOrchStore.deleteConversation).toHaveBeenCalledWith(
      expect.anything(),
      "br:main",
    );
    expect(el._pendingDeleteGroupId).toBeNull();
    document.body.removeChild(el);
  });

  it("handles reordering conversations with draggedId/targetId and precomputed IDs", async () => {
    mockOrchStore.groups = [
      { groupId: "br:1", name: "One", createdAt: 0 },
      { groupId: "br:2", name: "Two", createdAt: 1 },
      { groupId: "br:3", name: "Three", createdAt: 2 },
    ];

    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;

    // 1. Precomputed IDs
    await el.handleReorder("br:1", "br:3", ["br:2", "br:3", "br:1"]);
    expect(mockOrchStore.reorderConversations).toHaveBeenCalledWith(el.db, [
      "br:2",
      "br:3",
      "br:1",
    ]);

    // 2. Dragged & Target IDs
    await el.handleReorder("br:1", "br:3");
    expect(mockOrchStore.reorderConversations).toHaveBeenCalledWith(el.db, [
      "br:2",
      "br:3",
      "br:1",
    ]);

    // 3. Nonexistent ID (no-op)
    jest.clearAllMocks();
    await el.handleReorder("br:invalid", "br:3");
    expect(mockOrchStore.reorderConversations).not.toHaveBeenCalled();

    // 4. Missing DB (no-op)
    el.db = null;
    await el.handleReorder("br:1", "br:2");
    expect(mockOrchStore.reorderConversations).not.toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("handles switching conversations and dispatches shadow-claw-navigate", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    const navigateListener = jest.fn();
    document.addEventListener("shadow-claw-navigate", navigateListener);

    // 1. Switching to active group is a no-op
    mockOrchStore.activeGroupId = "br:main";
    await el.handleSwitch("br:main");
    expect(navigateListener).not.toHaveBeenCalled();

    // 2. Switching to another group
    await el.handleSwitch("br:other");
    expect(navigateListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          page: "chat",
          groupId: "br:other",
        },
      }),
    );

    document.removeEventListener("shadow-claw-navigate", navigateListener);
    document.body.removeChild(el);
  });

  it("cancels dialogs and resets pending state on cancel button clicks", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();

    el._setupDialogListeners();

    // 1. Create cancel
    const createDialog = el.shadowRoot?.querySelector(
      ".conversations__create-dialog",
    ) as any;
    if (createDialog) createDialog.close = jest.fn();
    const createCancel = el.shadowRoot?.querySelector(
      ".conversations__create-dialog .conversations__cancel",
    ) as HTMLButtonElement;
    createCancel?.click();
    expect(createDialog?.close).toHaveBeenCalled();

    // 2. Delete cancel
    el._pendingDeleteGroupId = "br:to-delete";
    const deleteDialog = el.shadowRoot?.querySelector(
      ".conversations__delete-dialog",
    ) as any;
    if (deleteDialog) deleteDialog.close = jest.fn();
    const deleteCancel = el.shadowRoot?.querySelector(
      ".conversations__delete-dialog .conversations__cancel",
    ) as HTMLButtonElement;
    deleteCancel?.click();
    expect(deleteDialog?.close).toHaveBeenCalled();
    expect(el._pendingDeleteGroupId).toBeNull();

    // 3. Clone cancel
    el._pendingCloneGroupId = "br:to-clone";
    const cloneDialog = el.shadowRoot?.querySelector(
      ".conversations__clone-dialog",
    ) as any;
    if (cloneDialog) cloneDialog.close = jest.fn();
    const cloneCancel = el.shadowRoot?.querySelector(
      ".conversations__clone-dialog .conversations__cancel",
    ) as HTMLButtonElement;
    cloneCancel?.click();
    expect(cloneDialog?.close).toHaveBeenCalled();
    expect(el._pendingCloneGroupId).toBeNull();

    // 4. Details cancel
    el._pendingRenameGroupId = "br:to-rename";
    const detailsDialog = el.shadowRoot?.querySelector(
      ".conversations__details-dialog",
    ) as any;
    if (detailsDialog) detailsDialog.close = jest.fn();
    const detailsCancel = el.shadowRoot?.querySelector(
      ".conversations__details-dialog .conversations__cancel",
    ) as HTMLButtonElement;
    detailsCancel?.click();
    expect(detailsDialog?.close).toHaveBeenCalled();
    expect(el._pendingRenameGroupId).toBeNull();

    document.body.removeChild(el);
  });

  it("submits details dialog with rename and settings updates", async () => {
    mockOrchStore.groups = [
      { groupId: "br:main", name: "Old Name", createdAt: 0, toolTags: [] },
    ];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;

    el._pendingRenameGroupId = "br:main";
    el._pendingRenameName = "Old Name";
    el._pendingDetailsToolTags = ["bash", "read_file"];
    el._pendingDetailsPinnedProvider = "anthropic";
    el._pendingDetailsPinnedModel = "claude-3-5-sonnet";
    el._pendingDetailsPinnedMaxTokens = 4096;
    el._pendingDetailsSubagentMode = "manual";
    el._pendingDetailsSubagentProvider = "openai";
    el._pendingDetailsSubagentModel = "gpt-4o";
    el._pendingDetailsSubagentMaxTokens = 2048;

    const dialog = el.shadowRoot?.querySelector(
      ".conversations__details-dialog",
    ) as HTMLDialogElement;
    if (dialog) (dialog as any).close = jest.fn();

    const nameInput = el.shadowRoot?.querySelector(
      ".conversations__details-dialog .conversations__input",
    ) as HTMLInputElement;
    if (nameInput) nameInput.value = "New Name";

    await el._submitDetailsDialog();

    expect(mockOrchStore.renameConversation).toHaveBeenCalledWith(
      el.db,
      "br:main",
      "New Name",
    );
    expect(mockOrchStore.updateConversationToolTags).toHaveBeenCalledWith(
      el.db,
      "br:main",
      ["bash", "read_file"],
    );
    expect(mockOrchStore.updateConversationPinnedProvider).toHaveBeenCalledWith(
      el.db,
      "br:main",
      "anthropic",
      "claude-3-5-sonnet",
      4096,
    );
    expect(
      mockOrchStore.updateConversationSubagentSettings,
    ).toHaveBeenCalledWith(
      el.db,
      "br:main",
      "manual",
      "openai",
      "gpt-4o",
      2048,
    );

    document.body.removeChild(el);
  });

  it("handles item action button clicks (clone, details, delete, toggle actions)", async () => {
    mockOrchStore.groups = [
      { groupId: "br:g1", name: "Group 1", createdAt: 0 },
      { groupId: "br:g2", name: "Group 2", createdAt: 1 },
    ];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;

    const items = el.shadowRoot?.querySelectorAll(
      ".conversation-item",
    ) as NodeListOf<HTMLElement>;
    expect(items.length).toBe(2);

    const dialogs = el.shadowRoot?.querySelectorAll("dialog") || [];
    dialogs.forEach((d: any) => {
      d.showModal = jest.fn();
      d.close = jest.fn();
    });

    const firstItem = items[0];
    const cloneBtn = firstItem.querySelector(
      "[data-action='clone']",
    ) as HTMLButtonElement;
    const detailsBtn = firstItem.querySelector(
      "[data-action='details']",
    ) as HTMLButtonElement;
    const deleteBtn = firstItem.querySelector(
      "[data-action='delete']",
    ) as HTMLButtonElement;
    const toggleActionsBtn = firstItem.querySelector(
      ".conversation-actions-toggle",
    ) as HTMLButtonElement;

    // Toggle actions menu
    toggleActionsBtn.click();
    expect(firstItem.classList.contains("show-actions")).toBe(true);

    // Clone click opens clone dialog
    const handleCloneSpy = jest.spyOn(el, "handleClone");
    cloneBtn.click();
    expect(handleCloneSpy).toHaveBeenCalledWith("br:g1");

    // Details click opens details dialog
    const handleDetailsSpy = jest.spyOn(el, "handleDetails");
    detailsBtn.click();
    expect(handleDetailsSpy).toHaveBeenCalledWith("br:g1", "Group 1");

    // Delete click opens delete dialog
    const handleDeleteSpy = jest.spyOn(el, "handleDelete");
    deleteBtn.click();
    expect(handleDeleteSpy).toHaveBeenCalledWith("br:g1", "Group 1");

    document.body.removeChild(el);
  });

  it("handles drag and drop reordering events on items", async () => {
    mockOrchStore.groups = [
      { groupId: "br:g1", name: "Group 1", createdAt: 0 },
      { groupId: "br:g2", name: "Group 2", createdAt: 1 },
    ];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;

    const list = el.shadowRoot?.querySelector(
      ".conversation-list",
    ) as HTMLElement;
    const items = el.shadowRoot?.querySelectorAll(
      ".conversation-item",
    ) as NodeListOf<HTMLElement>;
    const firstHandle = items[0].querySelector(".drag-handle") as HTMLElement;

    // dragstart
    const dragStartEvent = new Event("dragstart", { bubbles: true }) as any;
    dragStartEvent.dataTransfer = { setData: jest.fn() };
    firstHandle.dispatchEvent(dragStartEvent);
    expect(el._draggedGroupId).toBe("br:g1");

    // dragover on second item
    const dragOverEvent = new Event("dragover", { bubbles: true }) as any;
    dragOverEvent.preventDefault = jest.fn();
    list.dispatchEvent(dragOverEvent);

    // drop on list
    const dropEvent = new Event("drop", { bubbles: true }) as any;
    dropEvent.preventDefault = jest.fn();
    list.dispatchEvent(dropEvent);

    // dragend
    firstHandle.dispatchEvent(new Event("dragend", { bubbles: true }));
    expect(el._draggedGroupId).toBeNull();

    document.body.removeChild(el);
  });

  it("handles touch dragging reordering events on drag handle", async () => {
    mockOrchStore.groups = [
      { groupId: "br:g1", name: "Group 1", createdAt: 0 },
      { groupId: "br:g2", name: "Group 2", createdAt: 1 },
    ];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;

    const items = el.shadowRoot?.querySelectorAll(
      ".conversation-item",
    ) as NodeListOf<HTMLElement>;
    const firstHandle = items[0].querySelector(".drag-handle") as HTMLElement;

    const list = el.shadowRoot?.querySelector(
      ".conversation-list",
    ) as HTMLElement;
    el.shadowRoot.elementFromPoint = jest.fn(() => items[1]);

    // touchstart
    const touchStartEvent = new Event("touchstart", { bubbles: true }) as any;
    touchStartEvent.touches = [{ identifier: 1, clientY: 50 }];
    firstHandle.dispatchEvent(touchStartEvent);
    expect(el._touchDraggedGroupId).toBe("br:g1");

    // touchmove
    const touchMoveEvent = new Event("touchmove", { bubbles: true }) as any;
    touchMoveEvent.touches = [{ identifier: 1, clientY: 100 }];
    list.dispatchEvent(touchMoveEvent);

    // touchend
    const touchEndEvent = new Event("touchend", { bubbles: true }) as any;
    touchEndEvent.changedTouches = [{ identifier: 1, clientY: 100 }];
    list.dispatchEvent(touchEndEvent);
    expect(el._touchDraggedGroupId).toBeNull();

    document.body.removeChild(el);
  });

  it("submits clone, create, and delete dialogs", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;

    // 1. Clone dialog submit
    const cloneDialog = el.shadowRoot?.querySelector(
      ".conversations__clone-dialog",
    );
    if (cloneDialog) (cloneDialog as any).close = jest.fn();
    el._pendingCloneGroupId = "br:g1";
    await el._submitCloneDialog();
    expect(mockOrchStore.cloneConversation).toHaveBeenCalledWith(
      el.db,
      "br:g1",
    );
    expect(el._pendingCloneGroupId).toBeNull();

    // 2. Create dialog submit with empty name
    const createInput = el.shadowRoot?.querySelector(
      ".conversations__create-dialog .conversations__input",
    ) as HTMLInputElement;
    const createDialog = el.shadowRoot?.querySelector(
      ".conversations__create-dialog",
    );
    if (createDialog) (createDialog as any).close = jest.fn();

    if (createInput) createInput.value = "   ";
    await el._submitCreateDialog();
    expect(mockOrchStore.createConversation).not.toHaveBeenCalled();

    // Create dialog submit with valid name
    if (createInput) createInput.value = "New Conv";
    await el._submitCreateDialog();
    expect(mockOrchStore.createConversation).toHaveBeenCalledWith(
      el.db,
      "New Conv",
    );

    // 3. Delete dialog submit
    const deleteDialog = el.shadowRoot?.querySelector(
      ".conversations__delete-dialog",
    );
    if (deleteDialog) (deleteDialog as any).close = jest.fn();
    el._pendingDeleteGroupId = "br:g2";
    await el._submitDeleteDialog();
    expect(mockOrchStore.deleteConversation).toHaveBeenCalledWith(
      el.db,
      "br:g2",
    );
    expect(el._pendingDeleteGroupId).toBeNull();

    document.body.removeChild(el);
  });

  it("submits details dialog with tool tags and provider settings", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.render();
    el.db = {} as any;

    const detailsDialog = el.shadowRoot?.querySelector(
      ".conversations__details-dialog",
    );
    if (detailsDialog) (detailsDialog as any).close = jest.fn();

    const detailsInput = el.shadowRoot?.querySelector(
      ".conversations__details-dialog .conversations__input",
    ) as HTMLInputElement;

    el._pendingRenameGroupId = "br:g1";
    el._pendingRenameName = "Old Name";
    el._pendingDetailsToolTags = ["bash", "git"];
    el._pendingDetailsPinnedProvider = "anthropic";
    el._pendingDetailsPinnedModel = "claude-3";
    el._pendingDetailsPinnedMaxTokens = 2048;
    el._pendingDetailsProviderRuntimeOverrides = { temperature: 0.7 };
    el._pendingDetailsSubagentMode = "manual";
    el._pendingDetailsSubagentProvider = "openai";
    el._pendingDetailsSubagentModel = "gpt-4";
    el._pendingDetailsSubagentMaxTokens = 1024;

    if (detailsInput) detailsInput.value = "Updated Name";

    await el._submitDetailsDialog();

    expect(mockOrchStore.renameConversation).toHaveBeenCalledWith(
      el.db,
      "br:g1",
      "Updated Name",
    );
    expect(mockOrchStore.updateConversationToolTags).toHaveBeenCalledWith(
      el.db,
      "br:g1",
      ["bash", "git"],
    );
    expect(mockOrchStore.updateConversationPinnedProvider).toHaveBeenCalledWith(
      el.db,
      "br:g1",
      "anthropic",
      "claude-3",
      2048,
    );
    expect(
      mockOrchStore.updateConversationProviderRuntimeOverrides,
    ).toHaveBeenCalledWith(el.db, "br:g1", { temperature: 0.7 });
    expect(
      mockOrchStore.updateConversationSubagentSettings,
    ).toHaveBeenCalledWith(el.db, "br:g1", "manual", "openai", "gpt-4", 1024);

    expect(el._pendingRenameGroupId).toBeNull();
    expect(el._pendingRenameName).toBeNull();

    // Reorder tests
    mockOrchStore.groups = [
      { groupId: "g1", name: "G1" },
      { groupId: "g2", name: "G2" },
      { groupId: "g3", name: "G3" },
    ];
    await el.handleReorder("g3", "g1");
    expect(mockOrchStore.reorderConversations).toHaveBeenCalledWith(el.db, [
      "g3",
      "g1",
      "g2",
    ]);

    await el.handleReorder("g1", "g2", ["g2", "g1", "g3"]);
    expect(mockOrchStore.reorderConversations).toHaveBeenCalledWith(el.db, [
      "g2",
      "g1",
      "g3",
    ]);

    // Persist height test
    await el._persistHeight(350);
    expect(mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "conversations_height",
      350,
    );

    // _loadProviderModels tests
    (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: "model-dyn-1", name: "Dynamic Model 1" }],
      }),
    });

    const providerWithDynamic = {
      id: "prov-test",
      name: "Test Provider",
      modelsUrl: "http://localhost/models",
    };

    const models = await el._loadProviderModels(providerWithDynamic);
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("model-dyn-1");

    document.body.removeChild(el);
  });
});
