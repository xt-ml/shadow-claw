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

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

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
    const remoteMcp = el.shadowRoot?.querySelector("shadow-claw-mcp-remote");
    const llm = el.shadowRoot?.querySelector("shadow-claw-llm");
    const networking = el.shadowRoot?.querySelector("shadow-claw-networking");
    const webvm = el.shadowRoot?.querySelector("shadow-claw-webvm");
    const git = el.shadowRoot?.querySelector("shadow-claw-git");
    const storage = el.shadowRoot?.querySelector("shadow-claw-storage");

    expect(accounts).not.toBeNull();
    expect(remoteMcp).not.toBeNull();
    expect(llm).not.toBeNull();
    expect(networking).not.toBeNull();
    expect(webvm).not.toBeNull();
    expect(git).not.toBeNull();
    expect(storage).not.toBeNull();

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
    expect(envPanel?.firstElementChild?.tagName.toLowerCase()).toBe(
      "shadow-claw-networking",
    );

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
});
