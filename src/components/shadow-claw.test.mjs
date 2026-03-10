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
  orchestratorStore: { init: jest.fn(), setDb: jest.fn(), db: {} },
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

jest.unstable_mockModule("./shadow-claw-chat.mjs", () => ({}));
jest.unstable_mockModule("./shadow-claw-files.mjs", () => ({}));
jest.unstable_mockModule("./shadow-claw-pdf-viewer.mjs", () => ({}));
jest.unstable_mockModule("./shadow-claw-tasks.mjs", () => ({}));
jest.unstable_mockModule("./shadow-claw-toast.mjs", () => ({}));

const { ShadowClaw } = await import("./shadow-claw.mjs");

describe("shadow-claw", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw")).toBe(ShadowClaw);
  });

  it("includes preview toggle in file viewer modal", () => {
    const template = ShadowClaw.getTemplate();

    expect(template).toContain("modal-preview-btn");
    expect(template).toContain('aria-pressed="false"');
  });

  it("detects iframe preview file types", () => {
    const component = new ShadowClaw();

    expect(component.isIframePreviewFile("diagram.svg")).toBe(true);
    expect(component.isIframePreviewFile("index.html")).toBe(true);
    expect(component.isIframePreviewFile("index.htm")).toBe(true);
    expect(component.isIframePreviewFile("notes.md")).toBe(false);
  });

  it("builds iframe srcdoc for html files", () => {
    const component = new ShadowClaw();
    const srcdoc = component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: "<main>Hello</main>",
    });

    expect(srcdoc).toContain("<!doctype html>");
    expect(srcdoc).toContain('<base target="_blank">');
    expect(srcdoc).toContain("<main>Hello</main>");
  });

  it("returns raw svg content for iframe srcdoc", () => {
    const component = new ShadowClaw();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

    expect(
      component.buildIframePreviewSrcdoc({
        name: "diagram.svg",
        content: svg,
      }),
    ).toBe(svg);
  });
});
