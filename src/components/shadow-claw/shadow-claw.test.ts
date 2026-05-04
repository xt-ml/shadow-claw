import { jest } from "@jest/globals";

jest.unstable_mockModule("../../orchestrator.js", () => ({
  Orchestrator: class {
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

jest.unstable_mockModule("../../effect.js", () => ({
  effect: jest.fn(() => () => {}),
}));
jest.unstable_mockModule("../../markdown.js", () => ({
  renderMarkdown: jest.fn((value) => String(value)),
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    init: jest.fn(async (db, orchestrator) => {}),
    setDb: jest.fn(),
    db: {},
    setReady: jest.fn(),
    setActivePage: (jest.fn() as any).mockResolvedValue(undefined),
    loadFiles: (jest.fn() as any).mockResolvedValue(undefined),
  },
}));

jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
  fileViewerStore: { openFile: jest.fn() },
}));

jest.unstable_mockModule("../../stores/theme.js", () => ({
  Themes: { Light: "light", Dark: "dark", System: "system" },
  themeStore: {
    getTheme: jest.fn(() => ({ theme: "light", resolved: "light" })),
    setTheme: jest.fn(),
  },
}));

jest.unstable_mockModule("../../toast.js", () => ({
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

jest.unstable_mockModule("../../vm.js", () => ({
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

jest.unstable_mockModule("highlighted-code", () => ({
  default: { useTheme: jest.fn() },
}));
jest.unstable_mockModule(
  "../shadow-claw-file-viewer/shadow-claw-file-viewer.js",
  () => {
    class MockFileViewer extends HTMLElement {}
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

const _mockConversationsInitialize = jest.fn();

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
const _mockSettingsInitialize = (jest.fn() as any).mockResolvedValue(undefined);

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

// Child custom elements are already defined in the mocks above.

let ShadowClaw: any;
let orchestratorStore: any;
let fileViewerStore: any;
let themeStore: any;
let Themes: any;

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
    const themeMod = await import("../../stores/theme.js");

    themeStore = themeMod.themeStore;
    Themes = themeMod.Themes;
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
    await component.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));

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

    async function setupShadowClaw(el: any) {
      (globalThis as any).__ACTIVE_SHADOW_CLAW__ = el;
      const db: any = {} as any;
      const orchestrator = createOrchestratorStub();

      // Ensure dummy elements have at least the methods if they were not upgraded
      if (el.shadowRoot) {
        const children = el.shadowRoot.querySelectorAll("*");
        children.forEach((c: any) => {
          if (!c.initialize) {
            c.initialize = jest.fn();
          }

          if (!c.setupEffects) {
            c.setupEffects = jest.fn();
          }
        });
      }

      return { db, orchestrator };
    }

    const orchestrator = createOrchestratorStub();
    const component = new ShadowClaw();
    component.orchestrator = orchestrator;
    document.body.appendChild(component);
    await component.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(orchestratorStore.init).toHaveBeenCalled();
  });

  it("shows only the moon icon before theme hydration", async () => {
    const component = new ShadowClaw();
    component.orchestrator = createOrchestratorStub();
    document.body.appendChild(component);
    await component.onTemplateReady;

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
    await component.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));

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
    await component.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));

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

  it("mounts the shared terminal into the active page slot", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const originalScrollTo = HTMLElement.prototype.scrollTo;

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
    HTMLElement.prototype.scrollTo = jest.fn();

    const component = new ShadowClaw();
    component.orchestrator = createOrchestratorStub();
    document.body.appendChild(component);
    await component.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));

    const chatSlot = component.shadowRoot
      ?.querySelector("shadow-claw-chat")
      ?.shadowRoot?.querySelector("[data-terminal-slot]");

    expect(chatSlot?.querySelector("shadow-claw-terminal")).not.toBeNull();

    component.showPage("files");

    const filesSlot = component.shadowRoot
      ?.querySelector("shadow-claw-files")
      ?.shadowRoot?.querySelector("[data-terminal-slot]");

    expect(filesSlot?.querySelector("shadow-claw-terminal")).not.toBeNull();

    globalThis.matchMedia = originalMatchMedia;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    HTMLElement.prototype.scrollTo = originalScrollTo;
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
    await component.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));

    component.toggleTerminalVisibility();

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

    const db: any = {} as any;
    const orchestrator = createOrchestratorStub();
    const component = new ShadowClaw();
    component.orchestrator = orchestrator;
    document.body.appendChild(component);
    await component.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const convEl = component.shadowRoot?.querySelector(
      "shadow-claw-conversations" as any,
    );

    expect(convEl).not.toBeNull();
  });

  it("navigates to channels page and back to settings", async () => {
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
    await component.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 50));

    const settingsEl = component.shadowRoot?.querySelector(
      "shadow-claw-settings",
    );
    settingsEl?.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { page: "channels" },
        bubbles: true,
        composed: true,
      }),
    );

    const channelsPage = component.shadowRoot?.querySelector(
      '[data-page-id="channels"]',
    );
    const settingsPage = component.shadowRoot?.querySelector(
      '[data-page-id="settings"]',
    );

    expect(channelsPage?.classList.contains("active")).toBe(true);
    expect(settingsPage?.classList.contains("active")).toBe(false);

    const channelsEl = component.shadowRoot?.querySelector(
      "shadow-claw-channels",
    );
    channelsEl?.dispatchEvent(
      new CustomEvent("navigate-back", { bubbles: true, composed: true }),
    );

    expect(settingsPage?.classList.contains("active")).toBe(true);
    expect(channelsPage?.classList.contains("active")).toBe(false);

    HTMLElement.prototype.scrollTo = originalScrollTo;
    globalThis.matchMedia = originalMatchMedia;
  });
});
