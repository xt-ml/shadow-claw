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

jest.unstable_mockModule("../../db/clear-group-messages.js", () => ({
  clearGroupMessages: mockClearGroupMessages,
}));

jest.unstable_mockModule("../../db/set-config.js", () => ({
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("covers keyboard reordering, resize handling, autoscroll, peer participants, and dialog helpers", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    el.db = {} as any;
    await el.render();

    el.shadowRoot?.querySelectorAll("dialog").forEach((d: any) => {
      d.showModal = jest.fn();
      d.close = jest.fn();
    });

    // 1. Keyboard navigation and reordering
    console.log("CP1: start");
    mockOrchStore.groups = [
      { groupId: "g1", name: "Group 1" },
      { groupId: "g2", name: "Group 2" },
      { groupId: "g3", name: "Group 3" },
    ];
    el.render();

    const targetEl = document.createElement("div");
    targetEl.classList.add("conversation-item");

    // Grab g2 with 'm'
    el._handleKeyboard(
      { key: "m", preventDefault: jest.fn(), target: targetEl } as any,
      "g2",
      "Group 2",
    );
    expect(el._keyboardGrabbedId).toBe("g2");

    // ArrowUp swaps g2 with g1
    el._handleKeyboard(
      { key: "ArrowUp", preventDefault: jest.fn(), target: targetEl } as any,
      "g2",
      "Group 2",
    );
    expect(mockOrchStore.reorderConversations).toHaveBeenCalledWith(
      expect.anything(),
      ["g2", "g1", "g3"],
    );

    // ArrowDown swaps g2 with g3
    mockOrchStore.groups = [
      { groupId: "g1", name: "Group 1" },
      { groupId: "g2", name: "Group 2" },
      { groupId: "g3", name: "Group 3" },
    ];
    el._keyboardGrabbedId = "g2";
    el._handleKeyboard(
      { key: "ArrowDown", preventDefault: jest.fn(), target: targetEl } as any,
      "g2",
      "Group 2",
    );
    expect(mockOrchStore.reorderConversations).toHaveBeenCalledWith(
      expect.anything(),
      ["g1", "g3", "g2"],
    );

    // ArrowUp at top edge
    mockOrchStore.groups = [
      { groupId: "g1", name: "Group 1" },
      { groupId: "g2", name: "Group 2" },
    ];
    el._keyboardGrabbedId = "g1";
    el._handleKeyboard(
      { key: "ArrowUp", preventDefault: jest.fn(), target: targetEl } as any,
      "g1",
      "Group 1",
    );

    // Escape cancels
    el._handleKeyboard(
      { key: "Escape", preventDefault: jest.fn(), target: targetEl } as any,
      "g1",
      "Group 1",
    );
    expect(el._keyboardGrabbedId).toBeNull();

    // Enter / Space drops
    el._keyboardGrabbedId = "g1";
    el._handleKeyboard(
      { key: "Enter", preventDefault: jest.fn(), target: targetEl } as any,
      "g1",
      "Group 1",
    );
    expect(el._keyboardGrabbedId).toBeNull();

    el._keyboardGrabbedId = "g1";
    el._handleKeyboard(
      { key: " ", preventDefault: jest.fn(), target: targetEl } as any,
      "g1",
      "Group 1",
    );
    expect(el._keyboardGrabbedId).toBeNull();

    // When not grabbed: navigation keys
    el._keyboardGrabbedId = null;
    el._handleKeyboard(
      { key: "ArrowDown", preventDefault: jest.fn(), target: targetEl } as any,
      "g1",
      "Group 1",
    );
    el._handleKeyboard(
      { key: "ArrowUp", preventDefault: jest.fn(), target: targetEl } as any,
      "g1",
      "Group 1",
    );
    el._handleKeyboard(
      { key: "ArrowRight", preventDefault: jest.fn(), target: targetEl } as any,
      "g1",
      "Group 1",
    );
    el._handleKeyboard(
      { key: "ArrowLeft", preventDefault: jest.fn(), target: targetEl } as any,
      "g1",
      "Group 1",
    );
    const navListener = jest.fn();
    document.addEventListener("shadow-claw-navigate", navListener);
    el._handleKeyboard(
      { key: "Enter", preventDefault: jest.fn(), target: targetEl } as any,
      "g1",
      "Group 1",
    );
    expect(navListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ groupId: "g1" }),
      }),
    );
    document.removeEventListener("shadow-claw-navigate", navListener);

    // 2. Resize handle pointer events & dblclick
    el._initResizeHandle();
    const handle = el.shadowRoot?.querySelector(
      ".resize-handle",
    ) as HTMLElement;
    if (handle) {
      handle.setPointerCapture = jest.fn() as any;
      // non-primary mouse button ignored
      handle.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", button: 2 }),
      );

      // primary pointerdown
      handle.dispatchEvent(
        new PointerEvent("pointerdown", { pointerId: 1, button: 0 }),
      );
      expect(handle.classList.contains("active")).toBe(true);

      // pointermove
      document.dispatchEvent(
        new PointerEvent("pointermove", { pointerId: 1, clientY: 100 }),
      );

      // pointerup
      handle.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
      expect(handle.classList.contains("active")).toBe(false);

      // pointercancel
      handle.dispatchEvent(
        new PointerEvent("pointerdown", { pointerId: 2, button: 0 }),
      );
      handle.dispatchEvent(new PointerEvent("pointercancel"));
      expect(handle.classList.contains("active")).toBe(false);

      // dblclick resets
      handle.dispatchEvent(new MouseEvent("dblclick"));
      expect(mockSetConfig).toHaveBeenCalledWith(
        el.db,
        "conversations_height",
        0,
      );
    }

    // 3. Autoscroll
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    (global.fetch as any) = jest.fn<any>().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const listEl = el.shadowRoot?.querySelector(
      ".conversation-list",
    ) as HTMLElement;
    if (listEl) {
      listEl.getBoundingClientRect = () => ({ top: 100, bottom: 500 }) as any;
    }

    el._startAutoScroll();
    el._startAutoScroll(); // duplicate branch test
    el._updateAutoScrollSpeed(110); // near top
    expect(el._autoScrollSpeed).toBeLessThan(0);
    el._updateAutoScrollSpeed(490); // near bottom
    expect(el._autoScrollSpeed).toBeGreaterThan(0);
    el._updateAutoScrollSpeed(300); // middle
    expect(el._autoScrollSpeed).toBe(0);
    el._stopAutoScroll();
    expect(el._autoScrollActive).toBe(false);

    // 4. itemAtPoint
    const itemEl = el.shadowRoot?.querySelector(".conversation-item");
    (el.shadowRoot as any).elementFromPoint = jest.fn().mockReturnValue(itemEl);
    expect(el._itemAtPoint(10, 10)).toBe(itemEl);

    // 5. Dialog submissions & cancel
    // Create dialog
    const createInput = el.shadowRoot?.querySelector(
      ".conversations__create-dialog .conversations__input",
    ) as HTMLInputElement;
    if (createInput) {
      createInput.value = "";
      await el._submitCreateDialog();
      createInput.value = "New Conversation";
      await el._submitCreateDialog();
      expect(mockOrchStore.createConversation).toHaveBeenCalledWith(
        el.db,
        "New Conversation",
      );
    }

    // Delete dialog
    el._pendingDeleteGroupId = null;
    await el._submitDeleteDialog();
    el._pendingDeleteGroupId = "br:to-delete";
    await el._submitDeleteDialog();
    expect(mockOrchStore.deleteConversation).toHaveBeenCalledWith(
      el.db,
      "br:to-delete",
    );
    expect(el._pendingDeleteGroupId).toBeNull();

    // Clone dialog
    el._pendingCloneGroupId = null;
    await el._submitCloneDialog();
    el._pendingCloneGroupId = "br:to-clone";
    await el._submitCloneDialog();
    expect(mockOrchStore.cloneConversation).toHaveBeenCalledWith(
      el.db,
      "br:to-clone",
    );
    expect(el._pendingCloneGroupId).toBeNull();

    // Details dialog empty / missing pending
    el._pendingRenameGroupId = null;
    await el._submitDetailsDialog();

    // Dialog cancel buttons
    const createCancel = el.shadowRoot?.querySelector(
      ".conversations__create-dialog .conversations__cancel",
    ) as HTMLButtonElement;
    createCancel?.click();

    const detailsCancel = el.shadowRoot?.querySelector(
      ".conversations__details-dialog .conversations__cancel",
    ) as HTMLButtonElement;
    detailsCancel?.click();

    const deleteCancel = el.shadowRoot?.querySelector(
      ".conversations__delete-dialog .conversations__cancel",
    ) as HTMLButtonElement;
    deleteCancel?.click();

    const cloneCancel = el.shadowRoot?.querySelector(
      ".conversations__clone-dialog .conversations__cancel",
    ) as HTMLButtonElement;
    cloneCancel?.click();

    // 6. Peer participant details & copy button
    mockOrchStore.orchestrator = {
      ...mockOrchStore.orchestrator,
      peerjs: {
        connectedPeersSignal: {
          get: () => ["peer-12345678"],
        },
      },
      peerjsPeerAliases: {
        Alice: "peer-12345678",
      },
      getApiKeyForSpecificProvider: jest.fn().mockResolvedValue("test-key"),
    };

    // Open details for peer group
    el.openDetailsDialog("Peer Chat", "peer:peer-12345678");
    const copyBtn = el.shadowRoot?.querySelector(
      ".conversations__group-id-copy-btn",
    ) as HTMLButtonElement;
    if (copyBtn) {
      await copyBtn.click();
    }

    // Also test peer not connected
    el.openDetailsDialog("Disconnected Peer", "peer:unknown-peer");

    // 7. _loadProviderModels edge cases
    // array models
    const pStatic = { id: "p1", name: "P1", models: [{ id: "m1" }] };
    const resStatic = await el._loadProviderModels(pStatic as any);
    expect(resStatic).toEqual([{ id: "m1" }]);

    // no modelsUrl
    const pNoUrl = { id: "p2", name: "P2" };
    const resNoUrl = await el._loadProviderModels(pNoUrl as any);
    expect(resNoUrl).toEqual([]);

    // fetch error
    (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
      ok: false,
      status: 500,
    });
    await expect(
      el._loadProviderModels({
        id: "p3",
        modelsUrl: "http://example.com",
      } as any),
    ).rejects.toThrow("HTTP 500");

    // fetch returns array
    (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "arr-model" }],
    });
    const resArr = await el._loadProviderModels({
      id: "p4",
      modelsUrl: "http://example.com",
    } as any);
    expect(resArr[0].id).toBe("arr-model");

    // fetch with apiKeyHeader
    (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ id: "obj-model" }] }),
    });
    const resObj = await el._loadProviderModels({
      id: "p5",
      modelsUrl: "http://example.com",
      apiKeyHeader: "Authorization",
      apiKeyHeaderFormat: "Bearer {key}",
    } as any);
    expect(resObj[0].id).toBe("obj-model");

    // fetch single object
    (global.fetch as any) = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "single-model", name: "Single" }),
    });
    const resSingle = await el._loadProviderModels({
      id: "p6",
      modelsUrl: "http://example.com",
    } as any);
    expect(resSingle).toHaveLength(1);

    // persist height without argument & when db is null
    el.getBoundingClientRect = () => ({ height: 320 }) as any;
    await el._persistHeight();
    el.db = null;
    await el._persistHeight();

    document.body.removeChild(el);
  });

  it("handles openCloneDialog, openCreateDialog, openDeleteDialog, and openDetailsDialog edge cases", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    el.db = {};

    // 1. openCloneDialog when dialog is missing or has nameSpan
    const root = el.shadowRoot;
    const cloneDialog = root.querySelector(".conversations__clone-dialog");
    const cloneNameSpan = cloneDialog.querySelector(
      ".conversations__clone-name",
    );
    el.openCloneDialog("My Clone");
    expect(cloneNameSpan.textContent).toBe("My Clone");

    cloneDialog.remove();
    expect(() => el.openCloneDialog("Test")).not.toThrow();
    root.appendChild(cloneDialog);

    // 2. openCreateDialog when dialog is missing or has input
    const createDialog = root.querySelector(".conversations__create-dialog");
    const createInput = root.querySelector(
      ".conversations__create-dialog .conversations__input",
    );
    createInput.value = "dirty text";
    el.openCreateDialog();
    expect(createInput.value).toBe("");

    createDialog.remove();
    expect(() => el.openCreateDialog()).not.toThrow();
    root.appendChild(createDialog);

    // 3. openDeleteDialog when dialog is missing or has nameSpan
    const deleteDialog = root.querySelector(".conversations__delete-dialog");
    const deleteNameSpan = deleteDialog.querySelector(
      ".conversations__delete-name",
    );
    el.openDeleteDialog("Delete Me");
    expect(deleteNameSpan.textContent).toBe("Delete Me");

    deleteDialog.remove();
    expect(() => el.openDeleteDialog("Test")).not.toThrow();
    root.appendChild(deleteDialog);

    // 4. openDetailsDialog with non-peer groupId and copy button click
    const origClipboard = navigator.clipboard;
    let writtenText = "";
    (navigator as any).clipboard = {
      writeText: jest.fn().mockImplementation(async (text: string) => {
        writtenText = text;
      }),
    };

    el._pendingDetailsToolTags = ["bash"];
    el.openDetailsDialog("General Chat", "conv:123");
    const copyBtn = root.querySelector(
      "#conversations-group-id-copy-btn",
    ) as HTMLButtonElement;
    copyBtn?.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(writtenText).toBe("conv-123");

    // Copy button fallback when clipboard throws
    (navigator as any).clipboard.writeText = jest
      .fn()
      .mockRejectedValue(new Error("denied"));
    const groupIdInput = root.querySelector(
      "#conversations-details-group-id",
    ) as HTMLInputElement;
    const selectSpy = jest.spyOn(groupIdInput, "select");
    copyBtn?.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(selectSpy).toHaveBeenCalled();

    // Copy button when input has empty value
    groupIdInput.value = "";
    copyBtn?.click();

    // 5. openDetailsDialog with peer:groupId
    mockOrchStore.orchestrator = {
      peerjs: {
        connectedPeersSignal: {
          get: () => ["peer-123", "peer-456"],
        },
      },
      peerjsPeerAliases: {
        Alice: "peer-123",
      },
    };

    // Peer connected with alias
    el.openDetailsDialog("Alice Peer", "peer:peer-123");
    let participantsList = root.querySelector(
      "#conversations-details-participants-list",
    ) as HTMLElement;
    const peerInput1 = participantsList.querySelector(
      "input",
    ) as HTMLInputElement;
    expect(peerInput1?.value).toContain("Alice (peer-123)");

    // Click copy peer id button
    const peerCopyBtn = participantsList.querySelector(
      ".conversations__group-id-copy-btn",
    ) as HTMLButtonElement;
    peerCopyBtn?.click();
    await new Promise((r) => setTimeout(r, 10));

    // Peer connected without alias
    el.openDetailsDialog("Bob Peer", "peer:peer-456");
    participantsList = root.querySelector(
      "#conversations-details-participants-list",
    ) as HTMLElement;
    const peerInput2 = participantsList.querySelector(
      "input",
    ) as HTMLInputElement;
    expect(peerInput2?.value).toContain("peer-456");

    // Peer not connected
    el.openDetailsDialog("Offline Peer", "peer:peer-999");
    participantsList = root.querySelector(
      "#conversations-details-participants-list",
    ) as HTMLElement;
    expect(participantsList.textContent).toContain(
      "Peer is not currently connected.",
    );

    (navigator as any).clipboard = origClipboard;
    document.body.removeChild(el);
  });

  it("handles tool tags manipulation and subagent settings in details dialog", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    el.db = {};
    const root = el.shadowRoot;

    el._pendingDetailsToolTags = ["bash", "fetch_url"];
    el._pendingDetailsPinnedMaxTokens = 4096;
    el._pendingDetailsSubagentMaxTokens = 2048;
    el._pendingDetailsSubagentMode = "manual";
    el._pendingDetailsPinnedProvider = "openai";
    el.openDetailsDialog("Tools Dialog", "grp-tools");

    // 1. Remove chip
    const removeBtn = root.querySelector(
      ".conversations__tool-chip-remove",
    ) as HTMLButtonElement;
    removeBtn?.click();
    expect(el._pendingDetailsToolTags).not.toContain("bash");

    // 2. Add tool via input & button
    const toolInput = root.querySelector(
      "#conversations-tool-input",
    ) as HTMLInputElement;
    const toolAddBtn = root.querySelector(
      "#conversations-add-tool-btn",
    ) as HTMLButtonElement;

    // 2a. Empty value
    toolInput.value = "   ";
    toolAddBtn.click();

    // 2b. Invalid name
    toolInput.value = "INVALID NAME!@#";
    toolAddBtn.click();

    // 2c. Valid tool name
    toolInput.value = "web_search";
    toolAddBtn.click();
    expect(el._pendingDetailsToolTags).toContain("web_search");

    // 2d. Duplicate tool name
    toolInput.value = "web_search";
    toolAddBtn.click();

    // 2e. Enter key on toolInput
    toolInput.value = "new_tool";
    toolInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(el._pendingDetailsToolTags).toContain("new_tool");

    // 3. Subagent mode change
    const subagentModeSelect = root.querySelector(
      "#conversations-subagent-mode",
    ) as HTMLSelectElement;
    subagentModeSelect.value = "automatic";
    subagentModeSelect.onchange?.({} as any);
    expect(el._pendingDetailsSubagentMode).toBe("automatic");

    subagentModeSelect.value = "manual";
    subagentModeSelect.onchange?.({} as any);
    expect(el._pendingDetailsSubagentMode).toBe("manual");

    // 4. Token inputs
    const agentMaxTokensInput = root.querySelector(
      "#conversations-agent-max-tokens",
    ) as HTMLInputElement;
    agentMaxTokensInput.value = "8192";
    agentMaxTokensInput.dispatchEvent(new Event("input"));
    expect(el._pendingDetailsPinnedMaxTokens).toBe(8192);

    agentMaxTokensInput.value = "invalid";
    agentMaxTokensInput.dispatchEvent(new Event("input"));
    expect(el._pendingDetailsPinnedMaxTokens).toBeNull();

    const subagentMaxTokensInput = root.querySelector(
      "#conversations-subagent-max-tokens",
    ) as HTMLInputElement;
    subagentMaxTokensInput.value = "1024";
    subagentMaxTokensInput.dispatchEvent(new Event("input"));
    expect(el._pendingDetailsSubagentMaxTokens).toBe(1024);

    subagentMaxTokensInput.value = "-5";
    subagentMaxTokensInput.dispatchEvent(new Event("input"));
    expect(el._pendingDetailsSubagentMaxTokens).toBeNull();

    // 5. Main picker and subagent picker event handlers
    const mainPicker = root.querySelector("#conversations-main-picker");
    mainPicker?.dispatchEvent(
      new CustomEvent("provider-model-change", {
        detail: { providerId: "anthropic", modelId: "claude-3-sonnet" },
      }),
    );
    expect(el._pendingDetailsPinnedProvider).toBe("anthropic");
    expect(el._pendingDetailsPinnedModel).toBe("claude-3-sonnet");

    const subagentPicker = root.querySelector("#conversations-subagent-picker");
    subagentPicker?.dispatchEvent(
      new CustomEvent("provider-model-change", {
        detail: { providerId: "google", modelId: "gemini-2.5-pro" },
      }),
    );
    expect(el._pendingDetailsSubagentProvider).toBe("google");
    expect(el._pendingDetailsSubagentModel).toBe("gemini-2.5-pro");

    // 6. Provider module settings change
    const mainSettings = root.querySelector(
      "#conversations-main-provider-module-settings",
    );
    mainSettings?.dispatchEvent(
      new CustomEvent("provider-module-settings-change", {
        detail: {
          providerId: "llamafile",
          overrides: { llamafile: { port: 8080 } },
        },
      }),
    );
    expect(el._pendingDetailsProviderRuntimeOverrides.llamafile).toEqual({
      port: 8080,
    });

    mainSettings?.dispatchEvent(
      new CustomEvent("provider-module-settings-change", {
        detail: {
          providerId: "bedrock_proxy",
          overrides: { bedrock_proxy: { region: "us-east-1" } },
        },
      }),
    );
    expect(el._pendingDetailsProviderRuntimeOverrides.bedrock_proxy).toEqual({
      region: "us-east-1",
    });

    mainSettings?.dispatchEvent(
      new CustomEvent("provider-module-settings-change", {
        detail: {},
      }),
    );

    const subagentSettings = root.querySelector(
      "#conversations-subagent-provider-module-settings",
    );
    subagentSettings?.dispatchEvent(
      new CustomEvent("provider-module-settings-change", {
        detail: {
          providerId: "llamafile",
          overrides: { llamafile: { port: 9090 } },
        },
      }),
    );
    expect(el._pendingDetailsProviderRuntimeOverrides.llamafile).toEqual({
      port: 9090,
    });

    document.body.removeChild(el);
  });

  it("handles handleClone, handleCreate, handleDelete, handleDetails, handleReorder, and handleSwitch branches", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);

    // 1. Without db
    el.db = null;
    await el.handleClone("br:main");
    await el.handleCreate();
    await el.handleDelete("br:main", "Main");
    await el.handleDetails("br:main", "Main");
    await el.handleReorder("g1", "g2");

    // 2. With db
    el.db = {};
    mockOrchStore.groups = [
      {
        groupId: "g1",
        name: "Group 1",
        toolTags: ["bash"],
        pinnedMaxTokens: 2000,
        pinnedProvider: "openai",
        pinnedModel: "gpt-4",
        subagentModelSelectionMode: "manual",
        subagentMaxTokens: 1000,
        subagentPinnedProvider: "anthropic",
        subagentPinnedModel: "claude",
      },
      { groupId: "g2", name: "Group 2" },
      { groupId: "g3", name: "Group 3" },
    ];

    // handleClone with unknown group
    await el.handleClone("unknown-group");

    // handleClone with known group
    await el.handleClone("g1");
    expect(el._pendingCloneGroupId).toBe("g1");

    // handleDetails with group
    await el.handleDetails("g1", "Group 1");
    expect(el._pendingRenameGroupId).toBe("g1");

    // handleReorder with precomputedIds
    await el.handleReorder("g1", "g2", ["g3", "g2", "g1"]);
    expect(mockOrchStore.reorderConversations).toHaveBeenCalledWith(el.db, [
      "g3",
      "g2",
      "g1",
    ]);

    // handleReorder with invalid IDs
    await el.handleReorder("invalid", "g2");

    // handleReorder normal swap
    await el.handleReorder("g1", "g3");
    expect(mockOrchStore.reorderConversations).toHaveBeenCalledWith(el.db, [
      "g2",
      "g3",
      "g1",
    ]);

    // handleSwitch branches
    mockOrchStore.activeGroupId = "g1";
    await el.handleSwitch("g1"); // already active -> return

    let navDetail: any = null;
    const navListener = (e: any) => {
      navDetail = e.detail;
    };
    document.addEventListener("shadow-claw-navigate", navListener);

    mockOrchStore.activePage = "tasks";
    await el.handleSwitch("g2");
    expect(navDetail).toEqual({ page: "tasks", groupId: "g2" });

    mockOrchStore.activePage = "files";
    await el.handleSwitch("g3");
    expect(navDetail).toEqual({ page: "files", groupId: "g3" });

    mockOrchStore.activePage = "chat";
    await el.handleSwitch("g2");
    expect(navDetail).toEqual({ page: "chat", groupId: "g2" });

    mockOrchStore.activePage = "unknown";
    mockOrchStore.sidebarDefaultPage = "tasks";
    await el.handleSwitch("g3");
    expect(navDetail).toEqual({ page: "tasks", groupId: "g3" });

    mockOrchStore.activePage = "unknown";
    mockOrchStore.sidebarDefaultPage = "files";
    await el.handleSwitch("g3");
    expect(navDetail).toEqual({ page: "files", groupId: "g3" });

    mockOrchStore.activePage = "unknown";
    mockOrchStore.sidebarDefaultPage = "pages";
    await el.handleSwitch("g3");
    expect(navDetail).toEqual({ page: "chat", groupId: "g3" });

    document.removeEventListener("shadow-claw-navigate", navListener);
    document.body.removeChild(el);
  });

  it("handles keyboard navigation, selection, and grab/drop reordering", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    el.db = {};
    mockOrchStore.groups = [
      { groupId: "g1", name: "Group 1" },
      { groupId: "g2", name: "Group 2" },
      { groupId: "g3", name: "Group 3" },
    ];
    el.render();

    const root = el.shadowRoot;
    const items = root.querySelectorAll(".conversation-item");
    const item1 = items[0] as HTMLElement;

    // 1. Navigation when not grabbed
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );

    // Selection via Space / Enter
    const switchSpy = jest
      .spyOn(el, "handleSwitch")
      .mockResolvedValue(undefined);
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(switchSpy).toHaveBeenCalledWith("g1");

    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    expect(switchSpy).toHaveBeenCalledTimes(2);

    // 2. Grab with 'm'
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "m", bubbles: true }),
    );
    expect(el._keyboardGrabbedId).toBe("g1");

    // ArrowUp at top boundary (index 0) -> does not move
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    expect(el._keyboardGrabbedId).toBe("g1");

    // ArrowDown -> moves down
    const reorderSpy = jest
      .spyOn(el, "handleReorder")
      .mockResolvedValue(undefined);
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(reorderSpy).toHaveBeenCalledWith("g1", "g2", ["g2", "g1", "g3"]);

    // Escape cancels reorder
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(el._keyboardGrabbedId).toBeNull();

    // Grab again and drop with Enter
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "M", bubbles: true }),
    );
    expect(el._keyboardGrabbedId).toBe("g1");
    item1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(el._keyboardGrabbedId).toBeNull();

    document.body.removeChild(el);
  });

  it("handles touch drag-drop, autoscroll, and resize handle pointer events", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    el.db = {};
    await new Promise((r) => setTimeout(r, 20));
    mockOrchStore.groups = [
      { groupId: "g1", name: "Group 1" },
      { groupId: "g2", name: "Group 2" },
    ];
    el.render();

    const root = el.shadowRoot;
    const list = root.querySelector(".conversation-list") as HTMLElement;
    const item1 = root.querySelector('[data-group-id="g1"]') as HTMLElement;
    const handle1 = item1.querySelector(".drag-handle") as HTMLElement;

    // 1. Touch start on handle
    const emptyTouch = new CustomEvent("touchstart", { bubbles: true }) as any;
    emptyTouch.touches = [];
    handle1.dispatchEvent(emptyTouch);

    const touchObj = { identifier: 42, clientX: 10, clientY: 20 };
    const touchStartEv = new CustomEvent("touchstart", {
      bubbles: true,
    }) as any;
    touchStartEv.touches = [touchObj];
    touchStartEv.preventDefault = jest.fn();
    handle1.dispatchEvent(touchStartEv);
    expect(el._touchId).toBe(42);
    expect(el._touchDraggedGroupId).toBe("g1");

    // 2. Touch move on list
    el._itemAtPoint = jest
      .fn()
      .mockReturnValue(root.querySelector('[data-group-id="g2"]'));
    const touchMoveEv = new CustomEvent("touchmove", { bubbles: true }) as any;
    touchMoveEv.touches = [touchObj];
    touchMoveEv.preventDefault = jest.fn();
    list.dispatchEvent(touchMoveEv);

    // 3. Touch end on list
    const touchEndEv = new CustomEvent("touchend", { bubbles: true }) as any;
    touchEndEv.changedTouches = [touchObj];
    const reorderSpy = jest
      .spyOn(el, "handleReorder")
      .mockResolvedValue(undefined);
    list.dispatchEvent(touchEndEv);
    expect(reorderSpy).toHaveBeenCalledWith("g1", "g2");
    expect(el._touchDraggedGroupId).toBeNull();

    // 4. Touch cancel on list
    el._touchDraggedGroupId = "g1";
    el._touchId = 42;
    list.dispatchEvent(new Event("touchcancel"));
    expect(el._touchDraggedGroupId).toBeNull();

    // 5. Auto-scroll logic
    el._startAutoScroll();
    expect(el._autoScrollActive).toBe(true);
    el._startAutoScroll(); // already active branch

    list.getBoundingClientRect = () =>
      ({ top: 100, bottom: 500, height: 400 }) as any;
    el._updateAutoScrollSpeed(120); // distTop = 20 < 50 -> scroll up
    expect(el._autoScrollSpeed).toBeLessThan(0);

    el._updateAutoScrollSpeed(480); // distBottom = 20 < 50 -> scroll down
    expect(el._autoScrollSpeed).toBeGreaterThan(0);

    el._updateAutoScrollSpeed(300); // middle -> speed 0
    expect(el._autoScrollSpeed).toBe(0);

    el._stopAutoScroll();
    expect(el._autoScrollActive).toBe(false);

    // 6. Resize handle pointer interactions
    el._initResizeHandle();
    const resizeHandle = root.querySelector(".resize-handle") as HTMLElement;
    resizeHandle.setPointerCapture = jest.fn();

    // pointerdown with right click (ignored)
    const pdRight = new CustomEvent("pointerdown") as any;
    pdRight.pointerType = "mouse";
    pdRight.button = 2;
    resizeHandle.dispatchEvent(pdRight);

    // pointerdown with left click
    const pdLeft = new CustomEvent("pointerdown") as any;
    pdLeft.pointerType = "mouse";
    pdLeft.button = 0;
    pdLeft.pointerId = 1;
    pdLeft.preventDefault = jest.fn();
    resizeHandle.dispatchEvent(pdLeft);
    expect(resizeHandle.classList.contains("active")).toBe(true);

    // pointermove on document
    const pm = new CustomEvent("pointermove") as any;
    pm.pointerId = 1;
    pm.clientY = 50;
    document.dispatchEvent(pm);

    // pointerup with matching pointerId
    const pu = new CustomEvent("pointerup") as any;
    pu.pointerId = 1;
    resizeHandle.dispatchEvent(pu);
    expect(resizeHandle.classList.contains("active")).toBe(false);

    // dblclick resets height
    resizeHandle.dispatchEvent(new MouseEvent("dblclick"));

    document.body.removeChild(el);
  });

  it("handles dialog forms submission and item action clicks", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    el.db = {};
    el._setupDialogListeners();
    mockOrchStore.groups = [
      { groupId: "g1", name: "Group 1", toolTags: ["bash"] },
      { groupId: "g2", name: "Group 2" },
    ];
    el.render();

    const root = el.shadowRoot;
    const item1 = root.querySelector('[data-group-id="g1"]') as HTMLElement;

    // 1. Actions toggle click
    const toggleBtn = item1.querySelector(
      ".conversation-actions-toggle",
    ) as HTMLElement;
    toggleBtn?.click();
    expect(item1.classList.contains("show-actions")).toBe(true);

    // 2. Clone button click
    const cloneBtn = item1.querySelector(
      '[data-action="clone"]',
    ) as HTMLElement;
    cloneBtn?.click();
    expect(el._pendingCloneGroupId).toBe("g1");

    // Submit clone form
    const cloneForm = root.querySelector(
      ".conversations__clone-dialog .conversations__form",
    ) as HTMLFormElement;
    cloneForm.dispatchEvent(new Event("submit"));
    expect(mockOrchStore.cloneConversation).toHaveBeenCalledWith(el.db, "g1");

    // 3. Details button click
    const detailsBtn = item1.querySelector(
      '[data-action="details"]',
    ) as HTMLElement;
    detailsBtn?.click();
    expect(el._pendingRenameGroupId).toBe("g1");

    // Details form submit with changed name
    const detailsInput = root.querySelector(
      ".conversations__details-dialog .conversations__input",
    ) as HTMLInputElement;
    detailsInput.value = "New Name For Group 1";
    const detailsForm = root.querySelector(
      ".conversations__details-dialog .conversations__form",
    ) as HTMLFormElement;
    detailsForm.dispatchEvent(new Event("submit"));
    expect(mockOrchStore.renameConversation).toHaveBeenCalledWith(
      el.db,
      "g1",
      "New Name For Group 1",
    );

    // 4. Delete button click
    const deleteBtn = item1.querySelector(
      '[data-action="delete"]',
    ) as HTMLElement;
    deleteBtn?.click();
    expect(el._pendingDeleteGroupId).toBe("g1");

    // Delete form submit
    const deleteForm = root.querySelector(
      ".conversations__delete-dialog .conversations__form",
    ) as HTMLFormElement;
    deleteForm.dispatchEvent(new Event("submit"));
    expect(mockOrchStore.deleteConversation).toHaveBeenCalledWith(el.db, "g1");

    // 5. Create form submit
    const createInput = root.querySelector(
      ".conversations__create-dialog .conversations__input",
    ) as HTMLInputElement;
    createInput.value = "Newly Created Group";
    const createForm = root.querySelector(
      ".conversations__create-dialog .conversations__form",
    ) as HTMLFormElement;
    createForm.dispatchEvent(new Event("submit"));
    expect(mockOrchStore.createConversation).toHaveBeenCalledWith(
      el.db,
      "Newly Created Group",
    );

    // 6. Dialog cancel buttons
    const createCancel = root.querySelector(
      ".conversations__create-dialog .conversations__cancel",
    ) as HTMLElement;
    createCancel?.click();

    const detailsCancel = root.querySelector(
      ".conversations__details-dialog .conversations__cancel",
    ) as HTMLElement;
    detailsCancel?.click();

    const deleteCancel = root.querySelector(
      ".conversations__delete-dialog .conversations__cancel",
    ) as HTMLElement;
    deleteCancel?.click();

    const cloneCancel = root.querySelector(
      ".conversations__clone-dialog .conversations__cancel",
    ) as HTMLElement;
    cloneCancel?.click();

    document.body.removeChild(el);
  });

  it("covers missing branches for shadowRoot, dialogs, drag-and-drop, resize, and provider models", async () => {
    // 1. Missing root branches
    const elNoRoot = new ShadowClawConversations() as any;
    Object.defineProperty(elNoRoot, "shadowRoot", { get: () => null });
    elNoRoot.openCloneDialog("Test");
    elNoRoot.openCreateDialog();
    elNoRoot.openDeleteDialog("Test");
    elNoRoot.openDetailsDialog("Test");
    elNoRoot._announce("Test announce");
    expect(elNoRoot._focusNext(null)).toBeUndefined();
    expect(elNoRoot._focusNextItem(null)).toBeUndefined();
    expect(elNoRoot._focusPrev(null)).toBeUndefined();
    expect(elNoRoot._focusPrevItem(null)).toBeUndefined();
    expect(elNoRoot._itemAtPoint(0, 0)).toBeNull();
    await elNoRoot._submitCloneDialog();
    await elNoRoot._submitCreateDialog();
    await elNoRoot._submitDeleteDialog();
    await elNoRoot._submitDetailsDialog();

    // 2. DisconnectedCallback and effectCleanup
    const elEffect = new ShadowClawConversations() as any;
    const cleanupSpy = jest.fn();
    elEffect._effectCleanup = cleanupSpy;
    elEffect.disconnectedCallback();
    expect(cleanupSpy).toHaveBeenCalled();
    elEffect._effectCleanup = null;
    expect(() => elEffect.disconnectedCallback()).not.toThrow();

    // 3. _announce when region exists
    const elAnnounce = new ShadowClawConversations() as any;
    elAnnounce._announce("Testing screen reader announcement");

    // 4. openDetailsDialog with undefined/empty groupId & peer branches
    const elDetails = new ShadowClawConversations() as any;
    document.body.appendChild(elDetails);
    elDetails.db = {};
    elDetails.openDetailsDialog("No Group");
    elDetails.openDetailsDialog("Empty Group", "");

    // peerjs connectedPeersSignal fallback to []
    mockOrchStore.orchestrator = {
      peerjs: null,
      peerjsPeerAliases: null,
      getAvailableProviders: () => null,
    };
    elDetails.openDetailsDialog("Peer null", "peer:peer-none");

    // Candidate tools and tool tags branches
    elDetails._pendingDetailsToolTags = null;
    elDetails.openDetailsDialog("Tools Tags Null", "g-null");
    // toolAddBtn with null pending tags
    const toolInput = elDetails.shadowRoot.querySelector(
      "#conversations-tool-input",
    ) as HTMLInputElement;
    const toolAddBtn = elDetails.shadowRoot.querySelector(
      "#conversations-add-tool-btn",
    ) as HTMLButtonElement;
    toolInput.value = "new_tag_added";
    toolAddBtn.click();
    expect(elDetails._pendingDetailsToolTags).toContain("new_tag_added");

    // 5. Provider module events branches
    const mainSettings = elDetails.shadowRoot.querySelector(
      "#conversations-main-provider-module-settings",
    );
    elDetails._pendingDetailsProviderRuntimeOverrides = null;
    mainSettings?.dispatchEvent(
      new CustomEvent("provider-module-settings-change", {
        detail: { providerId: "unknown_provider", overrides: {} },
      }),
    );

    const subSettings = elDetails.shadowRoot.querySelector(
      "#conversations-subagent-provider-module-settings",
    );
    elDetails._pendingDetailsProviderRuntimeOverrides = null;
    subSettings?.dispatchEvent(
      new CustomEvent("provider-module-settings-change", {
        detail: { providerId: "unknown_provider", overrides: {} },
      }),
    );

    // subagentModeSelect onchange when mode manual and spawn_subagent enabled
    const subModeSelect = elDetails.shadowRoot.querySelector(
      "#conversations-subagent-mode",
    ) as HTMLSelectElement;
    elDetails._pendingDetailsToolTags = ["spawn_subagent"];
    elDetails._pendingDetailsSubagentProvider = "openai";
    subModeSelect.value = "manual";
    subModeSelect.onchange?.({} as any);
    expect(elDetails._pendingDetailsSubagentMode).toBe("manual");

    // subagentMaxTokensInput input events
    const subTokensInput = elDetails.shadowRoot.querySelector(
      "#conversations-subagent-max-tokens",
    ) as HTMLInputElement;
    subTokensInput.value = "2048";
    subTokensInput.dispatchEvent(new Event("input"));
    expect(elDetails._pendingDetailsSubagentMaxTokens).toBe(2048);
    subTokensInput.value = "-5";
    subTokensInput.dispatchEvent(new Event("input"));
    expect(elDetails._pendingDetailsSubagentMaxTokens).toBeNull();

    // 6. Drag-and-drop branches on li
    mockOrchStore.groups = [
      { groupId: "g1", name: "G1" },
      { groupId: "g2", name: "G2" },
    ];
    elDetails.render();
    const li1 = elDetails.shadowRoot.querySelector(
      '[data-group-id="g1"]',
    ) as HTMLElement;
    const li2 = elDetails.shadowRoot.querySelector(
      '[data-group-id="g2"]',
    ) as HTMLElement;

    // dragover when _draggedGroupId is null
    elDetails._draggedGroupId = null;
    li1.dispatchEvent(new Event("dragover"));
    expect(li1.classList.contains("drag-over")).toBe(false);

    // dragover when _draggedGroupId is same
    elDetails._draggedGroupId = "g1";
    li1.dispatchEvent(new Event("dragover"));
    expect(li1.classList.contains("drag-over")).toBe(false);

    // dragover when _draggedGroupId is different
    elDetails._draggedGroupId = "g2";
    li1.dispatchEvent(new Event("dragover"));
    expect(li1.classList.contains("drag-over")).toBe(true);

    // dragleave
    li1.dispatchEvent(new Event("dragleave"));
    expect(li1.classList.contains("drag-over")).toBe(false);

    // drop when _draggedGroupId is null
    elDetails._draggedGroupId = null;
    li1.dispatchEvent(new Event("drop"));

    // drop when _draggedGroupId is same
    elDetails._draggedGroupId = "g1";
    li1.dispatchEvent(new Event("drop"));

    // drop when _draggedGroupId is different
    const reorderSpy = jest
      .spyOn(elDetails, "handleReorder")
      .mockResolvedValue(undefined);
    elDetails._draggedGroupId = "g2";
    li1.dispatchEvent(new Event("drop"));
    expect(reorderSpy).toHaveBeenCalledWith("g2", "g1");

    // 7. Touch list drag branches
    const list = elDetails.shadowRoot.querySelector(
      ".conversation-list",
    ) as HTMLElement;
    // touchmove when _touchDraggedGroupId is null
    elDetails._touchDraggedGroupId = null;
    list.dispatchEvent(new CustomEvent("touchmove", { bubbles: true }));

    // touchmove with empty touches
    elDetails._touchDraggedGroupId = "g1";
    const tmEmpty = new CustomEvent("touchmove", { bubbles: true }) as any;
    tmEmpty.touches = [];
    list.dispatchEvent(tmEmpty);

    // touchend when _touchDraggedGroupId is null
    elDetails._touchDraggedGroupId = null;
    list.dispatchEvent(new CustomEvent("touchend", { bubbles: true }));

    // touchend with empty changedTouches
    elDetails._touchDraggedGroupId = "g1";
    const teEmpty = new CustomEvent("touchend", { bubbles: true }) as any;
    teEmpty.changedTouches = [];
    list.dispatchEvent(teEmpty);

    // _bindTouchListEvents guard when already bound
    (list as any)._touchBound = true;
    elDetails._bindTouchListEvents(list);

    // 8. Resize handle pointer branches
    elDetails._initResizeHandle();
    const handle = elDetails.shadowRoot.querySelector(
      ".resize-handle",
    ) as HTMLElement;
    handle.setPointerCapture = jest.fn();

    // pointerdown non-primary
    const pdIgnored = new CustomEvent("pointerdown") as any;
    pdIgnored.pointerType = "mouse";
    pdIgnored.button = 1;
    handle.dispatchEvent(pdIgnored);

    // pointerdown valid
    const pdValid = new CustomEvent("pointerdown") as any;
    pdValid.pointerType = "mouse";
    pdValid.button = 0;
    pdValid.pointerId = 99;
    handle.dispatchEvent(pdValid);

    // pointermove with mismatched pointerId
    const pmMismatch = new CustomEvent("pointermove") as any;
    pmMismatch.pointerId = 100;
    document.dispatchEvent(pmMismatch);

    // pointermove with matched pointerId but clamped height (too small and too large)
    const pmSmall = new CustomEvent("pointermove") as any;
    pmSmall.pointerId = 99;
    pmSmall.clientY = 10000;
    document.dispatchEvent(pmSmall);

    const pmLarge = new CustomEvent("pointermove") as any;
    pmLarge.pointerId = 99;
    pmLarge.clientY = -10000;
    document.dispatchEvent(pmLarge);

    // pointerup with mismatched pointerId
    const puMismatch = new CustomEvent("pointerup") as any;
    puMismatch.pointerId = 100;
    handle.dispatchEvent(puMismatch);
    expect(handle.classList.contains("active")).toBe(true);

    // pointerup with matched pointerId
    const puMatch = new CustomEvent("pointerup") as any;
    puMatch.pointerId = 99;
    handle.dispatchEvent(puMatch);
    expect(handle.classList.contains("active")).toBe(false);

    // 9. _persistHeight branches
    elDetails.db = null;
    await elDetails._persistHeight();
    elDetails.db = {};
    await elDetails._persistHeight(120);
    await elDetails._persistHeight();
    await elDetails._persistHeight(0);

    // 10. _loadProviderModels branches
    // !provider.modelsUrl
    const resNoUrl = await elDetails._loadProviderModels({ id: "p1" });
    expect(resNoUrl).toEqual([]);

    // with apiKeyHeader and apiKey
    mockOrchStore.orchestrator = {
      getApiKeyForSpecificProvider: jest.fn().mockResolvedValue("api-key-123"),
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "m1" }],
    }) as any;
    const resKey = await elDetails._loadProviderModels({
      id: "p2",
      modelsUrl: "https://example.com/models",
      apiKeyHeader: "Authorization",
      apiKeyHeaderFormat: "Bearer {key}",
    });
    expect(resKey).toEqual([{ id: "m1" }]);

    // fetch error !response.ok
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as any;
    await expect(
      elDetails._loadProviderModels({
        id: "p3",
        modelsUrl: "https://example.com/models",
      }),
    ).rejects.toThrow("HTTP 404");

    // data with custom array property
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ custom_items: [{ id: "m-custom" }] }),
    }) as any;
    const resCustom = await elDetails._loadProviderModels({
      id: "p4",
      modelsUrl: "https://example.com/models",
    });
    expect(resCustom).toEqual([{ id: "m-custom" }]);

    // data as single object with id
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "m-single", name: "Single Model" }),
    }) as any;
    const resSingle = await elDetails._loadProviderModels({
      id: "p5",
      modelsUrl: "https://example.com/models",
    });
    expect(resSingle).toEqual([{ id: "m-single", name: "Single Model" }]);

    // 11. _submitDetailsDialog branches
    elDetails._pendingRenameGroupId = "g1";
    elDetails._pendingRenameName = "Same Name";
    const detailsInput = elDetails.shadowRoot.querySelector(
      ".conversations__details-dialog .conversations__input",
    ) as HTMLInputElement;
    detailsInput.value = "Same Name"; // no change
    elDetails._pendingDetailsToolTags = null;
    await elDetails._submitDetailsDialog();
    expect(mockOrchStore.renameConversation).not.toHaveBeenCalled();

    // 12. _isSpawnSubagentEnabledInCurrentScope branches
    elDetails._pendingDetailsToolTags = ["spawn_subagent"];
    expect(elDetails._isSpawnSubagentEnabledInCurrentScope()).toBe(true);
    elDetails._pendingDetailsToolTags = ["bash"];
    expect(elDetails._isSpawnSubagentEnabledInCurrentScope()).toBe(false);
    elDetails._pendingDetailsToolTags = [];
    expect(typeof elDetails._isSpawnSubagentEnabledInCurrentScope()).toBe(
      "boolean",
    );
    elDetails._pendingDetailsToolTags = null;
    expect(typeof elDetails._isSpawnSubagentEnabledInCurrentScope()).toBe(
      "boolean",
    );

    // 13. _itemAtPoint branches
    elDetails.shadowRoot.elementFromPoint = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(document.createElement("div"))
      .mockReturnValueOnce(li1);
    expect(elDetails._itemAtPoint(0, 0)).toBeNull();
    expect(elDetails._itemAtPoint(0, 0)).toBeNull();
    expect(elDetails._itemAtPoint(0, 0)).toBe(li1);

    // 14. Focus navigation branches
    elDetails._focusNext(li1);
    elDetails._focusNext(li2);
    elDetails._focusNext(document.createElement("button"));
    elDetails._focusNextItem(li1);
    elDetails._focusNextItem(li2);
    elDetails._focusPrev(li2);
    elDetails._focusPrev(li1);
    elDetails._focusPrevItem(li2);
    elDetails._focusPrevItem(li1);

    // 15. Submit dialogs guards when pending variables are null
    elDetails._pendingRenameGroupId = null;
    await elDetails._submitDetailsDialog();
    elDetails._pendingRenameGroupId = "g1";
    elDetails._pendingRenameName = null;
    await elDetails._submitDetailsDialog();

    elDetails._pendingDeleteGroupId = null;
    await elDetails._submitDeleteDialog();

    elDetails._pendingCloneGroupId = null;
    await elDetails._submitCloneDialog();

    document.body.removeChild(elDetails);
  });
});
