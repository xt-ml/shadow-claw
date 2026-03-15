import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/getConfig.mjs", () => ({
  getConfig: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../orchestrator.mjs", () => ({
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

jest.unstable_mockModule("../effect.mjs", () => ({ effect: jest.fn() }));
jest.unstable_mockModule("../markdown.mjs", () => ({
  renderMarkdown: jest.fn((value) => String(value)),
}));

jest.unstable_mockModule("../storage/storage.mjs", () => ({
  getStorageRoot: jest.fn(),
  resetStorageDirectory: jest.fn(),
}));

jest.unstable_mockModule("../storage/requestPersistentStorage.mjs", () => ({
  requestPersistentStorage: jest.fn(),
}));

jest.unstable_mockModule("../storage/getStorageEstimate.mjs", () => ({
  getStorageEstimate: jest.fn().mockResolvedValue({ usage: 0, quota: 0 }),
}));

jest.unstable_mockModule("../storage/selectStorageDirectory.mjs", () => ({
  selectStorageDirectory: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule("../storage/isPersistent.mjs", () => ({
  isPersistent: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule("../stores/orchestrator.mjs", () => ({
  orchestratorStore: {
    init: jest.fn(),
    setDb: jest.fn(),
    db: {},
    loadFiles: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.unstable_mockModule("../stores/file-viewer.mjs", () => ({
  fileViewerStore: { openFile: jest.fn() },
}));

jest.unstable_mockModule("../stores/theme.mjs", () => ({
  Themes: { Light: "light", Dark: "dark", System: "system" },
  themeStore: {
    getTheme: jest.fn(() => ({ theme: "light", resolved: "light" })),
    setTheme: jest.fn(),
  },
}));

jest.unstable_mockModule("../toast.mjs", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

jest.unstable_mockModule("../vm.mjs", () => ({
  bootVM: jest.fn().mockResolvedValue(undefined),
  getVMStatus: jest.fn(() => ({
    ready: false,
    booting: true,
    bootAttempted: true,
    error: null,
  })),
  setVMBootModePreference: jest.fn(),
  shutdownVM: jest.fn().mockResolvedValue(undefined),
  subscribeVMStatus: jest.fn((listener) => {
    listener({ ready: false, booting: true, bootAttempted: true, error: null });
    return jest.fn();
  }),
}));

jest.unstable_mockModule("./shadow-claw-chat.mjs", () => {
  class MockChat extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = "<div data-terminal-slot></div>";
      this.dispatchEvent(
        new CustomEvent("shadow-claw-terminal-slot-ready", {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  customElements.define("shadow-claw-chat", MockChat);

  return {};
});

jest.unstable_mockModule("./shadow-claw-files.mjs", () => {
  class MockFiles extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = "<div data-terminal-slot></div>";
      this.dispatchEvent(
        new CustomEvent("shadow-claw-terminal-slot-ready", {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  customElements.define("shadow-claw-files", MockFiles);

  return {};
});
jest.unstable_mockModule("./shadow-claw-pdf-viewer.mjs", () => ({}));
jest.unstable_mockModule("./shadow-claw-terminal.mjs", () => {
  class MockTerminal extends HTMLElement {}

  customElements.define("shadow-claw-terminal", MockTerminal);

  return {};
});
jest.unstable_mockModule("./shadow-claw-tasks.mjs", () => {
  class MockTasks extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = "<div data-terminal-slot></div>";
      this.dispatchEvent(
        new CustomEvent("shadow-claw-terminal-slot-ready", {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  customElements.define("shadow-claw-tasks", MockTasks);

  return {};
});
jest.unstable_mockModule("./shadow-claw-toast.mjs", () => ({}));

const { ShadowClaw } = await import("./shadow-claw.mjs");
const { orchestratorStore } = await import("../stores/orchestrator.mjs");
const { fileViewerStore } = await import("../stores/file-viewer.mjs");

function createOrchestratorStub(extra = {}) {
  return {
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
    events: { on: jest.fn(), off: jest.fn() },
    ...extra,
  };
}

describe("shadow-claw", () => {
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

    try {
      await component.initialize(
        {},
        /** @type {any} */ (createOrchestratorStub()),
      );

      expect(orchestratorStore.init).toHaveBeenCalledWith(
        {},
        expect.any(Object),
      );
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
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

    /** @type {((payload: {path?: string, groupId?: string}) => Promise<void>)|null} */
    let openFileHandler = null;

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

    try {
      await component.initialize({}, /** @type {any} */ (mockOrchestrator));
      await openFileHandler?.({ path: "new_password.html", groupId: "g1" });

      expect(fileViewerStore.openFile).toHaveBeenCalledWith(
        {},
        "new_password.html",
        "g1",
      );
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
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

    try {
      await component.initialize(
        {},
        /** @type {any} */ (createOrchestratorStub()),
      );

      const chatSlot = component.shadowRoot
        ?.querySelector("shadow-claw-chat")
        ?.shadowRoot?.querySelector("[data-terminal-slot]");

      expect(chatSlot?.querySelector("shadow-claw-terminal")).not.toBeNull();

      component.showPage("files");

      const filesSlot = component.shadowRoot
        ?.querySelector("shadow-claw-files")
        ?.shadowRoot?.querySelector("[data-terminal-slot]");

      expect(filesSlot?.querySelector("shadow-claw-terminal")).not.toBeNull();
    } finally {
      globalThis.matchMedia = originalMatchMedia;
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
      HTMLElement.prototype.scrollTo = originalScrollTo;
    }
  });

  it("defaults WebVM boot mode selector to disabled", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

    const component = new ShadowClaw();

    try {
      await component.initialize(
        {},
        /** @type {any} */ (createOrchestratorStub()),
      );

      const select = component.shadowRoot?.querySelector(
        '[data-setting="vm-boot-mode-select"]',
      );
      const timeoutInput = component.shadowRoot?.querySelector(
        '[data-setting="vm-bash-timeout-input"]',
      );

      expect(select).toHaveProperty("value", "disabled");
      expect(timeoutInput).toHaveProperty("value", "900");
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
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

    /** @type {((status: import("../vm.mjs").VMStatus) => void)|null} */
    let vmStatusHandler = null;

    const mockOrchestrator = createOrchestratorStub({
      events: {
        on: jest.fn((event, handler) => {
          if (event === "vm-status") {
            vmStatusHandler = handler;
          }
        }),
        off: jest.fn(),
      },
    });

    const component = new ShadowClaw();

    try {
      await component.initialize({}, /** @type {any} */ (mockOrchestrator));

      component.toggleTerminalVisibility();

      expect(component.terminalVisible).toBe(true);

      vmStatusHandler?.({
        ready: false,
        booting: false,
        bootAttempted: true,
        error: "WebVM is disabled. Enable it in Settings to use WebVM.",
      });

      expect(component.terminalVisible).toBe(false);
      expect(component.terminalElement?.hidden).toBe(true);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });
});
