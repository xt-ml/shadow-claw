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
    expect(instructions?.textContent).toContain("Press Space to grab");
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

    const renameBtn = el.shadowRoot?.querySelector("[data-action='rename']");
    expect(renameBtn?.getAttribute("aria-label")).toBe("Rename Main");

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

    it("has a rename dialog element", async () => {
      const el = new ShadowClawConversations() as any;
      document.body.appendChild(el);
      await el.onTemplateReady;
      await el.render();

      const dialog = el.shadowRoot?.querySelector(
        ".conversations__rename-dialog",
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
