import { jest } from "@jest/globals";

jest.unstable_mockModule("../effect.mjs", () => ({ effect: jest.fn() }));
jest.unstable_mockModule("../markdown.mjs", () => ({
  renderMarkdown: jest.fn((value) => String(value)),
}));

jest.unstable_mockModule("../stores/file-viewer.mjs", () => ({
  fileViewerStore: {
    file: null,
    closeFile: jest.fn(),
  },
}));

jest.unstable_mockModule("../stores/orchestrator.mjs", () => ({
  orchestratorStore: {
    currentPath: ".",
    activeGroupId: "test-group",
    loadFiles: jest.fn(),
  },
}));

jest.unstable_mockModule("../storage/writeGroupFile.mjs", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../toast.mjs", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

const { ShadowClawFileViewer } = await import("./shadow-claw-file-viewer.mjs");

describe("shadow-claw-file-viewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-file-viewer")).toBe(
      ShadowClawFileViewer,
    );
  });

  it("includes preview toggle in template", () => {
    const template = ShadowClawFileViewer.getTemplate();
    expect(template).toContain("modal-preview-btn");
    expect(template).toContain('aria-pressed="false"');
  });

  it("detects iframe preview file types", () => {
    const component = new ShadowClawFileViewer();

    expect(component.isIframePreviewFile("diagram.svg")).toBe(true);
    expect(component.isIframePreviewFile("index.html")).toBe(true);
    expect(component.isIframePreviewFile("index.htm")).toBe(true);
    expect(component.isIframePreviewFile("notes.md")).toBe(false);
  });

  it("builds iframe srcdoc for html files", () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: "<main>Hello</main>",
    });

    expect(srcdoc).toContain("<!doctype html>");
    expect(srcdoc).toContain('<base target="_blank">');
    expect(srcdoc).toContain("<main>Hello</main>");
  });

  it("returns raw svg content for iframe srcdoc", () => {
    const component = new ShadowClawFileViewer();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

    expect(
      component.buildIframePreviewSrcdoc({
        name: "diagram.svg",
        content: svg,
      }),
    ).toBe(svg);
  });

  it("includes allow-modals in iframe sandbox permissions", () => {
    const component = new ShadowClawFileViewer();

    expect(component.getIframeSandboxPermissions("index.html")).toContain(
      "allow-modals",
    );
    expect(component.getIframeSandboxPermissions("diagram.svg")).toContain(
      "allow-modals",
    );
  });
});
