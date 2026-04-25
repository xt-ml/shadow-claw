import { jest } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

jest.unstable_mockModule(
  "../shadow-claw-settings-accounts/shadow-claw-settings-accounts.js",
  () => {
    class MockAccounts extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-settings-accounts", MockAccounts);

    return { ShadowClawSettingsAccounts: MockAccounts };
  },
);

jest.unstable_mockModule(
  "../shadow-claw-settings-llm/shadow-claw-settings-llm.js",
  () => {
    class MockLlm extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-settings-llm", MockLlm);

    return { ShadowClawSettingsLlm: MockLlm };
  },
);

jest.unstable_mockModule(
  "../shadow-claw-settings-git/shadow-claw-settings-git.js",
  () => {
    class MockGit extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-settings-git", MockGit);

    return { ShadowClawSettingsGit: MockGit };
  },
);

jest.unstable_mockModule(
  "../shadow-claw-settings-storage/shadow-claw-settings-storage.js",
  () => {
    class MockStorage extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-settings-storage", MockStorage);

    return { ShadowClawSettingsStorage: MockStorage };
  },
);

jest.unstable_mockModule(
  "../shadow-claw-settings-webvm/shadow-claw-settings-webvm.js",
  () => {
    class MockWebvm extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-settings-webvm", MockWebvm);

    return { ShadowClawSettingsWebvm: MockWebvm };
  },
);

jest.unstable_mockModule(
  "../shadow-claw-settings-mcp-remote/shadow-claw-settings-mcp-remote.js",
  () => {
    class MockMcpRemote extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define("shadow-claw-settings-mcp-remote", MockMcpRemote);

    return { ShadowClawSettingsMcpRemote: MockMcpRemote };
  },
);

jest.unstable_mockModule(
  "../shadow-claw-settings-notifications/shadow-claw-settings-notifications.js",
  () => {
    class MockNotifications extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      render = jest.fn();
    }

    customElements.define(
      "shadow-claw-settings-notifications",
      MockNotifications,
    );

    return { ShadowClawSettingsNotifications: MockNotifications };
  },
);

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

// Global fetch is already mocked in jest-setup.ts

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

    const accounts = el.shadowRoot?.querySelector(
      "shadow-claw-settings-accounts",
    );
    const remoteMcp = el.shadowRoot?.querySelector(
      "shadow-claw-settings-mcp-remote",
    );
    const llm = el.shadowRoot?.querySelector("shadow-claw-settings-llm");
    const webvm = el.shadowRoot?.querySelector("shadow-claw-settings-webvm");
    const git = el.shadowRoot?.querySelector("shadow-claw-settings-git");
    const storage = el.shadowRoot?.querySelector(
      "shadow-claw-settings-storage",
    );

    expect(accounts).not.toBeNull();
    expect(remoteMcp).not.toBeNull();
    expect(llm).not.toBeNull();
    expect(webvm).not.toBeNull();
    expect(git).not.toBeNull();
    expect(storage).not.toBeNull();

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
