import { jest } from "@jest/globals";

jest.unstable_mockModule("../../effect.js", () => ({ effect: jest.fn() }));
jest.unstable_mockModule("../../markdown.js", () => ({
  renderMarkdown: jest.fn((value) => String(value)),
}));

jest.unstable_mockModule("../../security/trusted-types.js", () => ({
  sanitizeSrcdocHtml: jest.fn((html: string) =>
    html.replace(/<script[\s\S]*?<\/script>/gi, ""),
  ),
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
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
    activeGroupId: "test-group",
    setCurrentPath: jest.fn(),
    loadFiles: jest.fn(),
  },
}));

jest.unstable_mockModule("../../storage/writeGroupFile.js", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

const { ShadowClawFileViewer } = await import("./shadow-claw-file-viewer.js");
const { fileViewerStore } = await import("../../stores/file-viewer.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { renderMarkdown } = await import("../../markdown.js");
const { setSanitizedHtml } = await import("../../security/trusted-types.js");

describe("shadow-claw-file-viewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (orchestratorStore.setCurrentPath as jest.Mock).mockImplementation(
      async () => undefined,
    );
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

  it("includes share button in template", async () => {
    const template = await ShadowClawFileViewer.getTemplateSource();

    expect(template).toContain("modal-share-btn");
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

  it("loads the reviewed link bridge from a same-origin script file", () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: '<a href="docs/guide">Guide</a>',
    });

    expect(srcdoc).toContain("/assets/file-viewer-preview-bridge.js");
    expect(srcdoc).not.toContain("window.parent.postMessage");
  });

  it("sanitizes active script content out of html iframe srcdoc bodies", () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: "<script>alert(1)</script><main>Hello</main>",
    });

    expect(srcdoc).toContain("<main>Hello</main>");
    expect(srcdoc).not.toContain("alert(1)");
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

  it("adds a nonce-based CSP meta tag to the html iframe srcdoc", () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: "<p>content</p>",
    });

    const cspMatch = srcdoc.match(
      /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
    );
    expect(cspMatch).not.toBeNull();
    const cspValue = cspMatch![1];
    expect(cspValue).toContain("script-src");

    const nonceMatch = cspValue.match(/nonce-([a-zA-Z0-9+/=]+)/);
    expect(nonceMatch).not.toBeNull();
    const nonce = nonceMatch![1];

    expect(srcdoc).toContain(`nonce="${nonce}"`);
    expect(srcdoc).toContain("/assets/file-viewer-preview-bridge.js");
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

  it("routes markdown preview HTML through the Trusted Types helper", async () => {
    const component = new ShadowClawFileViewer();
    const content = document.createElement("div");

    await component.renderPreview(content, {
      name: "notes.md",
      kind: "text",
      content: "# hello",
    });

    expect(setSanitizedHtml).toHaveBeenCalledWith(content, "# hello");
    expect(content.innerHTML).toBe("# hello");
  });

  it("requires canShare for binary file sharing", () => {
    const component = new ShadowClawFileViewer();

    Object.defineProperty(globalThis.navigator, "share", {
      value: jest.fn(),
      configurable: true,
    });
    Object.defineProperty(globalThis.navigator, "canShare", {
      value: jest.fn(() => true),
      configurable: true,
    });

    expect(
      component.canShareCurrentFile({
        name: "image.png",
        kind: "binary",
        mimeType: "image/png",
        binaryContent: new Uint8Array([1, 2, 3]),
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

  it("uses unsaved draft content for raw mode when editor is dirty", async () => {
    const component = new ShadowClawFileViewer();
    const modal = document.createElement("div");
    modal.className = "file-modal";

    const content = document.createElement("div");
    content.className = "file-content";
    modal.appendChild(content);

    const previewButton = document.createElement("button");
    previewButton.className = "modal-preview-btn";
    modal.appendChild(previewButton);

    const closeButton = document.createElement("button");
    closeButton.className = "modal-close-btn";
    modal.appendChild(closeButton);

    const body = document.createElement("div");
    body.className = "modal-body";
    modal.appendChild(body);

    const editButton = document.createElement("button");
    editButton.className = "modal-edit-btn";
    modal.appendChild(editButton);

    const saveButton = document.createElement("button");
    saveButton.className = "modal-save-btn";
    modal.appendChild(saveButton);

    const shareButton = document.createElement("button");
    shareButton.className = "modal-share-btn";
    modal.appendChild(shareButton);

    const editorContainer = document.createElement("div");
    editorContainer.className = "file-editor-container";
    modal.appendChild(editorContainer);

    component.shadowRoot?.appendChild(modal);

    component.isFilePreviewMode = false;
    component.isFileEditMode = false;
    component.isEditorDirty = true;
    component.editorDraftContent = "# unsaved raw draft";
    component.viewRenderToken = 1;

    (fileViewerStore as any).file = {
      name: "notes.md",
      kind: "text",
      content: "# saved content",
    };

    await component.updateView(1);

    expect(content.textContent).toBe("# unsaved raw draft");
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

  it("keeps the close button enabled while the current draft is unsaved", async () => {
    const component = new ShadowClawFileViewer();
    const modal = document.createElement("div");
    modal.className = "file-modal";

    const content = document.createElement("div");
    content.className = "file-content";
    modal.appendChild(content);

    const previewButton = document.createElement("button");
    previewButton.className = "modal-preview-btn";
    modal.appendChild(previewButton);

    const closeButton = document.createElement("button");
    closeButton.className = "modal-close-btn";
    modal.appendChild(closeButton);

    const body = document.createElement("div");
    body.className = "modal-body";
    modal.appendChild(body);

    const editButton = document.createElement("button");
    editButton.className = "modal-edit-btn";
    modal.appendChild(editButton);

    const saveButton = document.createElement("button");
    saveButton.className = "modal-save-btn";
    modal.appendChild(saveButton);

    const shareButton = document.createElement("button");
    shareButton.className = "modal-share-btn";
    modal.appendChild(shareButton);

    const editorContainer = document.createElement("div");
    editorContainer.className = "file-editor-container";
    modal.appendChild(editorContainer);

    component.shadowRoot?.appendChild(modal);

    component.isFileEditMode = true;
    component.isEditorDirty = true;
    component.editorDraftContent = "dirty draft";
    component.viewRenderToken = 1;

    (fileViewerStore as any).file = {
      name: "notes.md",
      kind: "text",
      content: "# saved",
    };

    await component.updateView(1);

    expect(closeButton.disabled).toBe(false);
    expect(closeButton.getAttribute("aria-label")).toBe(
      "Close file viewer (unsaved changes)",
    );
  });

  it("blocks close actions while the current draft is unsaved", async () => {
    const component = new ShadowClawFileViewer();
    const modal = document.createElement("dialog");
    modal.className = "file-modal";

    const closeButton = document.createElement("button");
    closeButton.className = "modal-close-btn";

    const previewButton = document.createElement("button");
    previewButton.className = "modal-preview-btn";

    const editButton = document.createElement("button");
    editButton.className = "modal-edit-btn";

    const saveButton = document.createElement("button");
    saveButton.className = "modal-save-btn";

    const body = document.createElement("div");
    body.className = "modal-body";

    const content = document.createElement("div");
    content.className = "file-content";

    const editorContainer = document.createElement("div");
    editorContainer.className = "file-editor-container";

    const editor = document.createElement("textarea");
    editor.className = "file-editor";
    editorContainer.appendChild(editor);

    component.shadowRoot?.append(
      modal,
      closeButton,
      previewButton,
      editButton,
      saveButton,
      body,
      content,
      editorContainer,
    );

    component.isEditorDirty = true;
    (fileViewerStore as any).file = {
      name: "notes.md",
      kind: "text",
      content: "# saved",
    };

    const appHost = document.createElement("shadow-claw") as any;
    appHost.requestDialog = jest.fn(async () => false);
    document.body.appendChild(appHost);

    const closeFileMock = fileViewerStore.closeFile as jest.Mock;
    closeFileMock.mockReset();

    component.bindEventListeners();

    closeButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(appHost.requestDialog).toHaveBeenCalledTimes(1);
    expect(closeFileMock).not.toHaveBeenCalled();

    const cancelEvent = new Event("cancel", { cancelable: true });
    modal.dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(appHost.requestDialog).toHaveBeenCalledTimes(2);
    expect(closeFileMock).not.toHaveBeenCalled();

    document.body.removeChild(appHost);
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

      expect(orchestratorStore.setCurrentPath).toHaveBeenCalledWith(
        component.db,
        "weather/archive/2026/2026-04",
      );
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

      (orchestratorStore.setCurrentPath as jest.Mock).mockImplementationOnce(
        async () => {
          throw new DOMException("missing", "NotFoundError");
        },
      );

      await component.openWorkspaceLink(
        "2026-04",
        "weather/archive/2026/index.md",
      );

      expect(orchestratorStore.setCurrentPath).toHaveBeenCalledTimes(1);
      expect(fileViewerStore.closeFile).not.toHaveBeenCalled();
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
      expect(orchestratorStore.setCurrentPath).not.toHaveBeenCalled();
      expect(closeFileMock).not.toHaveBeenCalled();
    });
  });
});
