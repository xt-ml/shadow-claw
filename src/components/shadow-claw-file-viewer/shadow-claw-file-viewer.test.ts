import { jest } from "@jest/globals";

jest.unstable_mockModule("../../core/effect.js", () => ({ effect: jest.fn() }));

jest.unstable_mockModule("../../content/markdown.js", () => ({
  renderMarkdown: jest.fn((value) => String(value)),
}));

jest.unstable_mockModule("../../security/trusted-types.js", () => ({
  sanitizeToTrustedHtml: jest.fn((html: string) => html),
  sanitizeSrcdocHtml: jest.fn((html: string) =>
    html.replace(/<script[\s\S]*?<\/script>/gi, ""),
  ),
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
  setTrustedSrcdoc: jest.fn((iframe: HTMLIFrameElement, html: string) => {
    iframe.srcdoc = html;

    return html;
  }),
  toTrustedScriptUrl: jest.fn((url: string) => url),
  toTrustedHtmlPresanitized: jest.fn((html: string) => html),
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

jest.unstable_mockModule("../../storage/readGroupFileBytes.js", () => ({
  readGroupFileBytes: jest.fn(),
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn(async () => ({})),
}));

jest.unstable_mockModule("highlight.js", () => ({
  default: {
    highlight: jest.fn(() => ({
      value: '<span class="hljs-keyword">const</span>',
    })),
    highlightAuto: jest.fn(() => ({
      value: '<span class="hljs-keyword">const</span>',
    })),
    getLanguage: jest.fn((lang: string) =>
      lang === "js" || lang === "ts" ? {} : null,
    ),
  },
}));

jest.unstable_mockModule("../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

const { ShadowClawFileViewer } = await import("./shadow-claw-file-viewer.js");
const { fileViewerStore } = await import("../../stores/file-viewer.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { renderMarkdown } = await import("../../content/markdown.js");
const { setSanitizedHtml, toTrustedHtmlPresanitized } =
  await import("../../security/trusted-types.js");
const { readGroupFileBytes } =
  await import("../../storage/readGroupFileBytes.js");
const { writeGroupFile } = await import("../../storage/writeGroupFile.js");
const { setAllowedCustomElementHostPatterns } =
  await import("../../security/custom-element-security.js");

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
    const template = await Promise.resolve(
      ShadowClawFileViewer.template.map((e: Element) => e.outerHTML).join(""),
    );

    expect(template).toContain("modal-preview-btn");

    expect(template).toContain('aria-pressed="false"');
  });

  it("includes fullscreen toggle in template", async () => {
    const template = await Promise.resolve(
      ShadowClawFileViewer.template.map((e: Element) => e.outerHTML).join(""),
    );

    expect(template).toContain("modal-fullscreen-btn");
    expect(template).toContain("Fullscreen");
  });

  it("includes share button in template", async () => {
    const template = await Promise.resolve(
      ShadowClawFileViewer.template.map((e: Element) => e.outerHTML).join(""),
    );

    expect(template).toContain("modal-share-btn");
  });

  it("uses local highlight theme css for editor syntax highlighting", async () => {
    const component = new ShadowClawFileViewer();

    await component.connectedCallback();

    expect(fetch).toHaveBeenCalledWith(
      "components/shadow-claw-file-viewer/highlightjs-atom-one-dark.min.css",
    );
  });

  it("uses toTrustedHtmlPresanitized for editor syntax highlight overlay", async () => {
    const component = new ShadowClawFileViewer();
    const shadowRoot = component.shadowRoot!;

    const editorContainer = document.createElement("div");
    editorContainer.className = "file-editor-container";

    const pre = document.createElement("pre");
    pre.className = "file-editor-overlay";
    const code = document.createElement("code");
    code.className = "hljs";
    pre.appendChild(code);
    editorContainer.appendChild(pre);

    const textarea = document.createElement("textarea");
    textarea.className = "file-editor";
    editorContainer.appendChild(textarea);

    const modal = document.createElement("div");
    modal.className = "file-modal";
    const modalBody = document.createElement("div");
    modalBody.className = "modal-body";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "modal-cancel-btn";
    const saveBtn = document.createElement("button");
    saveBtn.className = "modal-save-btn";
    const shareBtn = document.createElement("button");
    shareBtn.className = "modal-share-btn";
    const closeBtn = document.createElement("button");
    closeBtn.className = "modal-close-btn";
    const editBtn = document.createElement("button");
    editBtn.className = "modal-edit-btn";
    const previewBtn = document.createElement("button");
    previewBtn.className = "modal-preview-btn";
    modal.append(
      modalBody,
      cancelBtn,
      saveBtn,
      shareBtn,
      closeBtn,
      editBtn,
      previewBtn,
      editorContainer,
    );
    shadowRoot.replaceChildren(modal);

    (fileViewerStore as any).file = {
      name: "main.ts",
      kind: "text",
      content: "const x = 1;",
    };

    component.bindEventListeners();

    textarea.value = "const x = 1;";
    textarea.dispatchEvent(new Event("input"));

    expect(toTrustedHtmlPresanitized).toHaveBeenCalled();
  });

  it("applies markdown highlight styles when adoptedStyleSheets getter returns a copy", async () => {
    const component = new ShadowClawFileViewer();
    const root = component.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    let storedSheets: CSSStyleSheet[] = [];
    Object.defineProperty(root, "adoptedStyleSheets", {
      configurable: true,
      get() {
        // Safari-like behavior: reads return a copy, so mutating via push() is ignored.

        return [...storedSheets];
      },
      set(value: CSSStyleSheet[]) {
        storedSheets = [...value];
      },
    });

    await component.connectedCallback();

    expect(storedSheets.length).toBeGreaterThanOrEqual(2);
  });

  it("toggles fullscreen mode from the view mode button", () => {
    const component = new ShadowClawFileViewer();
    const modal = document.createElement("div");
    modal.className = "file-modal";

    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    modal.appendChild(modalContent);

    const fullscreenButton = document.createElement("button");
    fullscreenButton.className = "modal-fullscreen-btn";
    modal.appendChild(fullscreenButton);

    component.shadowRoot?.replaceChildren(modal);
    component.bindEventListeners();

    expect(component.isFullscreenMode).toBe(false);

    fullscreenButton.click();

    expect(component.isFullscreenMode).toBe(true);
    expect(modalContent.classList.contains("modal-content--fullscreen")).toBe(
      true,
    );
    expect(fullscreenButton.getAttribute("aria-pressed")).toBe("true");

    fullscreenButton.click();

    expect(component.isFullscreenMode).toBe(false);
    expect(modalContent.classList.contains("modal-content--fullscreen")).toBe(
      false,
    );
    expect(fullscreenButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("uses native Fullscreen API when available", async () => {
    const component = new ShadowClawFileViewer();
    const modal = document.createElement("div");
    modal.className = "file-modal";

    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    modal.appendChild(modalContent);

    const fullscreenButton = document.createElement("button");
    fullscreenButton.className = "modal-fullscreen-btn";
    modal.appendChild(fullscreenButton);

    const originalFullscreenEnabled = document.fullscreenEnabled;
    const originalFullscreenElement = document.fullscreenElement;
    const originalExitFullscreen = document.exitFullscreen;

    const requestFullscreen = jest.fn(async () => {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: modalContent,
      });
    });
    const exitFullscreen = jest.fn(async () => {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: null,
      });
    });

    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });
    (modalContent as any).requestFullscreen = requestFullscreen;

    await component.toggleFullscreenMode(modal);

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(component.isFullscreenMode).toBe(true);

    await component.toggleFullscreenMode(modal);

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(component.isFullscreenMode).toBe(false);

    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: originalFullscreenEnabled,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: originalFullscreenElement,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: originalExitFullscreen,
    });
  });

  it("exits native fullscreen when current fullscreen element is an ancestor", async () => {
    const component = new ShadowClawFileViewer();
    const modal = document.createElement("div");
    modal.className = "file-modal";

    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    modal.appendChild(modalContent);

    const fullscreenButton = document.createElement("button");
    fullscreenButton.className = "modal-fullscreen-btn";
    modal.appendChild(fullscreenButton);

    const isTargetInFullscreenSpy = jest
      .spyOn(component, "isTargetInFullscreen")
      .mockReturnValue(true);
    const canUseNativeFullscreenSpy = jest
      .spyOn(component, "canUseNativeFullscreen")
      .mockReturnValue(true as any);
    const requestNativeFullscreenSpy = jest
      .spyOn(component, "requestNativeFullscreen")
      .mockResolvedValue(undefined);
    const exitNativeFullscreenSpy = jest
      .spyOn(component, "exitNativeFullscreen")
      .mockResolvedValue(undefined);

    await component.toggleFullscreenMode(modal);

    expect(exitNativeFullscreenSpy).toHaveBeenCalledTimes(1);
    expect(requestNativeFullscreenSpy).not.toHaveBeenCalled();
    exitNativeFullscreenSpy.mockRestore();
    requestNativeFullscreenSpy.mockRestore();
    canUseNativeFullscreenSpy.mockRestore();
    isTargetInFullscreenSpy.mockRestore();
  });

  it("detects fullscreen when fullscreen element is the shadow host", () => {
    const component = new ShadowClawFileViewer();
    const modal = document.createElement("div");
    modal.className = "file-modal";

    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    modal.appendChild(modalContent);

    component.shadowRoot?.replaceChildren(modal);

    const getCurrentFullscreenElementSpy = jest
      .spyOn(component, "getCurrentFullscreenElement")
      .mockReturnValue(component);

    expect(component.isTargetInFullscreen(modalContent)).toBe(true);

    getCurrentFullscreenElementSpy.mockRestore();
  });

  it("exits fullscreen before closing viewer", async () => {
    const component = new ShadowClawFileViewer();
    const modal = document.createElement("div");
    modal.className = "file-modal";

    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    modal.appendChild(modalContent);

    component.shadowRoot?.replaceChildren(modal);

    const exitNativeFullscreenSpy = jest
      .spyOn(component, "exitNativeFullscreen")
      .mockResolvedValue(undefined);
    const isTargetInFullscreenSpy = jest
      .spyOn(component, "isTargetInFullscreen")
      .mockReturnValue(true);

    const closeFileMock = fileViewerStore.closeFile as jest.Mock;
    closeFileMock.mockReset();

    await component.requestCloseViewer();

    expect(exitNativeFullscreenSpy).toHaveBeenCalledTimes(1);
    expect(closeFileMock).toHaveBeenCalledTimes(1);
    expect(exitNativeFullscreenSpy.mock.invocationCallOrder[0]).toBeLessThan(
      closeFileMock.mock.invocationCallOrder[0],
    );

    isTargetInFullscreenSpy.mockRestore();
    exitNativeFullscreenSpy.mockRestore();
  });

  it("detects iframe preview file types", () => {
    const component = new ShadowClawFileViewer();

    expect(component.isIframePreviewFile("diagram.svg")).toBe(true);

    expect(component.isIframePreviewFile("index.html")).toBe(true);

    expect(component.isIframePreviewFile("index.htm")).toBe(true);

    expect(component.isIframePreviewFile("notes.md")).toBe(false);
  });

  it("builds iframe srcdoc for html files", async () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: "<main>Hello</main>",
    });

    expect(srcdoc).toContain("<!doctype html>");

    expect(srcdoc).toContain(
      '<base href="/files/test-group/" target="_blank">',
    );

    expect(srcdoc).toContain("<main>Hello</main>");
  });

  it("strips YAML frontmatter from html file previews", async () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: [
        "---",
        'title: "Welcome"',
        'slug: "welcome"',
        "---",
        "<main>Hello</main>",
      ].join("\n"),
    });

    expect(srcdoc).toContain("<main>Hello</main>");
    expect(srcdoc).not.toContain('title: "Welcome"');
    expect(srcdoc).not.toContain('slug: "welcome"');
  });

  it("injects link, font, and theme styles into iframe preview srcdoc to prevent FOUC", async () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: "<main>Hello</main>",
    });

    expect(srcdoc).toContain("a {");
    expect(srcdoc).toContain("color: var(--shadow-claw-link);");
    expect(srcdoc).toContain("text-decoration: underline;");
    expect(srcdoc).toContain("text-underline-offset: 0.125rem;");
    expect(srcdoc).toContain("a:hover {");
    expect(srcdoc).toContain("color: var(--shadow-claw-link-hover);");
    expect(srcdoc).toContain("body {");
    expect(srcdoc).toContain("color: var(--shadow-claw-text-primary);");
    expect(srcdoc).toContain("font-family: var(--shadow-claw-font-sans);");
    expect(srcdoc).toContain("pre, code, kbd, samp {");
    expect(srcdoc).toContain("font-family: var(--shadow-claw-font-mono);");
  });

  it("updates iframe height when receiving shadow-claw-iframe-resize message", () => {
    const component = new ShadowClawFileViewer();
    (component as any).db = {};

    const iframe = document.createElement("iframe");
    iframe.className = "file-content-iframe";
    const fakeWindow = {} as Window;
    component.previewFrameWindow = fakeWindow;

    const root =
      component.shadowRoot || component.attachShadow({ mode: "open" });
    root.appendChild(iframe);

    component.handleIframeMessage({
      data: { type: "shadow-claw-iframe-resize", height: 920 },
      source: fakeWindow,
    } as MessageEvent);

    expect(iframe.style.height).toBe("920px");
  });

  it("inlines relative html preview images as data URLs", async () => {
    const component = new ShadowClawFileViewer();
    (component as any).db = {};

    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValueOnce(new Uint8Array([255, 216, 255, 217]));

    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      path: "docs/index.html",
      content: '<main><img src="pic.jpg" /></main>',
    });

    expect(srcdoc).toContain('src="data:image/jpeg;base64,');
    expect(readGroupFileBytes).toHaveBeenCalledWith(
      {},
      "test-group",
      "docs/pic.jpg",
    );
  });

  it("loads the reviewed link bridge from a same-origin script file", async () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: '<a href="docs/guide">Guide</a>',
    });

    expect(srcdoc).toContain("/assets/file-viewer-preview-bridge.js");
    expect(srcdoc).not.toContain("window.parent.postMessage");
  });

  it("keeps same-origin external application links (e.g. block-garden) untouched in html iframe srcdoc", async () => {
    const component = new ShadowClawFileViewer();
    const origin = window.location.origin;
    const externalLink = `${origin}/block-garden/?gettingStarted=false`;
    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      path: "docs/index.html",
      content: `<a href="${externalLink}">Block Garden</a>`,
    });

    expect(srcdoc).toContain("/block-garden/?gettingStarted=false");
  });

  it("opens same-origin external application links in a new window via handleIframeMessage", () => {
    const windowOpenSpy = jest
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const component = new ShadowClawFileViewer();
    component.db = {} as any;

    const origin = window.location.origin;
    const targetUrl = `${origin}/block-garden/?gettingStarted=false`;

    component.handleIframeMessage({
      data: { type: "shadow-claw-file-viewer-link", href: targetUrl },
      source: null,
    } as MessageEvent);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      targetUrl,
      "_blank",
      "noopener,noreferrer",
    );
    windowOpenSpy.mockRestore();
  });

  it("sanitizes active script content out of html iframe srcdoc bodies", async () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      content: "<script>alert(1)</script><main>Hello</main>",
    });

    expect(srcdoc).toContain("<main>Hello</main>");
    expect(srcdoc).not.toContain("alert(1)");
  });

  it("sets allow='fullscreen' and omits allowfullscreen on HTML iframe previews", async () => {
    const component = new ShadowClawFileViewer();
    const content = document.createElement("div");

    await component.renderPreview(content, {
      kind: "text",
      name: "index.html",
      path: "docs/index.html",
      content: "<h1>Test</h1>",
    });

    const iframe = content.querySelector("iframe");
    expect(iframe).toBeInstanceOf(HTMLIFrameElement);
    expect(iframe?.getAttribute("allow")).toBe("fullscreen");
    expect(iframe?.hasAttribute("allowfullscreen")).toBe(false);
  });

  it("inlines relative markdown preview images as data URLs", async () => {
    const component = new ShadowClawFileViewer();
    (component as any).db = {};

    const content = document.createElement("div");
    (
      renderMarkdown as jest.MockedFunction<typeof renderMarkdown>
    ).mockResolvedValueOnce('<p><img src="pic.jpg" /></p>');
    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValueOnce(new Uint8Array([137, 80, 78, 71]));

    await component.renderPreview(content, {
      kind: "text",
      name: "MEMORY.md",
      path: "docs/MEMORY.md",
      content: "![pic](pic.jpg)",
    });

    const img = content.querySelector("img");
    expect(img).toBeInstanceOf(HTMLImageElement);
    expect((img as HTMLImageElement).getAttribute("src")).toMatch(
      /^data:image\/jpeg;base64,/u,
    );
  });

  it("returns raw svg content for iframe srcdoc", async () => {
    const component = new ShadowClawFileViewer();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

    expect(
      await component.buildIframePreviewSrcdoc({
        name: "diagram.svg",
        content: svg,
      }),
    ).toBe(svg);
  });

  it("adds a nonce-based CSP meta tag to the html iframe srcdoc", async () => {
    const component = new ShadowClawFileViewer();
    const srcdoc = await component.buildIframePreviewSrcdoc({
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

  it("injects site config, theme stylesheet, and approved custom element scripts into html iframe srcdoc when configured", async () => {
    const component = new ShadowClawFileViewer();
    setAllowedCustomElementHostPatterns(["kherrick.github.io"]);
    const configScript = document.createElement("script");
    configScript.id = "shadow-claw-site-config";
    configScript.type = "application/json";
    configScript.textContent = JSON.stringify({
      customElements: {
        scripts: [
          "pages/main/block-garden-adapter.js",
          "https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs",
        ],
      },
    });
    document.head.appendChild(configScript);

    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      path: "pages/main/index.html",
      content: "<block-garden></block-garden>",
    });

    expect(srcdoc).toContain('<link rel="stylesheet" href="/theme.css">');
    expect(srcdoc).toContain('id="shadow-claw-site-config"');
    expect(srcdoc).toContain('src="/block-garden-adapter.js"');
    expect(srcdoc).toContain(
      'src="https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs"',
    );

    document.head.removeChild(configScript);
    setAllowedCustomElementHostPatterns([]);
  });

  it("rewrites relative image src to /files routes in html iframe srcdoc", async () => {
    const component = new ShadowClawFileViewer();
    component.db = {} as any;

    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValueOnce(new Uint8Array([255, 216, 255, 217]));

    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      path: "docs/index.html",
      content: '<img src="assets/banner.png" alt="banner">',
    });

    expect(readGroupFileBytes).toHaveBeenCalledWith(
      {},
      "test-group",
      "docs/assets/banner.png",
    );
    expect(srcdoc).toContain('src="data:image/png;base64,');
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

  it("does not include allow-same-origin for html iframe previews", () => {
    const viewer = new ShadowClawFileViewer();

    expect(viewer.getIframeSandboxPermissions("test.html")).not.toContain(
      "allow-same-origin",
    );
    expect(viewer.getIframeSandboxPermissions("test.html")).toContain(
      "allow-scripts",
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

    expect(setSanitizedHtml).toHaveBeenCalledWith(
      content,
      "# hello",
      expect.objectContaining({
        ALLOWED_URI_REGEXP: expect.any(RegExp),
      }),
    );
    expect(content.innerHTML).toBe("# hello");
  });

  it("rewrites markdown relative image src before inserting preview HTML", async () => {
    const component = new ShadowClawFileViewer();
    component.db = {} as any;

    const renderMarkdownMock = renderMarkdown as jest.MockedFunction<any>;
    renderMarkdownMock.mockResolvedValueOnce(
      '<p><img src="assets/image.jpg" alt="example"></p>',
    );
    (
      readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
    ).mockResolvedValueOnce(new Uint8Array([255, 216, 255, 217]));

    const content = document.createElement("div");
    (fileViewerStore as any).file = {
      name: "notes.md",
      path: "docs/notes.md",
      kind: "text",
      content: "![example](assets/image.jpg)",
    };

    await component.renderPreview(content, {
      name: "notes.md",
      path: "docs/notes.md",
      kind: "text",
      content: "![example](assets/image.jpg)",
    });

    expect(readGroupFileBytes).toHaveBeenCalledWith(
      {},
      "test-group",
      "docs/assets/image.jpg",
    );
    expect(setSanitizedHtml).toHaveBeenCalledWith(
      content,
      '<p><img src="/files/test-group/docs/assets/image.jpg" alt="example"></p>',
      expect.objectContaining({
        ALLOWED_URI_REGEXP: expect.any(RegExp),
      }),
    );
    expect(
      (content.querySelector("img") as HTMLImageElement).getAttribute("src"),
    ).toMatch(/^data:image\/jpeg;base64,/u);
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

    component.shadowRoot?.replaceChildren(modal);

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
    const styles = await Promise.resolve(
      (ShadowClawFileViewer.styles as any).cssText ?? "",
    );

    expect(styles).toMatch(/\.file-editor\s*\{[^}]*caret-color\s*:/);
  });

  it("uses !important on caret-color so cursor remains light over the dark hljs overlay", async () => {
    const styles = await Promise.resolve(
      (ShadowClawFileViewer.styles as any).cssText ?? "",
    );

    expect(styles).toMatch(
      /\.file-editor\s*\{[^}]*caret-color\s*:[^;]*!important/,
    );
  });

  it("hides cancel/save text labels on compact screens", async () => {
    const styles = await Promise.resolve(
      (ShadowClawFileViewer.styles as any).cssText ?? "",
    );

    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*\.modal-cancel-btn \.btn-label,[\s\S]*\.modal-save-btn \.btn-label[\s\S]*display:\s*none/,
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

    component.shadowRoot?.replaceChildren(modal);

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

    component.shadowRoot?.replaceChildren(modal);

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

    component.shadowRoot?.replaceChildren(
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

  it("dispatches shadow-claw-file-saved with the saved path and group id after a successful save", async () => {
    const component = new ShadowClawFileViewer();
    component.db = {} as any;

    const editor = document.createElement("textarea");
    editor.className = "file-editor";
    editor.value = "# updated content";

    const saveBtn = document.createElement("button");
    saveBtn.className = "modal-save-btn";

    component.shadowRoot?.replaceChildren(editor, saveBtn);

    (fileViewerStore as any).file = {
      name: "page.md",
      path: "page.md",
      kind: "text",
      content: "# original content",
    };

    const savedListener = jest.fn();
    document.addEventListener("shadow-claw-file-saved", savedListener);

    await component.handleSave();

    expect(writeGroupFile).toHaveBeenCalledWith(
      component.db,
      "test-group",
      "page.md",
      "# updated content",
    );
    expect(savedListener).toHaveBeenCalledTimes(1);
    const event = savedListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ groupId: "test-group", path: "page.md" });

    document.removeEventListener("shadow-claw-file-saved", savedListener);
  });

  it("saves a Pages-opened file using its full workspace path", async () => {
    const component = new ShadowClawFileViewer();
    component.db = {} as any;

    const editor = document.createElement("textarea");
    editor.className = "file-editor";
    editor.value = "# updated article";

    const saveBtn = document.createElement("button");
    saveBtn.className = "modal-save-btn";

    component.shadowRoot?.replaceChildren(editor, saveBtn);

    (fileViewerStore as any).file = {
      name: "article.html",
      path: "~/docs/example/article.html",
      groupId: "conversation-2",
      kind: "text",
      content: "<h2>Article</h2>",
    };
    (orchestratorStore as any).currentPath = ".";

    await component.handleSave();

    expect(writeGroupFile).toHaveBeenCalledWith(
      component.db,
      "conversation-2",
      "~/docs/example/article.html",
      "# updated article",
    );
  });

  describe("workspace link resolution", () => {
    it("navigates same-folder markdown links via route URL", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const navigate = jest.fn();
      Object.defineProperty(window as any, "navigation", {
        configurable: true,
        value: { navigate },
      });

      (fileViewerStore as any).file = {
        path: "docs/index.md",
        name: "index.md",
        kind: "text",
        content: "# index",
      };

      const body = document.createElement("div");
      const link = document.createElement("a");
      link.setAttribute("href", "test.md");
      body.appendChild(link);

      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      Object.defineProperty(event, "target", {
        configurable: true,
        value: link,
      });

      await component.handlePreviewLinkClick(event);

      expect(event.defaultPrevented).toBe(true);
      expect(navigate).toHaveBeenCalledWith("/files/test-group/docs/test.md");
    });

    it("navigates sibling-folder markdown links via route URL", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const navigate = jest.fn();
      Object.defineProperty(window as any, "navigation", {
        configurable: true,
        value: { navigate },
      });

      (fileViewerStore as any).file = {
        path: "docs/index.md",
        name: "index.md",
        kind: "text",
        content: "# index",
      };

      const body = document.createElement("div");
      const link = document.createElement("a");
      link.setAttribute("href", "./folder1/test2.md");
      body.appendChild(link);

      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      Object.defineProperty(event, "target", {
        configurable: true,
        value: link,
      });

      await component.handlePreviewLinkClick(event);

      expect(event.defaultPrevented).toBe(true);
      expect(navigate).toHaveBeenCalledWith(
        "/files/test-group/docs/folder1/test2.md",
      );
    });

    it("navigates legacy hash links through the browser route", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const navigate = jest.fn();
      Object.defineProperty(window as any, "navigation", {
        configurable: true,
        value: { navigate },
      });

      const body = document.createElement("div");
      const link = document.createElement("a");
      link.setAttribute("href", "/#Pages?path=docs/linked.md");
      body.appendChild(link);

      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      Object.defineProperty(event, "target", {
        configurable: true,
        value: link,
      });

      await component.handlePreviewLinkClick(event);

      expect(event.defaultPrevented).toBe(true);
      expect(navigate).toHaveBeenCalledWith("/#Pages?path=docs/linked.md");
    });

    it("navigates relative image link in root via route URL", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const navigate = jest.fn();
      Object.defineProperty(window as any, "navigation", {
        configurable: true,
        value: { navigate },
      });

      (fileViewerStore as any).file = {
        path: "index.md",
        name: "index.md",
        kind: "text",
        content: "# index",
      };

      const body = document.createElement("div");
      const link = document.createElement("a");
      link.setAttribute("href", "01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg");
      body.appendChild(link);

      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      Object.defineProperty(event, "target", {
        configurable: true,
        value: link,
      });

      await component.handlePreviewLinkClick(event);

      expect(event.defaultPrevented).toBe(true);
      expect(navigate).toHaveBeenCalledWith(
        "/files/test-group/01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg",
      );
    });

    it("rewrites relative asset hrefs in markdown preview HTML", () => {
      const component = new ShadowClawFileViewer();
      const inputHtml =
        '<p><a href="01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg">image</a></p>';
      const rewritten = component.rewriteWorkspacePreviewHtml(
        inputHtml,
        "index.md",
      );
      expect(rewritten).toContain(
        'href="/files/test-group/01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg"',
      );
    });

    it("rewrites relative asset hrefs when subpath base path is active", () => {
      document.querySelectorAll("base").forEach((el) => el.remove());
      const baseEl = document.createElement("base");
      baseEl.setAttribute("href", "/shadow-claw/");
      document.head.appendChild(baseEl);
      (globalThis as any).__applyBasePathCacheReset?.();

      try {
        const component = new ShadowClawFileViewer();
        const inputHtml =
          '<p><a href="01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg">image</a></p>';
        const rewritten = component.rewriteWorkspacePreviewHtml(
          inputHtml,
          "index.md",
        );
        expect(rewritten).toContain(
          'href="/shadow-claw/files/test-group/01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg"',
        );
      } finally {
        baseEl.remove();
        (globalThis as any).__applyBasePathCacheReset?.();
      }
    });

    it("bindEventListeners delegates clicks within .file-content to handlePreviewLinkClick", () => {
      const component = new ShadowClawFileViewer();
      const root = document.createElement("div");
      const content = document.createElement("div");
      content.className = "file-content";
      const link = document.createElement("a");
      link.setAttribute("href", "01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg");
      content.appendChild(link);
      root.appendChild(content);
      Object.defineProperty(component, "shadowRoot", {
        configurable: true,
        value: root,
      });

      const spy = jest
        .spyOn(component, "handlePreviewLinkClick")
        .mockImplementation(async () => {});

      component.bindEventListeners();

      link.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

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

  describe("resolveMarkdownImages", () => {
    beforeEach(() => {
      (readGroupFileBytes as jest.Mock).mockReset();
      URL.createObjectURL = jest.fn(() => "blob:fake");
      URL.revokeObjectURL = jest.fn();
    });

    it("replaces relative image src with a data URL loaded from OPFS", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const pngBytes = new Uint8Array([137, 80, 78, 71]);
      (
        readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
      ).mockResolvedValue(pngBytes);

      const container = document.createElement("div");
      const img = document.createElement("img");
      img.src = "assets/image.png";
      container.appendChild(img);

      await component.resolveMarkdownImages(container, "docs/notes.md");

      expect(readGroupFileBytes).toHaveBeenCalledWith(
        component.db,
        "test-group",
        "docs/assets/image.png",
      );
      expect(img.src).toBe("data:image/png;base64,iVBORw==");
    });

    it("leaves absolute and data URIs unchanged", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const container = document.createElement("div");

      const absImg = document.createElement("img");
      absImg.setAttribute("src", "https://example.com/logo.png");
      container.appendChild(absImg);

      const dataImg = document.createElement("img");
      dataImg.setAttribute("src", "data:image/png;base64,abc");
      container.appendChild(dataImg);

      await component.resolveMarkdownImages(container, "notes.md");

      expect(readGroupFileBytes).not.toHaveBeenCalled();
    });

    it("silently skips images whose file cannot be found", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      (
        readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
      ).mockRejectedValue(new DOMException("not found", "NotFoundError"));

      const container = document.createElement("div");
      const img = document.createElement("img");
      img.setAttribute("src", "missing.jpg");
      container.appendChild(img);

      await expect(
        component.resolveMarkdownImages(container, "notes.md"),
      ).resolves.toBeUndefined();

      expect(img.getAttribute("src")).toBe("missing.jpg");
    });

    it("resolves workspace-route markdown image variants", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      (
        readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
      ).mockResolvedValue(new Uint8Array([255, 216, 255, 217]));

      const container = document.createElement("div");
      const aImg = document.createElement("img");
      aImg.setAttribute("src", "/files/test-group/pic.jpg");
      const dImg = document.createElement("img");
      dImg.setAttribute("src", "./files/test-group/pic.jpg");
      const eImg = document.createElement("img");
      eImg.setAttribute("src", "files/test-group/pic.jpg");
      container.append(aImg, dImg, eImg);

      await component.resolveMarkdownImages(container, "docs/notes.md");

      expect(readGroupFileBytes).toHaveBeenNthCalledWith(
        1,
        component.db,
        "test-group",
        "pic.jpg",
      );
      expect(readGroupFileBytes).toHaveBeenNthCalledWith(
        2,
        component.db,
        "test-group",
        "pic.jpg",
      );
      expect(readGroupFileBytes).toHaveBeenNthCalledWith(
        3,
        component.db,
        "test-group",
        "pic.jpg",
      );
      expect(aImg.getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/u);
      expect(dImg.getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/u);
      expect(eImg.getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/u);
    });

    it("resolves workspace-route aliases for colon-form active group ids", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const previousGroupId = (orchestratorStore as any).activeGroupId;
      (orchestratorStore as any).activeGroupId = "br:main";

      (readGroupFileBytes as jest.Mock).mockClear();

      (
        readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
      ).mockResolvedValue(new Uint8Array([255, 216, 255, 217]));

      const container = document.createElement("div");
      const aImg = document.createElement("img");
      aImg.setAttribute("src", "/files/main/pic.jpg");
      const dImg = document.createElement("img");
      dImg.setAttribute("src", "./files/main/pic.jpg");
      const eImg = document.createElement("img");
      eImg.setAttribute("src", "files/main/pic.jpg");
      container.append(aImg, dImg, eImg);

      await component.resolveMarkdownImages(container, "docs/notes.md");

      expect(readGroupFileBytes).toHaveBeenNthCalledWith(
        1,
        component.db,
        "br:main",
        "pic.jpg",
      );
      expect(readGroupFileBytes).toHaveBeenNthCalledWith(
        2,
        component.db,
        "br:main",
        "pic.jpg",
      );
      expect(readGroupFileBytes).toHaveBeenNthCalledWith(
        3,
        component.db,
        "br:main",
        "pic.jpg",
      );

      (orchestratorStore as any).activeGroupId = previousGroupId;
    });

    it("resolves nested cross-group /files route image targets", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      const previousGroupId = (orchestratorStore as any).activeGroupId;
      const previousGroups = (orchestratorStore as any).groups;
      (orchestratorStore as any).activeGroupId =
        "br:01KT4NGEM3T94M0FGHJYVNGS7M";
      (orchestratorStore as any).groups = [
        { groupId: "br:01KT4NGEM3T94M0FGHJYVNGS7M" },
        { groupId: "br:main" },
      ];

      (
        readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
      ).mockResolvedValue(new Uint8Array([255, 216, 255, 217]));

      const container = document.createElement("div");
      const img = document.createElement("img");
      const origin = window.location.origin;
      img.setAttribute(
        "src",
        `${origin}/files/br%3A01KT4NGEM3T94M0FGHJYVNGS7M/files/main/pic.jpg`,
      );
      container.appendChild(img);

      await component.resolveMarkdownImages(container, "docs/notes.md");

      expect(readGroupFileBytes).toHaveBeenCalledWith(
        component.db,
        "br:main",
        "pic.jpg",
      );

      (orchestratorStore as any).activeGroupId = previousGroupId;
      (orchestratorStore as any).groups = previousGroups;
    });

    it("revokes all image object URLs when revokeObjectUrl is called", () => {
      const component = new ShadowClawFileViewer();
      component.currentImageObjectUrls = ["blob:a", "blob:b"];

      component.revokeObjectUrl();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:b");
      expect(component.currentImageObjectUrls).toHaveLength(0);
    });
  });

  describe("resolveRelativeImagesInHtml", () => {
    beforeEach(() => {
      (readGroupFileBytes as jest.Mock).mockReset();
      URL.createObjectURL = jest.fn(() => "blob:fake-html");
    });

    it("parses html for image resolution without using trusted sink helpers", async () => {
      const component = new ShadowClawFileViewer();
      component.db = {} as any;

      (
        readGroupFileBytes as jest.MockedFunction<typeof readGroupFileBytes>
      ).mockResolvedValue(new Uint8Array([137, 80, 78, 71]));

      const html = '<main><img src="assets/banner.png"></main>';
      const resolved = await component.resolveRelativeImagesInHtml(
        html,
        "docs/page.html",
      );

      // DOMParser parsing is an inert read/transform step; sinks are sanitized elsewhere.
      expect(setSanitizedHtml).not.toHaveBeenCalled();
      expect(resolved).toContain("data:image/png;base64,iVBORw==");
    });
  });

  describe("syncIframeTheme & storage proxy bridge", () => {
    it("syncs theme and custom properties to previewFrameWindow", () => {
      const component = new ShadowClawFileViewer() as any;
      const mockPostMessage = jest.fn();
      component.previewFrameWindow = { postMessage: mockPostMessage };

      component.syncIframeTheme();

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-theme-update",
          theme: expect.any(String),
          customProperties: expect.any(Object),
        }),
        "*",
      );
    });

    it("handles storage proxy requests (setItem, removeItem, getAllItems, idb-put, idb-get)", async () => {
      const component = new ShadowClawFileViewer() as any;
      const mockSource = { postMessage: jest.fn() };

      (fileViewerStore as any).file = { path: "demo.html", name: "demo.html" };

      // 1. setItem
      await component.handleStorageProxyRequest(
        mockSource,
        "req-1",
        "setItem",
        {
          key: "pref",
          value: "dark",
        },
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-1",
          result: null,
        }),
        "*",
      );

      // 2. idb-put
      await component.handleStorageProxyRequest(
        mockSource,
        "req-2",
        "idb-put",
        {
          dbName: "test-db",
          storeName: "items",
          key: "k1",
          value: { foo: "bar" },
        },
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-2",
          result: "k1",
        }),
        "*",
      );

      // 3. Unknown method sends error
      await component.handleStorageProxyRequest(
        mockSource,
        "req-3",
        "unknownMethod",
        {},
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-3",
          error: expect.stringContaining("Unknown storage proxy method"),
        }),
        "*",
      );
    });

    it("builds web share File instances from native files and binary buffers", () => {
      const component = new ShadowClawFileViewer() as any;

      const native = new File(["content"], "test.txt", {
        type: "text/plain",
      });
      expect(component.buildWebShareFile({ nativeFile: native })).toBe(native);

      const binaryFile = component.buildWebShareFile({
        name: "data.bin",
        binaryContent: new Uint8Array([1, 2, 3]),
        mimeType: "application/octet-stream",
      });
      expect(binaryFile).toBeInstanceOf(File);
      expect(binaryFile.name).toBe("data.bin");

      expect(component.buildWebShareFile(null)).toBeNull();
      expect(component.buildWebShareFile({ binaryContent: null })).toBeNull();
      expect(
        component.buildWebShareFile({ binaryContent: new Uint8Array([]) }),
      ).toBeNull();
    });

    it("cleans up resources and disconnects observers on disconnectedCallback", () => {
      const component = new ShadowClawFileViewer() as any;
      const disposeMock = jest.fn();
      component.broadcastProxy = { dispose: disposeMock };
      const disconnectMock = jest.fn();
      component.themeObserver = { disconnect: disconnectMock };
      const revokeMock = jest.spyOn(component, "revokeObjectUrl");

      component.disconnectedCallback();

      expect(disposeMock).toHaveBeenCalledTimes(1);
      expect(component.broadcastProxy).toBeNull();
      expect(disconnectMock).toHaveBeenCalledTimes(1);
      expect(component.themeObserver).toBeNull();
      expect(revokeMock).toHaveBeenCalledTimes(1);
    });

    it("synchronizes iframe theme with document dark/light mode class", () => {
      const component = new ShadowClawFileViewer() as any;
      const mockPostMessage = jest.fn();
      component.previewFrameWindow = { postMessage: mockPostMessage };

      document.documentElement.className = "dark-theme";
      component.syncIframeTheme();

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-theme-update",
        }),
        "*",
      );
    });

    it("handles openFolderInFilesView, openWorkspaceLink, and viewer dismissal", async () => {
      const component = new ShadowClawFileViewer() as any;
      component.db = {} as any;

      // 1. openFolderInFilesView
      await component.openFolderInFilesView("docs/subfolder/");
      expect(orchestratorStore.setCurrentPath).toHaveBeenCalledWith(
        component.db,
        "docs/subfolder",
      );
      expect(fileViewerStore.closeFile).toHaveBeenCalled();

      // 2. openWorkspaceLink with extension
      await component.openWorkspaceLink("notes.txt", "docs");
      expect(fileViewerStore.openFile).toHaveBeenCalledWith(
        component.db,
        expect.any(String),
        expect.any(String),
      );

      // 3. canDismissViewer when not dirty
      component.isDirty = false;
      const canDismiss = await component.canDismissViewer();
      expect(canDismiss).toBe(true);

      // 4. canDismissViewer when dirty
      component.isDirty = true;
      component.requestConfirmation = jest.fn<any>().mockResolvedValue(true);
      const canDismissDirty = await component.canDismissViewer();
      expect(canDismissDirty).toBe(true);

      // 5. requestCloseViewer
      component.isDirty = false;
      const closed = await component.requestCloseViewer();
      expect(closed).toBe(true);
      expect(fileViewerStore.closeFile).toHaveBeenCalled();
    });

    it("handles handleSave, handleShareFile, and toggleFullscreenMode", async () => {
      const { ShadowClawFileViewer } =
        await import("./shadow-claw-file-viewer.js");
      const { writeGroupFile } =
        await import("../../storage/writeGroupFile.js");

      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);
      component.db = {} as any;

      // 1. handleSave
      (fileViewerStore as any).file = {
        name: "test.txt",
        path: "docs/test.txt",
        kind: "text",
        content: "old content",
        groupId: "g1",
      };
      let editor = component.shadowRoot?.querySelector(".file-editor");
      if (!editor) {
        editor = document.createElement("textarea");
        editor.className = "file-editor";
        component.shadowRoot?.appendChild(editor);
      }
      editor.value = "new content";

      await component.handleSave();
      expect(writeGroupFile).toHaveBeenCalledWith(
        component.db,
        "g1",
        "docs/test.txt",
        "new content",
      );

      // 2. handleShareFile
      const mockShare = jest.fn<any>().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", {
        value: mockShare,
        configurable: true,
        writable: true,
      });
      await component.handleShareFile();
      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({ title: "test.txt" }),
      );

      // 3. renderBinaryPreview - empty
      const contentEl = document.createElement("div");
      component.renderBinaryPreview(contentEl, {
        name: "empty.bin",
        mimeType: "application/octet-stream",
        binaryContent: new Uint8Array(0),
      });
      expect(contentEl.textContent).toBe("Binary content unavailable.");

      // 4. renderBinaryPreview - image
      (global.URL.createObjectURL as any) = jest
        .fn<any>()
        .mockReturnValue("blob:image-url");
      component.renderBinaryPreview(contentEl, {
        name: "img.jpg",
        mimeType: "image/jpeg",
        binaryContent: new Uint8Array([1, 2, 3]),
      });
      expect(contentEl.querySelector("img")).not.toBeNull();

      // 5. renderBinaryPreview - video
      component.renderBinaryPreview(contentEl, {
        name: "clip.mp4",
        mimeType: "video/mp4",
        binaryContent: new Uint8Array([1, 2, 3]),
      });
      expect(contentEl.querySelector("video")).not.toBeNull();

      // 6. renderBinaryPreview - audio
      component.renderBinaryPreview(contentEl, {
        name: "song.mp3",
        mimeType: "audio/mp3",
        binaryContent: new Uint8Array([1, 2, 3]),
      });
      expect(contentEl.querySelector("audio")).not.toBeNull();

      // 7. renderBinaryPreview - iframe/pdf
      component.renderBinaryPreview(contentEl, {
        name: "doc.pdf",
        mimeType: "application/pdf",
        binaryContent: new Uint8Array([1, 2, 3]),
      });
      expect(contentEl.querySelector("iframe")).not.toBeNull();

      // 8. resetContent
      component.resetContent();
      expect(component.isFullscreenMode).toBe(false);

      document.body.removeChild(component);
    });
  });
});
