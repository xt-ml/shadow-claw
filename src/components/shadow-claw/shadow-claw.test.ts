import { jest } from "@jest/globals";

import { toggleTerminalVisibility } from "./utils/toggle-terminal-visibility.js";

jest.unstable_mockModule("../../core/orchestrator/orchestrator.js", () => ({
  Orchestrator: class {
    events = { on: jest.fn(), off: jest.fn(), emit: jest.fn() };

    async init() {
      return {};
    }

    on() {}
    getState() {
      return "idle";
    }

    isConfigured() {
      return true;
    }

    getAssistantName() {
      return "Shadow";
    }
  },
}));

(globalThis as any).__ACTIVE_SHADOW_CLAW__ = null;

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn(() => () => {}),
}));

const mockGetConfigByKey = new Map<string, unknown>();

jest.unstable_mockModule("../../db/get-config.js", () => ({
  getConfig: jest.fn(async (_db: unknown, key: string) => {
    if (mockGetConfigByKey.has(key)) {
      return mockGetConfigByKey.get(key);
    }

    return null;
  }),
}));

jest.unstable_mockModule("../../content/markdown.js", () => ({
  renderMarkdown: jest.fn((value) => String(value)),
}));

// Mutable activityLog so individual tests can override it.
const mockActivityLog: { entries: unknown[] } = { entries: [] };

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    init: jest.fn(async (_db, _orchestrator) => {}),
    setDb: jest.fn(),
    db: {},
    activePage: "pages",
    sidebarDefaultPage: "chat",
    pages: [],
    setReady: jest.fn(),
    setActivePage: (jest.fn() as any).mockResolvedValue(undefined),
    loadFiles: (jest.fn() as any).mockResolvedValue(undefined),
    get activityLog() {
      return mockActivityLog.entries;
    },
  },
}));

jest.unstable_mockModule("../../stores/file-viewer.js", () => {
  let fileVal: any = null;

  return {
    fileViewerStore: {
      openFile: jest.fn(),
      closeFile: jest.fn(() => {
        fileVal = null;
      }),
      get file() {
        return fileVal;
      },
      set file(val) {
        fileVal = val;
      },
    },
  };
});

jest.unstable_mockModule("../../stores/theme.js", () => ({
  Themes: { Light: "light", Dark: "dark", System: "system" },
  themeStore: {
    getTheme: jest.fn(() => ({ theme: "light", resolved: "light" })),
    setTheme: jest.fn(),
  },
}));

jest.unstable_mockModule("../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
}));

jest.unstable_mockModule("../../stores/tools.js", () => ({
  toolsStore: {
    load: (jest.fn() as any).mockResolvedValue(undefined),
    enabledTools: [],
    enabledToolNames: new Set(),
    customTools: [],
    allTools: [],
    systemPromptOverride: "",
  },
}));

jest.unstable_mockModule("../../shell/vm.js", () => ({
  bootVM: (jest.fn() as any).mockResolvedValue(undefined),
  getVMStatus: jest.fn(() => ({
    ready: false,
    booting: true,
    bootAttempted: true,
    error: null,
  })),
  setVMBootModePreference: jest.fn(),
  shutdownVM: (jest.fn() as any).mockResolvedValue(undefined),
  subscribeVMStatus: jest.fn((listener: any) => {
    listener({ ready: false, booting: true, bootAttempted: true, error: null });

    return jest.fn();
  }),
}));

jest.unstable_mockModule("../shadow-claw-chat/shadow-claw-chat.js", () => {
  class MockChat extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" });
      this.shadowRoot!.innerHTML = "<div data-terminal-slot></div>";
      this.dispatchEvent(
        new CustomEvent("shadow-claw-terminal-slot-ready", {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  if (!customElements.get("shadow-claw-chat")) {
    customElements.define("shadow-claw-chat", MockChat);
  }

  return {};
});

jest.unstable_mockModule("../shadow-claw-files/shadow-claw-files.js", () => {
  class MockFiles extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" });
      this.shadowRoot!.innerHTML = "<div data-terminal-slot></div>";
      this.dispatchEvent(
        new CustomEvent("shadow-claw-terminal-slot-ready", {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  if (!customElements.get("shadow-claw-files")) {
    customElements.define("shadow-claw-files", MockFiles);
  }

  return {};
});

jest.unstable_mockModule(
  "../shadow-claw-pdf-viewer/shadow-claw-pdf-viewer.js",
  () => ({}) as any,
);
jest.unstable_mockModule(
  "../shadow-claw-terminal/shadow-claw-terminal.js",
  () => {
    class MockTerminal extends HTMLElement {}

    if (!customElements.get("shadow-claw-terminal")) {
      customElements.define("shadow-claw-terminal", MockTerminal);
    }

    return {};
  },
);

jest.unstable_mockModule("../shadow-claw-tasks/shadow-claw-tasks.js", () => {
  class MockTasks extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" });
      this.shadowRoot!.innerHTML = "<div data-terminal-slot></div>";
      this.dispatchEvent(
        new CustomEvent("shadow-claw-terminal-slot-ready", {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  if (!customElements.get("shadow-claw-tasks")) {
    customElements.define("shadow-claw-tasks", MockTasks);
  }

  return {};
});

jest.unstable_mockModule(
  "../shadow-claw-file-viewer/shadow-claw-file-viewer.js",
  () => {
    class MockFileViewer extends HTMLElement {
      requestCloseViewer = jest.fn(() => Promise.resolve(true));
    }

    if (!customElements.get("shadow-claw-file-viewer")) {
      customElements.define("shadow-claw-file-viewer", MockFileViewer);
    }

    return {};
  },
);
jest.unstable_mockModule(
  "../shadow-claw-toast/shadow-claw-toast.js",
  () => ({}) as any,
);
jest.unstable_mockModule("../shadow-claw-tools/shadow-claw-tools.js", () => {
  class MockTools extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" });
    }
  }

  if (!customElements.get("shadow-claw-tools")) {
    customElements.define("shadow-claw-tools", MockTools);
  }

  return {};
});

jest.unstable_mockModule(
  "../shadow-claw-channels/shadow-claw-channels.js",
  () => {
    class MockChannels extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          this.attachShadow({ mode: "open" });
        }
      }
    }

    if (!customElements.get("shadow-claw-channels")) {
      customElements.define("shadow-claw-channels", MockChannels);
    }

    return { ShadowClawChannels: MockChannels };
  },
);

jest.unstable_mockModule(
  "../shadow-claw-conversations/shadow-claw-conversations.js",
  () => {
    class MockConversations extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          this.attachShadow({ mode: "open" });
        }
      }
    }

    if (!customElements.get("shadow-claw-conversations")) {
      customElements.define("shadow-claw-conversations", MockConversations);
    }

    return { ShadowClawConversations: MockConversations };
  },
);

// Shared spy so the test can assert calls.
//
// JSDOM does not upgrade custom elements that are created via innerHTML inside
// a <template> and then cloned into the shadow root of a *disconnected* host.
// The element remains a plain HTMLElement — its constructor, prototype methods,
// and connectedCallback are all skipped.
//
// To work around this we use the orchestratorStore.init mock (which runs after
// the template has been rendered but before the settings-init check) to patch
// the initialize spy directly onto the element at the right moment.

jest.unstable_mockModule(
  "../shadow-claw-settings/shadow-claw-settings.js",
  () => {
    class MockSettings extends HTMLElement {
      connectedCallback() {
        if (!this.shadowRoot) {
          this.attachShadow({ mode: "open" });
        }
      }
    }

    if (!customElements.get("shadow-claw-settings")) {
      customElements.define("shadow-claw-settings", MockSettings);
    }

    return { ShadowClawSettings: MockSettings };
  },
);

let ShadowClaw: any;
let orchestratorStore: any;
let fileViewerStore: any;

function createOrchestratorStub(extra = {}) {
  return {
    init: (jest.fn() as any).mockResolvedValue({} as any),
    isConfigured: () => true,
    getAssistantName: () => "Shadow",
    getAvailableProviders: () => [
      { id: "test", name: "Test", models: ["model-a"] },
    ],
    getProvider: () => "test",
    getModel: () => "model-a",
    getVMStatus: () => ({
      ready: false,
      booting: false,
      bootAttempted: false,
      error: null,
    }),
    channelRegistry: { find: jest.fn(), getBadge: jest.fn() },
    events: { on: jest.fn(), off: jest.fn() },
    ...extra,
  } as any;
}

describe("shadow-claw", () => {
  beforeAll(async () => {
    ShadowClaw = (await import("./shadow-claw.js")).ShadowClaw;

    orchestratorStore = (await import("../../stores/orchestrator.js"))
      .orchestratorStore;

    fileViewerStore = (await import("../../stores/file-viewer.js"))
      .fileViewerStore;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfigByKey.clear();
    mockActivityLog.entries = [];
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw")).toBe(ShadowClaw);
  });

  it("initializes orchestratorStore during initialize", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

    const component = new ShadowClaw();
    component.orchestrator = createOrchestratorStub();

    document.body.appendChild(component);

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(orchestratorStore.init).toHaveBeenCalledWith(
      expect.any(Object),
      component.orchestrator,
    );
  });

  it("initializes settings component during initialize", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

    const orchestrator = createOrchestratorStub();
    const component = new ShadowClaw();
    component.orchestrator = orchestrator;

    document.body.appendChild(component);

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(orchestratorStore.init).toHaveBeenCalled();
  });

  it("shows only the moon icon before theme hydration", async () => {
    const component = new ShadowClaw();
    component.orchestrator = createOrchestratorStub();

    document.body.appendChild(component);

    const sunIcon = component.shadowRoot?.querySelector(".sun-icon");
    const moonIcon = component.shadowRoot?.querySelector(".moon-icon");

    expect(sunIcon?.hasAttribute("hidden")).toBe(true);
    expect(moonIcon?.hasAttribute("hidden")).toBe(false);

    const style = component.shadowRoot?.querySelector("style");
    expect(style?.textContent).toContain(".theme-mode-toggle .sun-icon");
    expect(style?.textContent).toContain("display: none");
    expect(style?.textContent).toContain(".theme-mode-toggle .moon-icon");
    expect(style?.textContent).toContain("display: block");
  });

  it("opens files when orchestrator emits open-file", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

    let openFileHandler: any = null;

    const mockOrchestrator = createOrchestratorStub({
      events: {
        on: jest.fn((event, handler) => {
          if (event === "open-file") {
            openFileHandler = handler;
          }
        }),
      },
    });

    const component = new ShadowClaw();
    component.orchestrator = mockOrchestrator;
    document.body.appendChild(component);
    await new Promise((resolve) => setTimeout(resolve, 250));

    ((await openFileHandler) as any)?.({
      path: "new_password.html",
      groupId: "g1",
    });

    expect(fileViewerStore.openFile).toHaveBeenCalledWith(
      expect.any(Object),
      "new_password.html",
      "g1",
    );
  });

  it("retries open-file on NotFoundError then succeeds", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

    let openFileHandler: any = null;

    const mockOrchestrator = createOrchestratorStub({
      events: {
        on: jest.fn((event, handler) => {
          if (event === "open-file") {
            openFileHandler = handler;
          }
        }),
      },
    });

    const component = new ShadowClaw();
    component.orchestrator = mockOrchestrator;
    document.body.appendChild(component);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const notFoundErr = new DOMException(
      "A requested file or directory could not be found",
      "NotFoundError",
    );

    fileViewerStore.openFile.mockReset();
    fileViewerStore.openFile
      .mockRejectedValueOnce(notFoundErr)
      .mockResolvedValueOnce(undefined);

    await openFileHandler?.({ path: "calc.html", groupId: "g1" });

    expect(fileViewerStore.openFile).toHaveBeenCalledTimes(2);
  });

  it("force-hides open WebVM panel when VM becomes unavailable", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

    globalThis.requestAnimationFrame = (callback) => {
      callback(0);

      return 1;
    };

    globalThis.cancelAnimationFrame = () => {};

    /* @type ((status: import("../vm.ts").VMStatus) => void)|null */
    let vmStatusHandler = null;

    const mockOrchestrator = createOrchestratorStub({
      events: {
        on: jest.fn((event, handler) => {
          if (event === "vm-status") {
            vmStatusHandler = handler as any;
          }
        }),
        off: jest.fn(),
      },
    });

    const component = new ShadowClaw();
    component.orchestrator = mockOrchestrator;
    document.body.appendChild(component);
    await new Promise((resolve) => setTimeout(resolve, 250));

    toggleTerminalVisibility(component.shadowRoot, component);

    expect(component.terminalVisible).toBe(true);

    (vmStatusHandler as any)({
      ready: false,
      booting: false,
      bootAttempted: true,
      error: "WebVM is disabled. Enable it in Settings to use WebVM.",
    });

    expect(component.terminalVisible).toBe(false);
    expect(component.terminalElement?.hidden).toBe(true);

    globalThis.matchMedia = originalMatchMedia;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("renders conversations sidebar and initializes it", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

    const orchestrator = createOrchestratorStub();
    const component = new ShadowClaw();
    component.orchestrator = orchestrator;

    document.body.appendChild(component);

    await new Promise((resolve) => setTimeout(resolve, 250));
    await new Promise((resolve) => setTimeout(resolve, 250));

    const convEl = component.shadowRoot?.querySelector(
      "shadow-claw-conversations" as any,
    );

    expect(convEl).not.toBeNull();
  });

  it("hides Pages sidebar item and defaults to Chat when Pages is hidden", async () => {
    window.history.replaceState({}, "", "/");

    const originalMatchMedia = globalThis.matchMedia;
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
    HTMLElement.prototype.scrollTo = jest.fn();

    mockGetConfigByKey.set("sidebar_pages_hidden", "true");

    const component = new ShadowClaw();
    component.orchestrator = createOrchestratorStub();
    document.body.appendChild(component);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const pagesNavItem = component.shadowRoot?.querySelector(
      '.nav-item[data-page="pages"]',
    );
    const pagesPage = component.shadowRoot?.querySelector(
      '[data-page-id="pages"]',
    );
    const chatPage = component.shadowRoot?.querySelector(
      '[data-page-id="chat"]',
    );

    expect(pagesNavItem?.hasAttribute("hidden")).toBe(true);
    expect(pagesPage?.classList.contains("active")).toBe(false);
    expect(chatPage?.classList.contains("active")).toBe(true);

    HTMLElement.prototype.scrollTo = originalScrollTo;
    globalThis.matchMedia = originalMatchMedia;
  });

  it("keeps Pages active when active page is Pages and no pages exist", async () => {
    window.history.replaceState({}, "", "/");

    const originalMatchMedia = globalThis.matchMedia;
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
    HTMLElement.prototype.scrollTo = jest.fn();

    const component = new ShadowClaw();
    component.orchestrator = createOrchestratorStub();
    document.body.appendChild(component);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const pagesPage = component.shadowRoot?.querySelector(
      '[data-page-id="pages"]',
    );
    const chatPage = component.shadowRoot?.querySelector(
      '[data-page-id="chat"]',
    );
    const pagesNavItem = component.shadowRoot?.querySelector(
      '.nav-item[data-page="pages"]',
    );
    const chatNavItem = component.shadowRoot?.querySelector(
      '.nav-item[data-page="chat"]',
    );

    expect(pagesPage?.classList.contains("active")).toBe(true);
    expect(pagesNavItem?.classList.contains("active")).toBe(true);
    expect(chatPage?.classList.contains("active")).toBe(false);
    expect(chatNavItem?.classList.contains("active")).toBe(false);

    HTMLElement.prototype.scrollTo = originalScrollTo;
    globalThis.matchMedia = originalMatchMedia;
  });

  it("displays warning toast when memory storage fallback is active", async () => {
    const { getMemoryOpfsRoot, resetMemoryOpfsRoot } =
      await import("../../storage/memory-storage.js");
    const { showWarning } = await import("../../ui/toast.js");

    getMemoryOpfsRoot(); // Activate memory fallback

    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

    try {
      const component = new ShadowClaw();
      component.orchestrator = createOrchestratorStub();
      document.body.appendChild(component);
      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(showWarning).toHaveBeenCalledWith(
        expect.stringContaining("Private Browsing / Limited Storage"),
        7000,
      );
    } finally {
      resetMemoryOpfsRoot();
      globalThis.matchMedia = originalMatchMedia;
    }
  });

  it("handles disconnectedCallback cleanups", async () => {
    const component = new ShadowClaw();
    component.orchestrator = createOrchestratorStub();
    document.body.appendChild(component);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const vmStatusCleanup = jest.fn();
    const appLifecycleCleanup = jest.fn();
    const cancelAnimSpy = jest.spyOn(globalThis, "cancelAnimationFrame");

    component.vmStatusCleanup = vmStatusCleanup;
    component.appLifecycleCleanup = appLifecycleCleanup;
    component.terminalPlacementFrame = 42;
    component.popstateListener = jest.fn() as any;
    component.fallbackClickListenerAttached = true;
    component.navigationListenerAttached = true;

    component.disconnectedCallback();

    expect(vmStatusCleanup).toHaveBeenCalled();
    expect(appLifecycleCleanup).toHaveBeenCalled();
    expect(cancelAnimSpy).toHaveBeenCalledWith(42);
    expect(component.vmStatusCleanup).toBeNull();
    expect(component.appLifecycleCleanup).toBeNull();
    expect(component.terminalPlacementFrame).toBeNull();
    expect(component.popstateListener).toBeNull();
    expect(component.fallbackClickListenerAttached).toBe(false);
    expect(component.navigationListenerAttached).toBe(false);

    document.body.removeChild(component);
  });

  it("handles navigation handlers, shadowClawNav, and requestDialog", async () => {
    const component = new ShadowClaw();
    component.orchestrator = createOrchestratorStub();
    document.body.appendChild(component);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // fallbackClickListener with no targetPath
    const mockClickEvent = new MouseEvent("click");
    component.fallbackClickListener(mockClickEvent);

    // handleNavigationApiNavigate
    component.handleNavigationApiNavigate(new Event("navigate"));

    // shadowClawNav
    component.shadowClawNav(
      new CustomEvent("shadow-claw-navigate", { detail: { page: "pages" } }),
    );

    // requestDialog
    const promise = component.requestDialog({
      title: "Test Dialog",
      message: "Please confirm",
    });
    const appDialog = component.shadowRoot?.querySelector(
      ".app-dialog",
    ) as HTMLDialogElement;
    if (appDialog) {
      appDialog.returnValue = "confirm";
      appDialog.dispatchEvent(new Event("close"));
    }
    const dialogResult = await promise;
    expect(dialogResult).toBe(true);

    document.body.removeChild(component);
  });

  it("handles orchestrator vm-status error and tools events", async () => {
    const stub = createOrchestratorStub();
    const component = new ShadowClaw();
    component.orchestrator = stub;
    document.body.appendChild(component);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Emit vm-status with error when terminalVisible is true
    component.terminalVisible = true;
    const vmStatusCallbacks = stub.events.on.mock.calls.filter(
      ([event]) => event === "vm-status",
    );
    for (const [, cb] of vmStatusCallbacks) {
      cb({ ready: false, booting: false, error: "VM Crash", mode: "disabled" });
    }
    expect(component.terminalVisible).toBe(false);

    // Emit provider-help
    const providerHelpCallbacks = stub.events.on.mock.calls.filter(
      ([event]) => event === "provider-help",
    );
    for (const [, cb] of providerHelpCallbacks) {
      cb({ providerId: "test-prov", reason: "quota", helpType: "rate_limit" });
    }

    // Emit room-invite
    const roomInviteCallbacks = stub.events.on.mock.calls.filter(
      ([event]) => event === "room-invite",
    );
    for (const [, cb] of roomInviteCallbacks) {
      cb({ roomId: "r1", hostPeerId: "p1" });
    }

    // Emit ask-user
    const askUserCallbacks = stub.events.on.mock.calls.filter(
      ([event]) => event === "ask-user",
    );
    for (const [, cb] of askUserCallbacks) {
      cb({ id: "q1", groupId: "g1", question: "Continue?" });
    }

    document.body.removeChild(component);
  });

  it("handles branch coverage for initialization, navigation api, and cleanup", async () => {
    // 1. Initialization when orchestrator is not preset and hadPersistedActivePage is true
    (orchestratorStore as any).hadPersistedActivePage = true;
    (orchestratorStore as any).activePage = "chat";
    const comp1 = new ShadowClaw();
    comp1.chatSidebarHidden = false;
    document.body.appendChild(comp1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(comp1.orchestrator).toBeDefined();

    // 2. Disconnect with navigationListenerAttached and mock navigation
    const mockRemoveNav = jest.fn();
    Object.defineProperty(window, "navigation", {
      configurable: true,
      writable: true,
      value: { removeEventListener: mockRemoveNav },
    });
    comp1.navigationListenerAttached = true;
    document.body.removeChild(comp1);
    expect(mockRemoveNav).toHaveBeenCalledWith(
      "navigate",
      comp1.handleNavigationApiNavigate,
    );
    delete (window as any).navigation;

    // 3. handleNavigationApiNavigate branches
    const comp2 = new ShadowClaw();
    comp2.db = {} as any;
    // without event match
    comp2.handleNavigationApiNavigate(new Event("navigate"));

    // with intercept function
    const mockIntercept = jest.fn();
    const navEvent = {
      intercept: mockIntercept,
      destination: { url: "http://localhost/chat" },
    } as any;
    comp2.handleNavigationApiNavigate(navEvent);
    if (mockIntercept.mock.calls.length > 0) {
      const handlerObj = mockIntercept.mock.calls[0][0] as any;
      if (typeof handlerObj?.handler === "function") {
        await handlerObj.handler();
      }
    }

    // 4. shadowClawNav guard when db or shadowRoot is null
    comp2.db = null;
    comp2.shadowClawNav(new Event("shadow-claw-navigate"));

    // 5. fallbackClickListener without valid target path
    comp2.fallbackClickListener(new MouseEvent("click"));

    // 6. hadPersistedActivePage hidden branches
    (orchestratorStore as any).hadPersistedActivePage = false;
    const comp3 = new ShadowClaw();
    comp3.tasksSidebarHidden = true;
    comp3.filesSidebarHidden = true;
    (orchestratorStore as any).activePage = "tasks";
  });
});
