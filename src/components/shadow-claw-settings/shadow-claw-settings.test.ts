import { jest } from "@jest/globals";

jest.unstable_mockModule(
  "../settings/shadow-claw-accounts/shadow-claw-accounts.js",
  () => {
    class MockAccounts extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-accounts", MockAccounts);

    return { ShadowClawAccounts: MockAccounts };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-llm/shadow-claw-llm.js",
  () => {
    class MockLlm extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-llm", MockLlm);

    return { ShadowClawLlm: MockLlm };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-git/shadow-claw-git.js",
  () => {
    class MockGit extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-git", MockGit);

    return { ShadowClawGit: MockGit };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-integrations/shadow-claw-integrations.js",
  () => {
    class MockIntegrations extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-integrations", MockIntegrations);

    return { ShadowClawIntegrations: MockIntegrations };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-storage/shadow-claw-storage.js",
  () => {
    class MockStorage extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-storage", MockStorage);

    return { ShadowClawStorage: MockStorage };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-webvm/shadow-claw-webvm.js",
  () => {
    class MockWebvm extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-webvm", MockWebvm);

    return { ShadowClawWebvm: MockWebvm };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-networking/shadow-claw-networking.js",
  () => {
    class MockNetworking extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-networking", MockNetworking);

    return { ShadowClawNetworking: MockNetworking };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-mcp-remote/shadow-claw-mcp-remote.js",
  () => {
    class MockMcpRemote extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-mcp-remote", MockMcpRemote);

    return { ShadowClawMcpRemote: MockMcpRemote };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-notifications/shadow-claw-notifications.js",
  () => {
    class MockNotifications extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-notifications", MockNotifications);

    return { ShadowClawNotifications: MockNotifications };
  },
);

jest.unstable_mockModule(
  "../settings/shadow-claw-task-server/shadow-claw-task-server.js",
  () => {
    class MockTaskServer extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-task-server", MockTaskServer);

    return { ShadowClawTaskServer: MockTaskServer };
  },
);

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockImplementation((_db: unknown, key: string) => {
    if (key === "assistant_name") {
      return Promise.resolve("k9");
    }

    return Promise.resolve("true");
  }),
}));

(globalThis as any)._mockSetConfig = jest
  .fn<any>()
  .mockResolvedValue(undefined);
jest.unstable_mockModule("../../db/setConfig.js", () => ({
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
jest.unstable_mockModule("../../settings-backup.js", () => ({
  createSettingsBackupBlob: (...args: any[]) =>
    (globalThis as any)._mockCreateSettingsBackupBlob(...args),
  writeSettingsBackupToFileHandle: (...args: any[]) =>
    (globalThis as any)._mockWriteSettingsBackupToFileHandle(...args),
  parseSettingsBackupPayload: (...args: any[]) =>
    (globalThis as any)._mockParseSettingsBackupPayload(...args),
  reapplyPlaintextPasswords: (...args: any[]) =>
    (globalThis as any)._mockReapplyPlaintextPasswords(...args),
}));

const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { ShadowClawSettings } = await import("./shadow-claw-settings.js");

describe("shadow-claw-settings", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-settings")).toBe(ShadowClawSettings);
  });

  it("renders all sub-components", async () => {
    const el = new ShadowClawSettings();
    document.body.appendChild(el);
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
    await new Promise((resolve) => setTimeout(resolve, 0));

    (el as any).db = {
      transaction: () => ({
        objectStore: () => ({
          getAll: () => {
            const request: any = {
              result: [{ key: "assistant_name", value: "k9" }],
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
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
    await el.onTemplateReady;
    await el.render();

    const revisionEl = el.shadowRoot?.querySelector(
      '[data-info="deployed-revision"]',
    );
    expect(revisionEl?.textContent).toContain("abc123");

    document.body.removeChild(el);
    document.head.removeChild(meta);
  });

  it("populates and saves assistant name", async () => {
    const setAssistantName = jest.fn();
    const orchestrator = {
      getAssistantName: jest.fn().mockReturnValue("k9"),
      setAssistantName,
    };
    (orchestratorStore as any).orchestrator = orchestrator;
    const el = new ShadowClawSettings();
    (el as any).orchestrator = orchestrator;
    (el as any).db = {} as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
    await el.render();

    const nameInput = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-setting="assistant-name-input"]',
    );
    expect(nameInput?.value).toBe("k9");

    if (nameInput) {
      nameInput.value = "new-name";
    }

    await new Promise((r) => setTimeout(r, 0));
    const saveBtn = el.shadowRoot?.querySelector(
      '[data-action="save-assistant-name"]',
    );
    saveBtn?.dispatchEvent(new Event("click"));

    expect(setAssistantName).toHaveBeenCalledWith(
      expect.anything(),
      "new-name",
    );
    document.body.removeChild(el);
  });

  it("populates and toggles activity log disk logging", async () => {
    await import("../../db/setConfig.js");
    const orchestrator = {
      getAssistantName: jest.fn(),
    };
    const el = new ShadowClawSettings();
    (el as any).orchestrator = orchestrator;
    (el as any).db = {} as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
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

  it("saves assistant name via config when orchestrator is unavailable", async () => {
    (orchestratorStore as any).orchestrator = null;
    (globalThis as any)._mockSetConfig.mockClear();

    const el = new ShadowClawSettings();
    (el as any).orchestrator = null;
    (el as any).db = {} as any;
    document.body.appendChild(el);
    await el.onTemplateReady;
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
});
