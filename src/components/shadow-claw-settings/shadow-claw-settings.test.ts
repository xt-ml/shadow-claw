import { jest } from "@jest/globals";

jest.unstable_mockModule(
  "../settings/shadow-claw-accounts/shadow-claw-accounts.js",
  () => {
    class MockAccounts extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-accounts", MockAccounts);

    return { ShadowClawAccounts: MockAccounts };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-llm/shadow-claw-llm.js",
  () => {
    class MockLlm extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-llm", MockLlm);

    return { ShadowClawLlm: MockLlm };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-git/shadow-claw-git.js",
  () => {
    class MockGit extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-git", MockGit);

    return { ShadowClawGit: MockGit };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-integrations/shadow-claw-integrations.js",
  () => {
    class MockIntegrations extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-integrations", MockIntegrations);

    return { ShadowClawIntegrations: MockIntegrations };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-storage/shadow-claw-storage.js",
  () => {
    class MockStorage extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-storage", MockStorage);

    return { ShadowClawStorage: MockStorage };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-webvm/shadow-claw-webvm.js",
  () => {
    class MockWebvm extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-webvm", MockWebvm);

    return { ShadowClawWebvm: MockWebvm };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-networking/shadow-claw-networking.js",
  () => {
    class MockNetworking extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-networking", MockNetworking);

    return { ShadowClawNetworking: MockNetworking };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-mcp-remote/shadow-claw-mcp-remote.js",
  () => {
    class MockMcpRemote extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-mcp-remote", MockMcpRemote);

    return { ShadowClawMcpRemote: MockMcpRemote };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-control-plane/shadow-claw-control-plane.js",
  () => {
    class MockControlPlane extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-control-plane", MockControlPlane);

    return { ShadowClawControlPlane: MockControlPlane };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-notifications/shadow-claw-notifications.js",
  () => {
    class MockNotifications extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-notifications", MockNotifications);

    return { ShadowClawNotifications: MockNotifications };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-task-server/shadow-claw-task-server.js",
  () => {
    class MockTaskServer extends HTMLElement {
      render = jest.fn();
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }
    }

    customElements.define("shadow-claw-task-server", MockTaskServer);

    return { ShadowClawTaskServer: MockTaskServer };
  },
);

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

(globalThis as any)._mockOverrideSkeleton = "true";
jest.unstable_mockModule("../../db/get-config.js", () => ({
  getConfig: jest.fn<any>().mockImplementation((_db: unknown, key: string) => {
    if (key === "assistant_name") {
      return Promise.resolve("ShadowClaw");
    }
    if (key === "allowed_iframe_host_patterns") {
      return Promise.resolve(undefined);
    }
    if (key === "override_prerender_skeleton") {
      return Promise.resolve((globalThis as any)._mockOverrideSkeleton);
    }

    return Promise.resolve("true");
  }),
}));

(globalThis as any)._mockSetConfig = jest
  .fn<any>()
  .mockResolvedValue(undefined);
jest.unstable_mockModule("../../db/set-config.js", () => ({
  setConfig: (...args: any[]) => (globalThis as any)._mockSetConfig(...args),
}));

(globalThis as any)._mockCreateSettingsBackupBlob = jest
  .fn<any>()
  .mockResolvedValue(new Blob(["{}"], { type: "application/json" }));
(globalThis as any)._mockWriteSettingsBackupToFileHandle = jest
  .fn<any>()
  .mockResolvedValue(undefined);
(globalThis as any)._mockParseSettingsBackupPayload = jest.fn<any>();
(globalThis as any)._mockReapplyPlaintextPasswords = jest.fn<any>();
jest.unstable_mockModule("../../config/settings-backup.js", () => ({
  createSettingsBackupBlob: (...args: any[]) =>
    (globalThis as any)._mockCreateSettingsBackupBlob(...args),
  writeSettingsBackupToFileHandle: (...args: any[]) =>
    (globalThis as any)._mockWriteSettingsBackupToFileHandle(...args),
  parseSettingsBackupPayload: (...args: any[]) =>
    (globalThis as any)._mockParseSettingsBackupPayload(...args),
  reapplyPlaintextPasswords: (...args: any[]) =>
    (globalThis as any)._mockReapplyPlaintextPasswords(...args),
}));

const mockSetAssistantName = jest.fn();
jest.unstable_mockModule(
  "../../core/orchestrator/utils/operations/provider.js",
  () => ({
    setAssistantName: mockSetAssistantName,
    getApiKeyForHeaders: jest.fn(),
    getApiKeyForRequest: jest.fn(),
    getLlamafileSettings: jest.fn(),
    getMeshLlmSettings: jest.fn(),
    getBedrockSettings: jest.fn(),
    getAvailableProviders: jest.fn(),
    getReasoningConfig: jest.fn(),
    getProviderRuntimeHeaders: jest.fn(),
    applyLlamafileHeaders: jest.fn(),
    applyMeshLlmHeaders: jest.fn(),
    getTransformersStatusUrl: jest.fn(),
    setBedrockSettings: jest.fn(),
    setLlamafileSettings: jest.fn(),
    setMeshLlmSettings: jest.fn(),
    setModel: jest.fn(),
    setPeerjsMyAlias: jest.fn(),
    setPeerjsPeerAliases: jest.fn(),
    autoActivateProfile: jest.fn(),
    stopTransformersProgressPolling: jest.fn(),
    setProvider: jest.fn(),
  }),
);

const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { ShadowClawSettings } = await import("./shadow-claw-settings.js");

describe("shadow-claw-settings", () => {
  describe("override pre-rendered content setting on load", () => {
    const META = "shadow-claw-override-prerender-skeleton";
    const KEY = "shadow-claw-override-prerender-skeleton";

    const load = async () => {
      const el = new ShadowClawSettings();
      (el as any).db = {} as any;
      document.body.appendChild(el);
      await el.render();
      const toggle = el.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-setting="override-prerender-skeleton-toggle"]',
      );
      document.body.removeChild(el);

      return toggle;
    };

    const setMeta = (content: string) => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", META);
      meta.setAttribute("content", content);
      document.head.appendChild(meta);
    };

    beforeEach(() => {
      localStorage.clear();
      (globalThis as any)._mockOverrideSkeleton = undefined;
    });

    afterEach(() => {
      document.head
        .querySelectorAll(`meta[name="${META}"]`)
        .forEach((m) => m.remove());
      (globalThis as any)._mockOverrideSkeleton = "true";
      localStorage.clear();
    });

    it("shows unchecked and syncs localStorage when the stored value is false", async () => {
      (globalThis as any)._mockOverrideSkeleton = "false";
      setMeta("true");

      const toggle = await load();

      expect(toggle?.checked).toBe(false);
      expect(localStorage.getItem(KEY)).toBe("false");
    });

    it("follows a site-config default of false when nothing is stored", async () => {
      setMeta("false");

      const toggle = await load();

      expect(toggle?.checked).toBe(false);
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it("follows a site-config default of true without persisting it", async () => {
      setMeta("true");

      const toggle = await load();

      expect(toggle?.checked).toBe(true);
      expect(localStorage.getItem(KEY)).toBeNull();
    });
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-settings")).toBe(ShadowClawSettings);
  });

  it("renders all sub-components", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const accounts = el.shadowRoot?.querySelector("shadow-claw-accounts");
    const integrations = el.shadowRoot?.querySelector(
      "shadow-claw-integrations",
    );

    const remoteMcp = el.shadowRoot?.querySelector("shadow-claw-mcp-remote");
    const llm = el.shadowRoot?.querySelector("shadow-claw-llm");
    const networking = el.shadowRoot?.querySelector("shadow-claw-networking");
    const webvm = el.shadowRoot?.querySelector("shadow-claw-webvm");
    const git = el.shadowRoot?.querySelector("shadow-claw-git");
    const storage = el.shadowRoot?.querySelector("shadow-claw-storage");

    expect(accounts).not.toBeNull();
    expect(integrations).not.toBeNull();
    expect(remoteMcp).not.toBeNull();
    expect(llm).not.toBeNull();
    expect(networking).not.toBeNull();
    expect(webvm).not.toBeNull();
    expect(git).not.toBeNull();
    expect(storage).not.toBeNull();

    document.body.removeChild(el);
  });

  it("renders backup, restore, and clear actions in header", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const backupBtn = el.shadowRoot?.querySelector(
      '[data-action="backup-settings"]',
    );

    const restoreBtn = el.shadowRoot?.querySelector(
      '[data-action="restore-settings"]',
    );

    const clearBtn = el.shadowRoot?.querySelector(
      '[data-action="clear-settings"]',
    );

    expect(backupBtn).not.toBeNull();
    expect(restoreBtn).not.toBeNull();
    expect(clearBtn).not.toBeNull();

    document.body.removeChild(el);
  });

  it("renders backup dialog plaintext password toggle unchecked by default", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const includePlaintext = el.shadowRoot?.querySelector(
      '[data-setting="include-plaintext-passwords"]',
    );

    expect(includePlaintext instanceof HTMLInputElement).toBe(true);
    expect((includePlaintext as HTMLInputElement).checked).toBe(false);

    document.body.removeChild(el);
  });

  it("uses a native save picker for plaintext settings backup", async () => {
    const showSaveFilePicker = jest.fn<any>().mockResolvedValue({
      name: "shadowclaw-settings-backup.json",
    });
    (globalThis as any).showSaveFilePicker = showSaveFilePicker;
    (globalThis as any)._mockWriteSettingsBackupToFileHandle.mockClear();

    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));

    (el as any).db = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            const request: any = {
              result: [{ key: "assistant_name", value: "ShadowClaw" }],
            };

            setTimeout(() => {
              request.onsuccess?.();
            }, 0);

            return request;
          },
        }),
      }),
    };

    const includePlaintext = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="include-plaintext-passwords"]',
    );
    const confirmBtn = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="confirm-backup-settings"]',
    );

    if (includePlaintext) {
      includePlaintext.checked = true;
    }

    confirmBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(showSaveFilePicker).toHaveBeenCalledTimes(1);
    expect(
      (globalThis as any)._mockWriteSettingsBackupToFileHandle,
    ).toHaveBeenCalledWith(
      { name: "shadowclaw-settings-backup.json" },
      expect.any(Array),
      true,
    );

    delete (globalThis as any).showSaveFilePicker;
    document.body.removeChild(el);
  });

  it("shows AI tab by default", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const aiTab = el.shadowRoot?.querySelector('[data-tab-target="ai"]');
    const aiPanel = el.shadowRoot?.querySelector('[data-tab-panel="ai"]');
    const envPanel = el.shadowRoot?.querySelector(
      '[data-tab-panel="environment"]',
    );

    expect(aiTab?.getAttribute("aria-selected")).toBe("true");
    expect(aiPanel?.hasAttribute("hidden")).toBe(false);
    expect(envPanel?.hasAttribute("hidden")).toBe(true);

    document.body.removeChild(el);
  });

  it("switches visible panel when a tab is selected", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const envTab = el.shadowRoot?.querySelector(
      '[data-tab-target="environment"]',
    );

    const aiPanel = el.shadowRoot?.querySelector('[data-tab-panel="ai"]');
    const envPanel = el.shadowRoot?.querySelector(
      '[data-tab-panel="environment"]',
    );

    envTab?.dispatchEvent(new Event("click"));

    expect(envTab?.getAttribute("aria-selected")).toBe("true");
    expect(aiPanel?.hasAttribute("hidden")).toBe(true);
    expect(envPanel?.hasAttribute("hidden")).toBe(false);

    document.body.removeChild(el);
  });

  it("renders networking at top of environment panel", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const envPanel = el.shadowRoot?.querySelector(
      '[data-tab-panel="environment"]',
    );

    const envSections = envPanel?.querySelectorAll(
      "details.settings-collapsible",
    );
    expect(envSections?.length).toBeGreaterThan(0);

    const firstSummary =
      envSections?.[0]?.querySelector("summary")?.textContent;
    expect(firstSummary).toContain("Networking");

    document.body.removeChild(el);
  });

  it("renders all tab panels with collapsible sections collapsed by default", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const aiPanel = el.shadowRoot?.querySelector('[data-tab-panel="ai"]');
    const envPanel = el.shadowRoot?.querySelector(
      '[data-tab-panel="environment"]',
    );

    const integrationsPanel = el.shadowRoot?.querySelector(
      '[data-tab-panel="integrations"]',
    );

    for (const panel of [aiPanel, envPanel, integrationsPanel]) {
      const sections = panel?.querySelectorAll("details.settings-collapsible");
      expect(sections?.length).toBeGreaterThan(0);

      sections?.forEach((section) => {
        const details = section as HTMLDetailsElement;
        expect(details.open).toBe(false);
      });
    }

    document.body.removeChild(el);
  });

  it("switches tabs with arrow keys", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const aiTab = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-tab-target="ai"]',
    );

    const envTab = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-tab-target="environment"]',
    );

    const envPanel = el.shadowRoot?.querySelector(
      '[data-tab-panel="environment"]',
    );

    aiTab?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );

    expect(envTab?.getAttribute("aria-selected")).toBe("true");
    expect(el.shadowRoot?.activeElement).toBe(envTab);
    expect(envPanel?.hasAttribute("hidden")).toBe(false);

    document.body.removeChild(el);
  });

  it("dispatches navigate event for tools config", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    let navigatedPage = null;
    el.addEventListener("navigate", (e) => {
      navigatedPage = (e as CustomEvent).detail.page;
    });

    const toolsBtn = el.shadowRoot?.querySelector(
      '[data-action="show-tools-config"]',
    );
    toolsBtn?.dispatchEvent(new Event("click"));

    expect(navigatedPage).toBe("tools");

    document.body.removeChild(el);
  });

  it("dispatches navigate event for channels config", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    let navigatedPage = null;
    el.addEventListener("navigate", (e) => {
      navigatedPage = (e as CustomEvent).detail.page;
    });

    const channelsBtn = el.shadowRoot?.querySelector(
      '[data-action="show-channels-config"]',
    );
    channelsBtn?.dispatchEvent(new Event("click"));

    expect(navigatedPage).toBe("channels");

    document.body.removeChild(el);
  });

  it("displays deployed revision from meta tag", async () => {
    const meta = document.createElement("meta");
    meta.name = "revision";
    meta.content = "abc123";
    document.head.appendChild(meta);

    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const revisionEl = el.shadowRoot?.querySelector(
      '[data-info="deployed-revision"]',
    );
    expect(revisionEl?.textContent).toContain("abc123");

    document.body.removeChild(el);
    document.head.removeChild(meta);
  });

  it("populates and saves assistant name", async () => {
    const orchestrator = {
      getAssistantName: jest.fn().mockReturnValue("ShadowClaw"),
    };
    mockSetAssistantName.mockClear();
    (orchestratorStore as any).orchestrator = orchestrator;
    const el = new ShadowClawSettings();
    (el as any).orchestrator = orchestrator;
    (el as any).db = {} as any;
    document.body.appendChild(el);
    await el.render();

    const nameInput = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="assistant-name-input"]',
    );
    expect(nameInput?.value).toBe("ShadowClaw");

    if (nameInput) {
      nameInput.value = "new-name";
    }

    await new Promise((r) => setTimeout(r, 0));
    const saveBtn = el.shadowRoot?.querySelector(
      '[data-action="save-assistant-name"]',
    );
    saveBtn?.dispatchEvent(new Event("click"));

    expect(mockSetAssistantName).toHaveBeenCalledWith(
      orchestrator,
      expect.anything(),
      "new-name",
    );
    document.body.removeChild(el);
  });

  it("populates and toggles activity log disk logging", async () => {
    await import("../../db/set-config.js");
    const orchestrator = {
      getAssistantName: jest.fn(),
    };
    const el = new ShadowClawSettings();
    (el as any).orchestrator = orchestrator;
    (el as any).db = {} as any;
    document.body.appendChild(el);
    (orchestratorStore as any).orchestrator = orchestrator;
    await el.render();

    const toggle = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="activity-log-disk-logging-toggle"]',
    );
    expect(toggle).not.toBeNull();

    await new Promise((r) => setTimeout(r, 0));
    if (toggle) {
      toggle.checked = true;
      toggle.dispatchEvent(new Event("change"));
    }

    await new Promise((r) => setTimeout(r, 100));

    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "activity_log_disk_logging_enabled",
      "true",
    );
    document.body.removeChild(el);
  });

  it("populates and toggles sidebar pages visibility", async () => {
    (globalThis as any)._mockSetConfig.mockClear();

    const el = new ShadowClawSettings();
    (el as any).db = {} as any;
    document.body.appendChild(el);
    await el.render();

    const toggle = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="sidebar-hide-pages-toggle"]',
    );
    expect(toggle).not.toBeNull();
    expect(toggle?.checked).toBe(true);

    const visibilityEvents: Array<{ hidden: boolean }> = [];
    el.addEventListener("sidebar-pages-visibility-change", (event) => {
      visibilityEvents.push((event as CustomEvent).detail);
    });

    if (toggle) {
      toggle.checked = false;
      toggle.dispatchEvent(new Event("change"));
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "sidebar_pages_hidden",
      "false",
    );
    expect(visibilityEvents.length).toBeGreaterThanOrEqual(1);
    expect(visibilityEvents.every((entry) => entry.hidden === false)).toBe(
      true,
    );

    document.body.removeChild(el);
  });

  it("saves assistant name via config when orchestrator is unavailable", async () => {
    (orchestratorStore as any).orchestrator = null;
    (globalThis as any)._mockSetConfig.mockClear();

    const el = new ShadowClawSettings();
    (el as any).orchestrator = null;
    (el as any).db = {} as any;
    document.body.appendChild(el);
    await el.render();

    const nameInput = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="assistant-name-input"]',
    );
    if (nameInput) {
      nameInput.value = "fallback-name";
    }

    const saveBtn = el.shadowRoot?.querySelector(
      '[data-action="save-assistant-name"]',
    );
    saveBtn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 0));

    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "assistant_name",
      "fallback-name",
    );

    document.body.removeChild(el);
  });

  it("populates and toggles override pre-rendered content setting", async () => {
    (globalThis as any)._mockSetConfig.mockClear();

    const el = new ShadowClawSettings();
    (el as any).db = {} as any;
    document.body.appendChild(el);
    await el.render();

    const toggle = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="override-prerender-skeleton-toggle"]',
    );
    expect(toggle).not.toBeNull();

    if (toggle) {
      toggle.checked = true;
      toggle.dispatchEvent(new Event("change"));
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      localStorage.getItem("shadow-claw-override-prerender-skeleton"),
    ).toBe("true");
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "override_prerender_skeleton",
      "true",
    );

    document.body.removeChild(el);
  });

  it("populates and saves DOM allowed iframe host patterns setting", async () => {
    (globalThis as any)._mockSetConfig.mockClear();

    const el = new ShadowClawSettings();
    (el as any).db = {} as any;
    document.body.appendChild(el);
    await el.render();

    const textarea = el.shadowRoot?.querySelector<HTMLTextAreaElement>(
      '[data-setting="dom-allowed-iframe-hosts"]',
    );
    const pagesToggle = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="markdown-frontmatter-pages-toggle"]',
    );
    const fileViewerToggle = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="markdown-frontmatter-file-viewer-toggle"]',
    );
    const chatToggle = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="markdown-frontmatter-chat-toggle"]',
    );
    const tasksToggle = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="markdown-frontmatter-tasks-toggle"]',
    );
    const saveBtn = el.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-action="save-dom-allowed-iframe-hosts"]',
    );

    expect(textarea).not.toBeNull();
    expect(pagesToggle).not.toBeNull();
    expect(fileViewerToggle).not.toBeNull();
    expect(chatToggle).not.toBeNull();
    expect(tasksToggle).not.toBeNull();
    expect(saveBtn).not.toBeNull();
    expect(textarea?.value).toContain("youtube.com");
    expect(textarea?.value).toContain("xt-ml.github.io");
    expect(textarea?.value).toContain("kherrick.github.io");
    expect(pagesToggle?.checked).toBe(true);
    expect(fileViewerToggle?.checked).toBe(true);
    expect(chatToggle?.checked).toBe(true);
    expect(tasksToggle?.checked).toBe(true);

    if (textarea) {
      textarea.value =
        "youtube.com\nvimeo.com\nxt-ml.github.io\nkherrick.github.io";
    }

    if (pagesToggle) {
      pagesToggle.checked = false;
    }
    if (fileViewerToggle) {
      fileViewerToggle.checked = true;
    }
    if (chatToggle) {
      chatToggle.checked = false;
    }
    if (tasksToggle) {
      tasksToggle.checked = true;
    }

    saveBtn?.dispatchEvent(new Event("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "allowed_iframe_host_patterns",
      "youtube.com\nvimeo.com\nxt-ml.github.io\nkherrick.github.io",
    );
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "markdown_frontmatter_pages",
      "false",
    );
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "markdown_frontmatter_file_viewer",
      "true",
    );
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "markdown_frontmatter_chat",
      "false",
    );
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "markdown_frontmatter_tasks",
      "true",
    );

    document.body.removeChild(el);
  });

  it("handles onChatSplitViewToggle and dispatches event", async () => {
    const el = new ShadowClawSettings() as any;
    el.db = {};
    const events: any[] = [];
    el.addEventListener("chat-split-view-change", (e: any) =>
      events.push(e.detail),
    );

    await el.onChatSplitViewToggle(true);

    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "chat_split_view_enabled",
      "true",
    );
    expect(events).toEqual([{ enabled: true }]);
  });

  it("handles onPagesAutoRefreshInputChange and dispatches event", async () => {
    const el = new ShadowClawSettings() as any;
    el.db = {};
    const events: any[] = [];
    const listener = (e: any) => events.push(e.detail);
    window.addEventListener("shadow-claw-pages-auto-refresh-change", listener);

    try {
      await el.onPagesAutoRefreshInputChange(30);

      expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
        expect.anything(),
        "pages_auto_refresh_interval",
        "30",
      );
      expect(events).toEqual([{ interval: 30 }]);
    } finally {
      window.removeEventListener(
        "shadow-claw-pages-auto-refresh-change",
        listener,
      );
    }
  });

  it("handles sidebar navigation visibility toggles", async () => {
    const el = new ShadowClawSettings() as any;
    el.db = {};

    await el.onSidebarHideChatToggle(true);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "sidebar_chat_hidden",
      "true",
    );

    await el.onSidebarHideFilesToggle(true);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "sidebar_files_hidden",
      "true",
    );

    await el.onSidebarHideTasksToggle(true);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "sidebar_tasks_hidden",
      "true",
    );
  });

  it("handles replaceConfigEntries with transaction", async () => {
    const el = new ShadowClawSettings() as any;
    const mockStore = {
      clear: jest.fn(),
      put: jest.fn(),
    };
    const mockTx = {
      objectStore: jest.fn(() => mockStore),
      oncomplete: null as any,
      onerror: null as any,
    };
    el.db = {
      transaction: jest.fn(() => {
        setTimeout(() => mockTx.oncomplete?.(), 0);
        return mockTx;
      }),
    };

    await el.replaceConfigEntries([
      { key: "k1", value: "v1" },
      { key: "k2", value: "v2" },
    ]);

    expect(mockStore.clear).toHaveBeenCalled();
    expect(mockStore.put).toHaveBeenCalledWith({ key: "k1", value: "v1" });
    expect(mockStore.put).toHaveBeenCalledWith({ key: "k2", value: "v2" });
  });

  it("returns null when promptForPlaintextBackupHandle encounters AbortError", async () => {
    const el = new ShadowClawSettings() as any;
    const abortErr = new Error("User canceled");
    abortErr.name = "AbortError";

    (globalThis as any).showSaveFilePicker = (
      jest.fn() as any
    ).mockRejectedValue(abortErr);

    const handle = await el.promptForPlaintextBackupHandle();
    expect(handle).toBeNull();

    delete (globalThis as any).showSaveFilePicker;
  });

  it("handles activity log, chat split view, prerender skeleton, and pages auto refresh settings", async () => {
    const el = new ShadowClawSettings() as any;
    el.db = {} as any;

    await el.onActivityLogDiskLoggingToggle(true);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "activity_log_disk_logging_enabled",
      "true",
    );

    const splitEventSpy = jest.fn();
    el.addEventListener("chat-split-view-change", splitEventSpy);
    await el.onChatSplitViewToggle(true);
    expect(splitEventSpy).toHaveBeenCalled();
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "chat_split_view_enabled",
      "true",
    );

    await el.onOverridePrerenderSkeletonToggle(true);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "override_prerender_skeleton",
      "true",
    );

    await el.onPagesAutoRefreshInputChange(30);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "pages_auto_refresh_interval",
      "30",
    );

    // Sidebar visibility toggles
    await el.onSidebarHideChatToggle(true);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "sidebar_chat_hidden",
      "true",
    );

    await el.onSidebarHideFilesToggle(true);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "sidebar_files_hidden",
      "true",
    );

    await el.onSidebarHidePagesToggle(true);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "sidebar_pages_hidden",
      "true",
    );

    await el.onSidebarHideTasksToggle(true);
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "sidebar_tasks_hidden",
      "true",
    );

    // Backup / Restore / Clear methods
    (global.URL.createObjectURL as any) = jest
      .fn<any>()
      .mockReturnValue("blob:settings-backup");
    (global.URL.revokeObjectURL as any) = jest.fn();
    el.getAllConfigEntries = jest
      .fn<any>()
      .mockResolvedValue([{ key: "k", value: "v" }]);
    el.replaceConfigEntries = jest.fn<any>().mockResolvedValue(undefined);
    el.closeDialog = jest.fn();

    // confirmBackup
    await el.confirmBackup();
    expect(el.closeDialog).toHaveBeenCalledWith(".settings__backup-dialog");

    // confirmClear
    await el.confirmClear();
    expect(el.replaceConfigEntries).toHaveBeenCalledWith([]);

    // confirmRestore
    el.pendingRestoreFile = {
      name: "backup.json",
      text: async () =>
        JSON.stringify({ configEntries: [{ key: "k2", value: "v2" }] }),
    } as any;
    await el.confirmRestore();
    expect(el.replaceConfigEntries).toHaveBeenCalled();
  });

  it("handles tab keyboard navigation (arrows, home, end)", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const buttons = Array.from(
      el.shadowRoot?.querySelectorAll<HTMLButtonElement>("[data-tab-target]") ||
        [],
    );
    expect(buttons.length).toBeGreaterThan(1);

    const firstBtn = buttons[0];
    const lastBtn = buttons[buttons.length - 1];

    // ArrowRight / ArrowDown from first button moves to second
    const arrowRightEvt = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      cancelable: true,
    });
    el.handleTabKeydown(arrowRightEvt, firstBtn);
    expect(arrowRightEvt.defaultPrevented).toBe(true);

    // ArrowLeft / ArrowUp from first button moves to last
    const arrowLeftEvt = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      cancelable: true,
    });
    el.handleTabKeydown(arrowLeftEvt, firstBtn);
    expect(arrowLeftEvt.defaultPrevented).toBe(true);

    // End key moves to last button
    const endEvt = new KeyboardEvent("keydown", {
      key: "End",
      cancelable: true,
    });
    el.handleTabKeydown(endEvt, firstBtn);
    expect(endEvt.defaultPrevented).toBe(true);

    // Home key moves to first button
    const homeEvt = new KeyboardEvent("keydown", {
      key: "Home",
      cancelable: true,
    });
    el.handleTabKeydown(homeEvt, lastBtn);
    expect(homeEvt.defaultPrevented).toBe(true);

    // Non-navigation key is ignored
    const tabEvt = new KeyboardEvent("keydown", {
      key: "Tab",
      cancelable: true,
    });
    el.handleTabKeydown(tabEvt, firstBtn);
    expect(tabEvt.defaultPrevented).toBe(false);

    document.body.removeChild(el);
  });

  it("handles settings UI action buttons and dialog cancellation", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    // Backup button opens backup dialog
    const backupBtn = el.shadowRoot?.querySelector(
      '[data-action="backup-settings"]',
    ) as HTMLElement;
    backupBtn?.click();
    expect(
      el.shadowRoot
        ?.querySelector(".settings__backup-dialog")
        ?.hasAttribute("open"),
    ).toBe(true);

    // Cancel backup dialog
    const cancelBackupBtn = el.shadowRoot?.querySelector(
      '[data-action="cancel-backup-settings"]',
    ) as HTMLElement;
    cancelBackupBtn?.click();

    // Clear settings button opens clear dialog
    const clearBtn = el.shadowRoot?.querySelector(
      '[data-action="clear-settings"]',
    ) as HTMLElement;
    clearBtn?.click();
    expect(
      el.shadowRoot
        ?.querySelector(".settings__clear-dialog")
        ?.hasAttribute("open"),
    ).toBe(true);

    // Cancel clear dialog
    const cancelClearBtn = el.shadowRoot?.querySelector(
      '[data-action="cancel-clear-settings"]',
    ) as HTMLElement;
    cancelClearBtn?.click();

    // Restore button triggers restoreInput.click()
    const restoreBtn = el.shadowRoot?.querySelector(
      '[data-action="restore-settings"]',
    ) as HTMLElement;
    const restoreInput = el.shadowRoot?.querySelector(
      ".settings__restore-input",
    ) as HTMLInputElement;
    const inputClickSpy = jest.spyOn(restoreInput, "click");
    restoreBtn?.click();
    expect(inputClickSpy).toHaveBeenCalled();

    // restoreInput change event opens restore dialog
    const mockFile = new File(["{}"], "my-backup.json", {
      type: "application/json",
    });
    Object.defineProperty(restoreInput, "files", {
      value: [mockFile],
      configurable: true,
    });
    restoreInput.dispatchEvent(new Event("change"));
    expect(el.pendingRestoreFile).toBe(mockFile);

    // Cancel restore dialog clears pendingRestoreFile
    const cancelRestoreBtn = el.shadowRoot?.querySelector(
      '[data-action="cancel-restore-settings"]',
    ) as HTMLElement;
    cancelRestoreBtn?.click();
    expect(el.pendingRestoreFile).toBeNull();

    // Check chat-split-view-toggle
    const splitViewToggle = el.shadowRoot?.querySelector(
      '[data-setting="chat-split-view-toggle"]',
    ) as HTMLInputElement;
    if (splitViewToggle) {
      splitViewToggle.checked = true;
      splitViewToggle.dispatchEvent(new Event("change"));
    }

    // Check pages-auto-refresh-input
    const refreshInput = el.shadowRoot?.querySelector(
      '[data-setting="pages-auto-refresh-input"]',
    ) as HTMLInputElement;
    if (refreshInput) {
      refreshInput.value = "60";
      refreshInput.dispatchEvent(new Event("change"));
    }

    // Save dom allowed iframe hosts
    const saveHostsBtn = el.shadowRoot?.querySelector(
      '[data-action="save-dom-allowed-iframe-hosts"]',
    ) as HTMLElement;
    saveHostsBtn?.click();

    document.body.removeChild(el);
  });

  it("handles SQLite database operations for getAllConfigEntries and replaceConfigEntries", async () => {
    const el = new ShadowClawSettings();
    const mockAll = jest.fn(() => [
      { key: "site_name", value: "My Site" },
      { key: "count", value: 42 },
      null,
    ]);
    const mockRun = jest.fn();
    const mockPrepare = jest.fn((_sql: string) => ({
      all: mockAll,
      run: mockRun,
    }));

    el.db = {
      __brand: "ShadowClawSqliteDatabase",
      db: { prepare: mockPrepare },
    } as any;

    const entries = await el.getAllConfigEntries();
    expect(entries).toEqual([
      { key: "site_name", value: "My Site" },
      { key: "count", value: 42 },
    ]);

    await el.replaceConfigEntries([
      { key: "k1", value: "v1" },
      { key: "k2", value: { obj: true } },
    ]);
    expect(mockPrepare).toHaveBeenCalledWith("DELETE FROM config");
    expect(mockRun).toHaveBeenCalledWith("k1", "v1");
    expect(mockRun).toHaveBeenCalledWith("k2", JSON.stringify({ obj: true }));
  });

  it("handles saveAssistantName edge cases", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    // Empty assistant name gives warning
    const nameInput = el.shadowRoot?.querySelector(
      '[data-setting="assistant-name-input"]',
    ) as HTMLInputElement;
    nameInput.value = "   ";
    await el.saveAssistantName();

    // Non-empty assistant name saves successfully
    nameInput.value = "ShadowClaw Master";
    await el.saveAssistantName();

    document.body.removeChild(el);
  });

  it("handles null db and error edge cases in confirmBackup, confirmClear, confirmRestore", async () => {
    const el = new ShadowClawSettings();
    el.db = null;

    // confirmBackup with null db
    await el.confirmBackup();

    // confirmClear with null db
    await el.confirmClear();

    // confirmRestore with null db
    await el.confirmRestore();

    // confirmRestore without file
    el.db = {} as any;
    el.pendingRestoreFile = null;
    await el.confirmRestore();

    // confirmRestore with invalid JSON file
    el.pendingRestoreFile = {
      name: "broken.json",
      text: async () => "invalid-json{",
    } as any;
    await el.confirmRestore();

    // activateTab for integrations
    await el.activateTab("integrations");
  });

  it("handles handleTabKeydown with arrows, home, end, and default keys", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    const root = el.shadowRoot!;
    const tabButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>("[data-tab-target]"),
    );
    expect(tabButtons.length).toBeGreaterThan(1);

    const activateSpy = jest
      .spyOn(el, "activateTab")
      .mockImplementation(() => {});

    // ArrowRight / ArrowDown moves to next tab
    const eventRight = { key: "ArrowRight", preventDefault: jest.fn() } as any;
    el.handleTabKeydown(eventRight, tabButtons[0]);
    expect(eventRight.preventDefault).toHaveBeenCalled();
    expect(activateSpy).toHaveBeenCalledWith(tabButtons[1].dataset.tabTarget);

    const eventDown = { key: "ArrowDown", preventDefault: jest.fn() } as any;
    el.handleTabKeydown(eventDown, tabButtons[0]);
    expect(eventDown.preventDefault).toHaveBeenCalled();

    // ArrowLeft / ArrowUp wraps to previous / last tab
    const eventLeft = { key: "ArrowLeft", preventDefault: jest.fn() } as any;
    el.handleTabKeydown(eventLeft, tabButtons[0]);
    expect(eventLeft.preventDefault).toHaveBeenCalled();
    expect(activateSpy).toHaveBeenCalledWith(
      tabButtons[tabButtons.length - 1].dataset.tabTarget,
    );

    const eventUp = { key: "ArrowUp", preventDefault: jest.fn() } as any;
    el.handleTabKeydown(eventUp, tabButtons[1]);
    expect(eventUp.preventDefault).toHaveBeenCalled();
    expect(activateSpy).toHaveBeenCalledWith(tabButtons[0].dataset.tabTarget);

    // Home moves to first tab
    const eventHome = { key: "Home", preventDefault: jest.fn() } as any;
    el.handleTabKeydown(eventHome, tabButtons[2]);
    expect(eventHome.preventDefault).toHaveBeenCalled();
    expect(activateSpy).toHaveBeenCalledWith(tabButtons[0].dataset.tabTarget);

    // End moves to last tab
    const eventEnd = { key: "End", preventDefault: jest.fn() } as any;
    el.handleTabKeydown(eventEnd, tabButtons[0]);
    expect(eventEnd.preventDefault).toHaveBeenCalled();
    expect(activateSpy).toHaveBeenCalledWith(
      tabButtons[tabButtons.length - 1].dataset.tabTarget,
    );

    // Other key returns early without preventDefault
    const eventTab = { key: "Tab", preventDefault: jest.fn() } as any;
    el.handleTabKeydown(eventTab, tabButtons[0]);
    expect(eventTab.preventDefault).not.toHaveBeenCalled();

    // Button not in tabButtons
    const outsideBtn = document.createElement("button");
    el.handleTabKeydown(eventRight, outsideBtn);

    // Early return when activeTab is undefined or same tab
    el.activeTab = "ai";
    el.activateTab(undefined);
    expect(el.activeTab).toBe("ai");
    el.activateTab("ai");
    expect(el.activeTab).toBe("ai");

    document.body.removeChild(el);
  });

  it("handles dialog opening, closing, showModal fallback, and promptForPlaintextBackupHandle", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.render();

    // 1. openBackupDialog unchecks plaintext toggle and shows dialog
    el.openBackupDialog();
    const backupDialog = el.getDialog(".settings__backup-dialog");
    expect(backupDialog).toBeTruthy();

    // 2. openRestoreDialog populates filename info
    el.openRestoreDialog("my-backup.json");
    const restoreDialog = el.getDialog(".settings__restore-dialog");
    expect(restoreDialog).toBeTruthy();
    const info = el.shadowRoot!.querySelector(
      '[data-info="restore-filename"]',
    ) as HTMLElement;
    expect(info.textContent).toBe("Selected file: my-backup.json");

    // 3. openClearDialog
    el.openClearDialog();

    // 4. closeDialog
    el.closeDialog(".settings__backup-dialog");

    // 5. showDialog fallback when showModal is undefined
    const fakeDialog = document.createElement("dialog");
    delete (fakeDialog as any).showModal;
    jest.spyOn(el, "getDialog").mockReturnValueOnce(fakeDialog as any);
    el.showDialog(".test-dialog");
    expect(fakeDialog.hasAttribute("open")).toBe(true);

    // 6. getDialog with invalid selector or non-dialog element
    expect(el.getDialog(".non-existent")).toBeNull();
    const fakeDiv = document.createElement("div");
    fakeDiv.classList.add("not-a-dialog");
    el.shadowRoot!.appendChild(fakeDiv);
    expect(el.getDialog(".not-a-dialog")).toBeNull();

    // 7. promptForPlaintextBackupHandle: showSaveFilePicker missing
    const origPicker = (globalThis as any).showSaveFilePicker;
    delete (globalThis as any).showSaveFilePicker;
    await expect(el.promptForPlaintextBackupHandle()).rejects.toThrow(
      "Plaintext settings backup requires the File System Access API.",
    );

    // showSaveFilePicker returns fileHandle
    const mockFileHandle = { kind: "file", name: "test-backup.json" };
    (globalThis as any).showSaveFilePicker = jest
      .fn<any>()
      .mockResolvedValue(mockFileHandle);
    const handle = await el.promptForPlaintextBackupHandle();
    expect(handle).toBe(mockFileHandle);

    // showSaveFilePicker throws AbortError
    const abortErr = new Error("User canceled");
    abortErr.name = "AbortError";
    (globalThis as any).showSaveFilePicker = jest
      .fn<any>()
      .mockRejectedValue(abortErr);
    const aborted = await el.promptForPlaintextBackupHandle();
    expect(aborted).toBeNull();

    // showSaveFilePicker throws generic error
    (globalThis as any).showSaveFilePicker = jest
      .fn<any>()
      .mockRejectedValue(new Error("Disk error"));
    await expect(el.promptForPlaintextBackupHandle()).rejects.toThrow(
      "Disk error",
    );

    if (origPicker) {
      (globalThis as any).showSaveFilePicker = origPicker;
    } else {
      delete (globalThis as any).showSaveFilePicker;
    }

    document.body.removeChild(el);
  });

  it("handles confirmBackup with plaintext toggle, abort, and error paths", async () => {
    const el = new ShadowClawSettings();
    el.db = {} as any;
    document.body.appendChild(el);
    await el.render();

    const root = el.shadowRoot!;
    const plaintextToggle = root.querySelector(
      '[data-setting="include-plaintext-passwords"]',
    ) as HTMLInputElement;

    // 1. Plaintext backup with abort -> returns early
    (globalThis as any)._mockWriteSettingsBackupToFileHandle.mockClear();
    plaintextToggle.checked = true;
    jest
      .spyOn(el, "promptForPlaintextBackupHandle")
      .mockResolvedValueOnce(null);
    await el.confirmBackup();
    expect(
      (globalThis as any)._mockWriteSettingsBackupToFileHandle,
    ).not.toHaveBeenCalled();

    // 2. Plaintext backup success
    const mockHandle = { kind: "file" };
    jest
      .spyOn(el, "promptForPlaintextBackupHandle")
      .mockResolvedValueOnce(mockHandle as any);
    jest
      .spyOn(el, "getAllConfigEntries")
      .mockResolvedValueOnce([{ key: "k", value: "v" }]);
    await el.confirmBackup();
    expect(
      (globalThis as any)._mockWriteSettingsBackupToFileHandle,
    ).toHaveBeenCalledWith(mockHandle, [{ key: "k", value: "v" }], true);

    // 3. Standard download backup success
    plaintextToggle.checked = false;
    jest
      .spyOn(el, "getAllConfigEntries")
      .mockResolvedValueOnce([{ key: "k2", value: "v2" }]);
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn<any>().mockReturnValue("blob:test");
    URL.revokeObjectURL = jest.fn<any>();
    await el.confirmBackup();
    expect(
      (globalThis as any)._mockCreateSettingsBackupBlob,
    ).toHaveBeenCalled();
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;

    // 4. Error in confirmBackup
    jest
      .spyOn(el, "getAllConfigEntries")
      .mockRejectedValueOnce(new Error("Backup failed"));
    await el.confirmBackup();

    document.body.removeChild(el);
  });

  it("handles confirmClear and confirmRestore success and error flows", async () => {
    const el = new ShadowClawSettings();
    el.db = {} as any;

    const setTimeoutSpy = jest
      .spyOn(window, "setTimeout")
      .mockReturnValue(123 as any);

    // 1. confirmClear success
    jest.spyOn(el, "replaceConfigEntries").mockResolvedValueOnce(undefined);
    await el.confirmClear();
    expect(setTimeoutSpy).toHaveBeenCalled();

    // 2. confirmClear error
    jest
      .spyOn(el, "replaceConfigEntries")
      .mockRejectedValueOnce(new Error("Clear failed"));
    await el.confirmClear();

    // 3. confirmRestore success
    el.pendingRestoreFile = {
      name: "valid.json",
      text: async () =>
        JSON.stringify({
          configEntries: [{ key: "a", value: "1" }],
          plaintextPasswords: [],
        }),
    } as any;
    (globalThis as any)._mockParseSettingsBackupPayload.mockReturnValueOnce({
      configEntries: [{ key: "a", value: "1" }],
      plaintextPasswords: [],
    });
    (globalThis as any)._mockReapplyPlaintextPasswords.mockResolvedValueOnce([
      { key: "a", value: "1" },
    ]);
    jest.spyOn(el, "replaceConfigEntries").mockResolvedValueOnce(undefined);
    await el.confirmRestore();

    // 4. confirmRestore error with non-Error
    el.pendingRestoreFile = {
      name: "fail.json",
      text: async () => {
        throw "String error restore";
      },
    } as any;
    await el.confirmRestore();

    setTimeoutSpy.mockRestore();
  });

  it("handles IndexedDB operations in getAllConfigEntries and replaceConfigEntries", async () => {
    const el = new ShadowClawSettings();

    // 1. getAllConfigEntries IDB success
    const mockGetAllRequest: any = {
      result: [{ key: "test_k", value: "test_v" }, null, { key: 123 }],
    };
    const mockTxSuccess: any = {
      objectStore: jest.fn().mockReturnValue({
        getAll: jest.fn().mockImplementation(() => {
          setTimeout(() => {
            if (mockGetAllRequest.onsuccess) mockGetAllRequest.onsuccess();
          }, 0);
          return mockGetAllRequest;
        }),
      }),
    };
    el.db = {
      transaction: jest.fn().mockReturnValue(mockTxSuccess),
    } as any;

    const entries = await el.getAllConfigEntries();
    expect(entries).toEqual([{ key: "test_k", value: "test_v" }]);

    // 2. getAllConfigEntries IDB request.onerror
    const mockGetAllFail: any = { error: new Error("IDB read failed") };
    const mockTxFail: any = {
      objectStore: jest.fn().mockReturnValue({
        getAll: jest.fn().mockImplementation(() => {
          setTimeout(() => {
            if (mockGetAllFail.onerror) mockGetAllFail.onerror();
          }, 0);
          return mockGetAllFail;
        }),
      }),
    };
    el.db = { transaction: jest.fn().mockReturnValue(mockTxFail) } as any;
    await expect(el.getAllConfigEntries()).rejects.toThrow("IDB read failed");

    // 3. getAllConfigEntries IDB transaction null
    el.db = { transaction: jest.fn().mockReturnValue(null) } as any;
    await expect(el.getAllConfigEntries()).rejects.toThrow(
      "Failed to open read transaction",
    );

    // 4. replaceConfigEntries IDB success
    const mockStore = { clear: jest.fn(), put: jest.fn() };
    const mockWriteTx: any = {
      objectStore: jest.fn().mockReturnValue(mockStore),
    };
    el.db = {
      transaction: jest.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockWriteTx.oncomplete) mockWriteTx.oncomplete();
        }, 0);
        return mockWriteTx;
      }),
    } as any;

    await el.replaceConfigEntries([{ key: "x", value: "y" }]);
    expect(mockStore.clear).toHaveBeenCalled();
    expect(mockStore.put).toHaveBeenCalledWith({ key: "x", value: "y" });

    // 5. replaceConfigEntries IDB tx.onerror
    const mockWriteTxErr: any = {
      objectStore: jest.fn().mockReturnValue(mockStore),
      error: new Error("IDB write error"),
    };
    el.db = {
      transaction: jest.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockWriteTxErr.onerror) mockWriteTxErr.onerror();
        }, 0);
        return mockWriteTxErr;
      }),
    } as any;
    await expect(
      el.replaceConfigEntries([{ key: "x", value: "y" }]),
    ).rejects.toThrow("IDB write error");

    // 6. replaceConfigEntries IDB tx.onabort
    const mockWriteTxAbort: any = {
      objectStore: jest.fn().mockReturnValue(mockStore),
      error: new Error("Transaction aborted"),
    };
    el.db = {
      transaction: jest.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockWriteTxAbort.onabort) mockWriteTxAbort.onabort();
        }, 0);
        return mockWriteTxAbort;
      }),
    } as any;
    await expect(
      el.replaceConfigEntries([{ key: "x", value: "y" }]),
    ).rejects.toThrow("Transaction aborted");

    // 7. replaceConfigEntries IDB transaction null
    el.db = { transaction: jest.fn().mockReturnValue(null) } as any;
    await expect(el.replaceConfigEntries([])).rejects.toThrow(
      "Failed to open write transaction",
    );
  });

  it("handles toggle and input change handlers with success and error paths", async () => {
    const el = new ShadowClawSettings();
    el.db = {} as any;

    // 1. onActivityLogDiskLoggingToggle
    await el.onActivityLogDiskLoggingToggle(true);
    await el.onActivityLogDiskLoggingToggle(false);
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      new Error("Log toggle error"),
    );
    await el.onActivityLogDiskLoggingToggle(true);
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      "String error log",
    );
    await el.onActivityLogDiskLoggingToggle(true);

    // 2. onChatSplitViewToggle
    await el.onChatSplitViewToggle(true);
    await el.onChatSplitViewToggle(false);
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      new Error("Split error"),
    );
    await el.onChatSplitViewToggle(true);

    // 3. onOverridePrerenderSkeletonToggle
    await el.onOverridePrerenderSkeletonToggle(true);
    await el.onOverridePrerenderSkeletonToggle(false);
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      new Error("Prerender error"),
    );
    await el.onOverridePrerenderSkeletonToggle(true);

    // 4. onPagesAutoRefreshInputChange
    await el.onPagesAutoRefreshInputChange(30);
    await el.onPagesAutoRefreshInputChange(0);
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      new Error("Auto refresh error"),
    );
    await el.onPagesAutoRefreshInputChange(10);

    // 5. onSidebarHideChatToggle
    await el.onSidebarHideChatToggle(true);
    await el.onSidebarHideChatToggle(false);
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      new Error("Chat hide error"),
    );
    await el.onSidebarHideChatToggle(true);

    // 6. onSidebarHideFilesToggle
    await el.onSidebarHideFilesToggle(true);
    await el.onSidebarHideFilesToggle(false);
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      new Error("Files hide error"),
    );
    await el.onSidebarHideFilesToggle(true);

    // 7. onSidebarHidePagesToggle
    await el.onSidebarHidePagesToggle(true);
    await el.onSidebarHidePagesToggle(false);
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      new Error("Pages hide error"),
    );
    await el.onSidebarHidePagesToggle(true);

    // 8. onSidebarHideTasksToggle
    await el.onSidebarHideTasksToggle(true);
    await el.onSidebarHideTasksToggle(false);
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      new Error("Tasks hide error"),
    );
    await el.onSidebarHideTasksToggle(true);

    // Null db guards
    el.db = null;
    await el.onActivityLogDiskLoggingToggle(true);
    await el.onChatSplitViewToggle(true);
    await el.onOverridePrerenderSkeletonToggle(true);
    await el.onPagesAutoRefreshInputChange(15);
    await el.onSidebarHideChatToggle(true);
    await el.onSidebarHideFilesToggle(true);
    await el.onSidebarHidePagesToggle(true);
    await el.onSidebarHideTasksToggle(true);
  });

  it("handles saveDomAllowedIframeHosts with various inputs and error cases", async () => {
    const el = new ShadowClawSettings();
    el.db = {} as any;
    document.body.appendChild(el);
    await el.render();

    const root = el.shadowRoot!;
    const textarea = root.querySelector(
      '[data-setting="dom-allowed-iframe-hosts"]',
    ) as HTMLTextAreaElement;
    textarea.value = "https://example.com\nhttps://sub.domain.org\n   ";

    const pToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-pages-toggle"]',
    ) as HTMLInputElement;
    const fvToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-file-viewer-toggle"]',
    ) as HTMLInputElement;
    const cToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-chat-toggle"]',
    ) as HTMLInputElement;
    const tToggle = root.querySelector(
      '[data-setting="markdown-frontmatter-tasks-toggle"]',
    ) as HTMLInputElement;

    pToggle.checked = false;
    fvToggle.checked = true;
    cToggle.checked = false;
    tToggle.checked = true;

    await el.saveDomAllowedIframeHosts();
    expect((globalThis as any)._mockSetConfig).toHaveBeenCalledWith(
      el.db,
      "allowed_iframe_host_patterns",
      "https://example.com\nhttps://sub.domain.org",
    );

    // Error handling
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      new Error("Save hosts fail"),
    );
    await el.saveDomAllowedIframeHosts();

    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      "String save hosts fail",
    );
    await el.saveDomAllowedIframeHosts();

    // Null textarea / null root guards
    el.db = null;
    await el.saveDomAllowedIframeHosts();

    document.body.removeChild(el);
  });

  it("handles populateAssistantSettings fallbacks and variations", async () => {
    const el = new ShadowClawSettings();
    el.db = {} as any;
    document.body.appendChild(el);

    // Mock getConfig to test various raw config types: "1", 1, "true", true, 0, false, null
    const { getConfig } = (await import("../../db/get-config.js")) as any;
    getConfig.mockImplementation((_db: any, key: string) => {
      if (key === "assistant_name") return Promise.resolve("");
      if (key === "activity_log_disk_logging_enabled")
        return Promise.resolve(1);
      if (key === "sidebar_pages_hidden") return Promise.resolve("1");
      if (key === "sidebar_chat_hidden") return Promise.resolve("true");
      if (key === "sidebar_tasks_hidden") return Promise.resolve(true);
      if (key === "sidebar_files_hidden") return Promise.resolve(false);
      if (key === "pages_auto_refresh_interval") return Promise.resolve(-5); // negative parsed
      if (key === "allowed_iframe_host_patterns")
        return Promise.resolve("https://saved.host.com");
      return Promise.resolve(undefined);
    });

    await el.populateAssistantSettings();

    const root = el.shadowRoot!;
    const nameInput = root.querySelector(
      '[data-setting="assistant-name-input"]',
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("ShadowClaw"); // From orchestratorStore

    // When stored is custom bot name
    getConfig.mockImplementationOnce((_db: any, key: string) => {
      if (key === "assistant_name") return Promise.resolve("MyCustomBot");
      return Promise.resolve(undefined);
    });
    await el.populateAssistantSettings();
    expect(nameInput.value).toBe("MyCustomBot");

    // When stored is empty and no orchestrator, fallback to ASSISTANT_NAME ("ShadowClaw")
    const origOrch = orchestratorStore.orchestrator;
    const origElOrch = el.orchestrator;
    el.orchestrator = null;
    (orchestratorStore as any).orchestrator = null;
    await el.populateAssistantSettings();
    expect(nameInput.value).toBe("ShadowClaw");
    el.orchestrator = origElOrch;
    (orchestratorStore as any).orchestrator = origOrch;

    const actToggle = root.querySelector(
      '[data-setting="activity-log-disk-logging-toggle"]',
    ) as HTMLInputElement;
    expect(actToggle.checked).toBe(true);

    const pagesToggle = root.querySelector(
      '[data-setting="sidebar-hide-pages-toggle"]',
    ) as HTMLInputElement;
    expect(pagesToggle.checked).toBe(true);

    const autoRefreshInput = root.querySelector(
      '[data-setting="pages-auto-refresh-input"]',
    ) as HTMLInputElement;
    expect(autoRefreshInput.value).toBe("0"); // Clamped from negative

    const hostsTextarea = root.querySelector(
      '[data-setting="dom-allowed-iframe-hosts"]',
    ) as HTMLTextAreaElement;
    expect(hostsTextarea.value).toBe("https://saved.host.com");

    document.body.removeChild(el);
  });

  it("handles bindSettingsActions restore-input change with file and without file", async () => {
    const el = new ShadowClawSettings();
    el.db = {} as any;
    document.body.appendChild(el);
    await el.render();

    const root = el.shadowRoot!;
    const restoreInput = root.querySelector(
      ".settings__restore-input",
    ) as HTMLInputElement;

    const restoreSpy = jest
      .spyOn(el, "openRestoreDialog")
      .mockImplementation(() => {});

    // 1. Change event with file
    const file = new File(['{"configEntries":[]}'], "settings-backup.json", {
      type: "application/json",
    });
    Object.defineProperty(restoreInput, "files", {
      value: [file],
      writable: true,
      configurable: true,
    });
    restoreInput.dispatchEvent(new Event("change"));
    expect(restoreSpy).toHaveBeenCalledWith("settings-backup.json");
    expect(el.pendingRestoreFile).toBe(file);

    // 2. Change event without files
    Object.defineProperty(restoreInput, "files", {
      value: [],
      writable: true,
      configurable: true,
    });
    restoreInput.dispatchEvent(new Event("change"));

    // 3. Click restore-settings button triggers input.click()
    const clickSpy = jest.spyOn(restoreInput, "click");
    const restoreBtn = root.querySelector(
      '[data-action="restore-settings"]',
    ) as HTMLElement;
    restoreBtn.click();
    expect(clickSpy).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("handles change events on all bound setting toggles and inputs in bindSettingsActions", async () => {
    const el = new ShadowClawSettings();
    el.db = {} as any;
    document.body.appendChild(el);
    await el.render();

    const root = el.shadowRoot!;

    // 1. sidebar-hide-chat-toggle
    const chatSpy = jest
      .spyOn(el, "onSidebarHideChatToggle")
      .mockResolvedValue(undefined as any);
    const chatToggle = root.querySelector(
      '[data-setting="sidebar-hide-chat-toggle"]',
    ) as HTMLInputElement;
    chatToggle.checked = true;
    chatToggle.dispatchEvent(new Event("change"));
    expect(chatSpy).toHaveBeenCalledWith(true);

    // 2. sidebar-hide-tasks-toggle
    const tasksSpy = jest
      .spyOn(el, "onSidebarHideTasksToggle")
      .mockResolvedValue(undefined as any);
    const tasksToggle = root.querySelector(
      '[data-setting="sidebar-hide-tasks-toggle"]',
    ) as HTMLInputElement;
    tasksToggle.checked = true;
    tasksToggle.dispatchEvent(new Event("change"));
    expect(tasksSpy).toHaveBeenCalledWith(true);

    // 3. sidebar-hide-files-toggle
    const filesSpy = jest
      .spyOn(el, "onSidebarHideFilesToggle")
      .mockResolvedValue(undefined as any);
    const filesToggle = root.querySelector(
      '[data-setting="sidebar-hide-files-toggle"]',
    ) as HTMLInputElement;
    filesToggle.checked = true;
    filesToggle.dispatchEvent(new Event("change"));
    expect(filesSpy).toHaveBeenCalledWith(true);

    // 4. chat-split-view-toggle
    const splitSpy = jest
      .spyOn(el, "onChatSplitViewToggle")
      .mockResolvedValue(undefined as any);
    const splitToggle = root.querySelector(
      '[data-setting="chat-split-view-toggle"]',
    ) as HTMLInputElement;
    splitToggle.checked = true;
    splitToggle.dispatchEvent(new Event("change"));
    expect(splitSpy).toHaveBeenCalledWith(true);

    // 5. pages-auto-refresh-input valid number and NaN
    const refreshSpy = jest
      .spyOn(el, "onPagesAutoRefreshInputChange")
      .mockResolvedValue(undefined as any);
    const refreshInput = root.querySelector(
      '[data-setting="pages-auto-refresh-input"]',
    ) as HTMLInputElement;
    refreshInput.value = "120";
    refreshInput.dispatchEvent(new Event("change"));
    expect(refreshSpy).toHaveBeenCalledWith(120);

    refreshInput.value = "invalid";
    refreshInput.dispatchEvent(new Event("change"));
    expect(refreshSpy).toHaveBeenCalledWith(0);

    // 6. override-prerender-skeleton-toggle
    const overrideSpy = jest
      .spyOn(el, "onOverridePrerenderSkeletonToggle")
      .mockResolvedValue(undefined as any);
    const overrideToggle = root.querySelector(
      '[data-setting="override-prerender-skeleton-toggle"]',
    ) as HTMLInputElement;
    overrideToggle.checked = true;
    overrideToggle.dispatchEvent(new Event("change"));
    expect(overrideSpy).toHaveBeenCalledWith(true);

    // 7. activity-log-disk-logging-toggle
    const logSpy = jest
      .spyOn(el, "onActivityLogDiskLoggingToggle")
      .mockResolvedValue(undefined as any);
    const logToggle = root.querySelector(
      '[data-setting="activity-log-disk-logging-toggle"]',
    ) as HTMLInputElement;
    logToggle.checked = true;
    logToggle.dispatchEvent(new Event("change"));
    expect(logSpy).toHaveBeenCalledWith(true);

    // 8. sidebar-hide-pages-toggle
    const pagesSpy = jest
      .spyOn(el, "onSidebarHidePagesToggle")
      .mockResolvedValue(undefined as any);
    const pagesToggle = root.querySelector(
      '[data-setting="sidebar-hide-pages-toggle"]',
    ) as HTMLInputElement;
    pagesToggle.checked = true;
    pagesToggle.dispatchEvent(new Event("change"));
    expect(pagesSpy).toHaveBeenCalledWith(true);

    document.body.removeChild(el);
  });

  it("handles string errors and null shadowRoot guards across methods", async () => {
    const el = new ShadowClawSettings();
    el.db = {} as any;

    // 1. String error paths in confirmBackup and confirmClear
    jest
      .spyOn(el, "getAllConfigEntries")
      .mockRejectedValueOnce("String backup error");
    await el.confirmBackup();

    jest
      .spyOn(el, "replaceConfigEntries")
      .mockRejectedValueOnce("String clear error");
    await el.confirmClear();

    // 2. String error paths in toggles
    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      "String split error",
    );
    await el.onChatSplitViewToggle(true);

    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      "String override error",
    );
    await el.onOverridePrerenderSkeletonToggle(true);

    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      "String refresh error",
    );
    await el.onPagesAutoRefreshInputChange(10);

    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      "String chat hide error",
    );
    await el.onSidebarHideChatToggle(true);

    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      "String files hide error",
    );
    await el.onSidebarHideFilesToggle(true);

    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      "String pages hide error",
    );
    await el.onSidebarHidePagesToggle(true);

    (globalThis as any)._mockSetConfig.mockRejectedValueOnce(
      "String tasks hide error",
    );
    await el.onSidebarHideTasksToggle(true);

    // 3. Null shadowRoot guards
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    el.applyTabState();
    el.bindSettingsActions();
    el.handleTabKeydown(
      { key: "ArrowRight", preventDefault: jest.fn() } as any,
      document.createElement("button"),
    );
    expect(el.getDialog(".test")).toBeNull();
    await el.populateAssistantSettings();
    await el.render();
    await el.saveDomAllowedIframeHosts();
  });

  it("handles boolean config permutations and local storage fallback in populateAssistantSettings", async () => {
    const el = new ShadowClawSettings();
    el.db = {} as any;
    document.body.appendChild(el);

    const { getConfig } = (await import("../../db/get-config.js")) as any;
    const { setNamespacedItem } =
      (await import("../../utils/namespaced-storage.js")) as any;

    // Test with raw boolean === true, "true", 1, "1" across all toggles
    getConfig.mockImplementation((_db: any, key: string) => {
      if (key === "activity_log_disk_logging_enabled")
        return Promise.resolve(true);
      if (key === "sidebar_pages_hidden") return Promise.resolve(true);
      if (key === "sidebar_chat_hidden") return Promise.resolve(1);
      if (key === "sidebar_tasks_hidden") return Promise.resolve("1");
      if (key === "sidebar_files_hidden") return Promise.resolve("true");
      if (key === "chat_split_view_enabled") return Promise.resolve("true");
      if (key === "pages_auto_refresh_interval") return Promise.resolve(60); // Positive valid number
      if (key === "override_prerender_skeleton") return Promise.resolve(null); // Triggers localStorage check
      if (key === "allowed_iframe_host_patterns") return Promise.resolve("");
      return Promise.resolve(undefined);
    });

    // When localStorage has "true"
    setNamespacedItem("shadow-claw-override-prerender-skeleton", "true");
    await el.populateAssistantSettings();

    const root = el.shadowRoot!;
    const refreshInput = root.querySelector(
      '[data-setting="pages-auto-refresh-input"]',
    ) as HTMLInputElement;
    expect(refreshInput.value).toBe("60");

    const overrideToggle = root.querySelector(
      '[data-setting="override-prerender-skeleton-toggle"]',
    ) as HTMLInputElement;
    expect(overrideToggle.checked).toBe(true);

    // When localStorage has "false"
    setNamespacedItem("shadow-claw-override-prerender-skeleton", "false");
    await el.populateAssistantSettings();
    expect(overrideToggle.checked).toBe(false);

    document.body.removeChild(el);
  });
});
