import { jest } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

jest.unstable_mockModule("../../effect.js", () => ({ effect: jest.fn() }));
jest.unstable_mockModule("../../markdown.js", () => ({
  renderMarkdown: jest.fn((value) => String(value)),
}));

jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
  fileViewerStore: {
    file: null,
    openFile: jest.fn(),
    closeFile: jest.fn(),
  },
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    currentPath: ".",
    _currentPath: { set: jest.fn() },
    activeGroupId: "test-group",
    loadFiles: jest.fn(),
  },
}));

jest.unstable_mockModule("../../storage/writeGroupFile.js", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/listGroupFiles.js", () => ({
  listGroupFiles: jest.fn(),
}));

jest.unstable_mockModule("../../toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

// Global fetch is already mocked in jest-setup.ts

const { ShadowClawFileViewer } = await import("./shadow-claw-file-viewer.js");
const { fileViewerStore } = await import("../../stores/file-viewer.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { listGroupFiles } = await import("../../storage/listGroupFiles.js");
const { renderMarkdown } = await import("../../markdown.js");

describe("shadow-claw-file-viewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (orchestratorStore.loadFiles as jest.Mock).mockImplementation(
      async () => undefined,
    );
    (listGroupFiles as jest.Mock).mockImplementation(async () => []);
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-file-viewer")).toBe(
      ShadowClawFileViewer,
    );
  });

  it("includes preview toggle in template", async () => {
    const template = await ShadowClawFileViewer.getTemplateSource();

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

  it("injects link interception bridge into html iframe srcdoc", () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: '<a href="docs/guide">Guide</a>',
    });

    expect(srcdoc).toContain("shadow-claw-file-viewer-link");
    expect(srcdoc).toContain("window.parent.postMessage");
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

  it("auto-previews html and svg files", () => {
    const component = new ShadowClawFileViewer();

    expect(
      component.shouldAutoPreview({
        name: "index.html",
        kind: "text",
        content: "<h1>Hello</h1>",
      }),
    ).toBe(true);

    expect(
      component.shouldAutoPreview({
        name: "icon.svg",
        kind: "text",
        content: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      }),
    ).toBe(true);
  });

  it("auto-previews pdf and binary files", () => {
    const component = new ShadowClawFileViewer();

    expect(
      component.shouldAutoPreview({
        name: "doc.pdf",
        kind: "pdf",
        content: "",
      }),
    ).toBe(true);

    expect(
      component.shouldAutoPreview({
        name: "photo.png",
        kind: "binary",
        content: "",
      }),
    ).toBe(true);
  });

  it("auto-previews markdown files", () => {
    const component = new ShadowClawFileViewer();

    expect(
      component.shouldAutoPreview({
        name: "notes.md",
        kind: "text",
        content: "# hello",
      }),
    ).toBe(true);
  });

  it("does not auto-preview plain text files", () => {
    const component = new ShadowClawFileViewer();

    expect(
      component.shouldAutoPreview({
        name: "notes.txt",
        kind: "text",
        content: "hello",
      }),
    ).toBe(false);
  });

  it("uses unsaved editor content for preview when editor is dirty", () => {
    const component = new ShadowClawFileViewer();
    component.isEditorDirty = true;

    const modal = document.createElement("div");
    const editor = document.createElement("textarea");
    editor.className = "file-editor";
    editor.value = "# unsaved";
    modal.appendChild(editor);

    const file = {
      name: "notes.md",
      kind: "text",
      content: "# saved",
    };

    expect(component.getPreviewSourceFile(file, modal)).toEqual({
      ...file,
      content: "# unsaved",
    });
  });

  it("reuses in-memory draft for preview when editor element is unavailable", () => {
    const component = new ShadowClawFileViewer();
    component.isEditorDirty = true;
    component.editorDraftContent = "# unsaved from draft";

    const modal = document.createElement("div");
    const file = {
      name: "notes.md",
      kind: "text",
      content: "# saved",
    };

    expect(component.getPreviewSourceFile(file, modal)).toEqual({
      ...file,
      content: "# unsaved from draft",
    });
  });

  it("sets caret-color on file-editor so cursor is visible over syntax-highlight overlay", async () => {
    const styles = await ShadowClawFileViewer.getStylesSource();

    expect(styles).toMatch(/\.file-editor\s*\{[^}]*caret-color\s*:/);
  });

  it("uses !important on caret-color to override highlighted-code inline style in dark mode", async () => {
    const styles = await ShadowClawFileViewer.getStylesSource();

    expect(styles).toMatch(
      /\.file-editor\s*\{[^}]*caret-color\s*:[^;]*!important/,
    );
  });

  it("ignores stale async preview renders after the opened file changes", async () => {
    let resolvePreview: any = null;
    const renderMarkdownMock = renderMarkdown as jest.MockedFunction<any>;
    renderMarkdownMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve;
        }),
    );

    const component = new ShadowClawFileViewer();
    const modal = document.createElement("div");
    modal.className = "file-modal";

    const content = document.createElement("div");
    content.className = "file-content";
    modal.appendChild(content);

    const previewButton = document.createElement("button");
    previewButton.className = "modal-preview-btn";
    modal.appendChild(previewButton);

    const body = document.createElement("div");
    body.className = "modal-body";
    modal.appendChild(body);

    const editButton = document.createElement("button");
    editButton.className = "modal-edit-btn";
    modal.appendChild(editButton);

    const saveButton = document.createElement("button");
    saveButton.className = "modal-save-btn";
    modal.appendChild(saveButton);

    const editorContainer = document.createElement("div");
    editorContainer.className = "file-editor-container";
    modal.appendChild(editorContainer);

    component.shadowRoot?.appendChild(modal);

    const file = {
      name: "notes.md",
      kind: "text",
      content: "# stale",
    };

    component.isFilePreviewMode = true;
    component.viewRenderToken = 1;
    (fileViewerStore as any).file = file;

    const updatePromise = component.updateView(1);

    component.viewRenderToken = 2;
    (fileViewerStore as any).file = {
      ...file,
      name: "other.md",
      content: "# current",
    };

    resolvePreview?.("<p>stale preview</p>");
    await updatePromise;

    expect(content.innerHTML).toBe("");
  });

  describe("workspace link resolution", () => {
    it("resolves relative links against the opened file directory", () => {
      const component = new ShadowClawFileViewer();

      expect(
        component.resolveWorkspaceLinkPath(
          "2026/2026-04.md",
          "weather/archive/index.md",
        ),
      ).toBe("weather/archive/2026/2026-04.md");
    });

    it("normalizes ./ and query/hash fragments", () => {
      const component = new ShadowClawFileViewer();

      expect(
        component.resolveWorkspaceLinkPath(
          "./daily/2026-04-22.md?raw=1#top",
          "weather/archive/index.md",
        ),
      ).toBe("weather/archive/daily/2026-04-22.md");
    });

    it("supports parent traversal within workspace root", () => {
      const component = new ShadowClawFileViewer();

      expect(
        component.resolveWorkspaceLinkPath(
          "../README.md",
          "weather/archive/index.md",
        ),
      ).toBe("weather/README.md");
    });

    it("rejects external and root-escape links", () => {
      const component = new ShadowClawFileViewer();

      expect(
        component.resolveWorkspaceLinkPath(
          "https://example.com/report.md",
          "weather/archive/index.md",
        ),
      ).toBeNull();

      expect(
        component.resolveWorkspaceLinkPath(
          "../../../../etc/passwd",
          "weather/archive/index.md",
        ),
      ).toBeNull();
    });

    it("navigates to folder view when extensionless path is not a file", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const openFileMock = fileViewerStore.openFile as jest.MockedFunction<any>;
      const closeFileMock = fileViewerStore.closeFile as jest.Mock;
      openFileMock.mockReset();
      closeFileMock.mockReset();

      const showPage = jest.fn();
      (window as any).shadowclaw = { ui: { showPage } };

      openFileMock.mockImplementationOnce(async () => {
        throw new DOMException("missing", "NotFoundError");
      });

      await component.openWorkspaceLink(
        "2026-04",
        "weather/archive/2026/index.md",
      );

      expect(openFileMock).toHaveBeenNthCalledWith(
        1,
        component.db,
        "weather/archive/2026/2026-04",
        "test-group",
      );
      expect(openFileMock).toHaveBeenNthCalledWith(
        1,
        component.db,
        "weather/archive/2026/2026-04",
        "test-group",
      );

      expect((orchestratorStore as any)._currentPath.set).toHaveBeenCalledWith(
        "weather/archive/2026/2026-04",
      );
      expect(listGroupFiles).toHaveBeenCalledWith(
        component.db,
        "test-group",
        "weather/archive/2026/2026-04",
      );
      expect(orchestratorStore.loadFiles).toHaveBeenCalledWith(component.db);
      expect(closeFileMock).toHaveBeenCalledTimes(1);
      expect(showPage).toHaveBeenCalledWith("files");
    });

    it("does not change current path when folder target does not exist", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const openFileMock = fileViewerStore.openFile as jest.MockedFunction<any>;
      openFileMock.mockReset();
      openFileMock.mockImplementationOnce(async () => {
        throw new DOMException("missing", "NotFoundError");
      });

      (listGroupFiles as jest.Mock).mockImplementationOnce(async () => {
        throw new DOMException("missing", "NotFoundError");
      });

      const setPathMock = (orchestratorStore as any)._currentPath
        .set as jest.Mock;
      setPathMock.mockReset();

      await component.openWorkspaceLink(
        "2026-04",
        "weather/archive/2026/index.md",
      );

      expect(setPathMock).not.toHaveBeenCalled();
      expect(orchestratorStore.loadFiles).not.toHaveBeenCalled();
    });

    it("opens extensionless files directly when they exist", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const openFileMock = fileViewerStore.openFile as jest.MockedFunction<any>;
      const closeFileMock = fileViewerStore.closeFile as jest.Mock;
      openFileMock.mockReset();
      closeFileMock.mockReset();
      openFileMock.mockResolvedValueOnce(undefined);

      await component.openWorkspaceLink(
        "2026-04",
        "weather/archive/2026/index.md",
      );

      expect(openFileMock).toHaveBeenCalledTimes(1);
      expect(orchestratorStore.loadFiles).not.toHaveBeenCalled();
      expect(closeFileMock).not.toHaveBeenCalled();
    });
  });
});
