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
  orchestrator: {
    channelRegistry: {
      getBadge: (groupId: string) =>
        groupId.startsWith("tg:") ? "Telegram" : "Browser",
    },
  },
};

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: mockOrchStore,
}));

// Mock effect
jest.unstable_mockModule("../../effect.js", () => ({
  effect: jest.fn((fn: any) => {
    fn();

    return () => {};
  }),
}));

const { ShadowClawConversations } =
  await import("./shadow-claw-conversations.js");

describe("ShadowClawConversations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrchStore.groups = [{ groupId: "br:main", name: "Main", createdAt: 0 }];
    mockOrchStore.activeGroupId = "br:main";
    mockOrchStore.unreadGroupIds = new Set();
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;

    mockOrchStore.orchestrator = originalOrchestrator;
    await el.render();

    const badge = el.shadowRoot?.querySelector(".channel-badge");
    expect(badge?.textContent).toBe("Telegram");

    document.body.removeChild(el);
  });

  it("marks the active group with an active class", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
    await el.render();

    const active = el.shadowRoot?.querySelector(".conversation-item.active");
    expect(active).not.toBeNull();
    expect(active?.getAttribute("data-group-id")).toBe("br:main");

    document.body.removeChild(el);
  });

  it("has a create button", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
    await el.render();

    const btn = el.shadowRoot?.querySelector("[data-action='create']");
    expect(btn).not.toBeNull();

    document.body.removeChild(el);
  });

  it("hides delete button when only one conversation exists", async () => {
    mockOrchStore.groups = [{ groupId: "br:main", name: "Main", createdAt: 0 }];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
    await el.render();

    const handles = el.shadowRoot?.querySelectorAll(".drag-handle");
    expect(handles?.length).toBe(2);

    document.body.removeChild(el);
  });

  it("drag handle has grab cursor style", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
    await el.render();

    const style = el.shadowRoot?.querySelector("style");
    expect(style?.textContent).toContain("cursor: grab");

    document.body.removeChild(el);
  });

  it("drag handle has grabbing cursor on :active", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
    await el.render();

    const style = el.shadowRoot?.querySelector("style");
    expect(style?.textContent).toContain("cursor: grabbing");

    document.body.removeChild(el);
  });

  it("conversation items have role=listitem and tabindex for keyboard access", async () => {
    mockOrchStore.groups = [{ groupId: "br:main", name: "Main", createdAt: 0 }];
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
    await el.render();

    const list = el.shadowRoot?.querySelector(".conversation-list");
    expect(list?.getAttribute("role")).toBe("list");

    document.body.removeChild(el);
  });

  it("drag handle has touch-action: none for touch support", async () => {
    const el = new ShadowClawConversations() as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
      await el.onTemplateReady;
      await el.render();

      const handle = el.shadowRoot?.querySelector(".resize-handle");
      expect(handle).not.toBeNull();

      document.body.removeChild(el);
    });

    it("resize handle has row-resize cursor style", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.onTemplateReady;
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain("cursor: row-resize");

      document.body.removeChild(el);
    });

    it("resize handle renders a visible grab affordance", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.onTemplateReady;
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain(".resize-handle::before");
      expect(style?.textContent).toContain(".resize-handle::after");

      document.body.removeChild(el);
    });

    it("conversation list has scrollable styling", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.onTemplateReady;
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain("overflow-y: auto");

      document.body.removeChild(el);
    });

    it("host uses flex-direction column", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.onTemplateReady;
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain("flex-direction: column");

      document.body.removeChild(el);
    });

    it("conversation list has flex: 1 to fill available space", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
      await el.render();

      const item = el.shadowRoot?.querySelector("[data-group-id='br:main']");
      expect(item?.classList.contains("unread")).toBe(false);

      document.body.removeChild(el);
    });

    it("has pulse animation keyframes in styles", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.onTemplateReady;
      await el.render();

      const style = el.shadowRoot?.querySelector("style");
      expect(style?.textContent).toContain("@keyframes pulse-unread");

      document.body.removeChild(el);
    });

    it("unread class applies pulse animation", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
      await el.render();
      el.db = {} as any;

      const items = el.shadowRoot?.querySelectorAll(".conversation-item");
      const secondItem = items[1] as HTMLElement;

      // Press Enter
      secondItem.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(mockOrchStore.switchConversation).toHaveBeenCalledWith(
        expect.anything(),
        "br:second",
      );

      jest.clearAllMocks();

      // Press Space
      secondItem.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
      expect(mockOrchStore.switchConversation).toHaveBeenCalledWith(
        expect.anything(),
        "br:second",
      );

      document.body.removeChild(el);
    });

    it("moves focus between conversation items with ArrowDown and ArrowUp", async () => {
      mockOrchStore.groups = [
        { groupId: "br:main", name: "Main", createdAt: 0 },
        { groupId: "br:second", name: "Second", createdAt: 1 },
      ];
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
      await el.onTemplateReady;
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
