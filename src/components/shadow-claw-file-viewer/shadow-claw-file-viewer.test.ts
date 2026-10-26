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
    sendFileToPeer: jest.fn<any>().mockResolvedValue(undefined),
  },
}));

jest.unstable_mockModule("../../storage/write-group-file.js", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/read-group-file-bytes.js", () => ({
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
  await import("../../storage/read-group-file-bytes.js");
const { writeGroupFile } = await import("../../storage/write-group-file.js");
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

  it("sets allow='fullscreen; clipboard-write' and omits allowfullscreen on HTML iframe previews", async () => {
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
    expect(iframe?.getAttribute("allow")).toBe("fullscreen; clipboard-write");
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
      theme: {
        stylesheet: "pages/resources/theme.css",
      },
      customElements: {
        scripts: [
          { src: "pages/main/block-garden-adapter.js", hasInit: true },
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

    expect(srcdoc).toContain('<link rel="stylesheet" href="theme.css">');
    expect(srcdoc).toContain('id="shadow-claw-site-config"');
    expect(srcdoc).toContain('src="/block-garden-adapter.js"');
    expect(srcdoc).toContain(
      'src="https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs"',
    );
    // Has init script for block-garden-adapter.js because hasInit is true
    expect(srcdoc).toContain('import("/block-garden-adapter.js")');
    expect(srcdoc).toContain('m?.init === "function"');
    // Does NOT have init script for block-garden-bundle-min.mjs
    expect(srcdoc).not.toContain(
      'import("https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs")',
    );

    document.head.removeChild(configScript);
    setAllowedCustomElementHostPatterns([]);
  });

  it("does not inject theme stylesheet link into html iframe srcdoc when theme stylesheet is not configured", async () => {
    const component = new ShadowClawFileViewer();
    const configScript = document.createElement("script");
    configScript.id = "shadow-claw-site-config";
    configScript.type = "application/json";
    configScript.textContent = JSON.stringify({});
    document.head.appendChild(configScript);

    const srcdoc = await component.buildIframePreviewSrcdoc({
      name: "index.html",
      path: "pages/main/index.html",
      content: "<p>Hello</p>",
    });

    expect(srcdoc).not.toContain('<link rel="stylesheet" href="theme.css">');

    document.head.removeChild(configScript);
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

    it("rewrites relative asset hrefs with spaces in markdown preview HTML", () => {
      const component = new ShadowClawFileViewer();
      const inputHtml =
        '<p><a href="./My%20File%20With%20Spaces%20In%20The%20Name.md">file</a></p>';
      const rewritten = component.rewriteWorkspacePreviewHtml(
        inputHtml,
        "index.md",
      );
      expect(rewritten).toContain(
        'href="/files/test-group/My%20File%20With%20Spaces%20In%20The%20Name.md"',
      );
    });

    it("rewrites relative asset hrefs in subfolders with spaces in markdown preview HTML", () => {
      const component = new ShadowClawFileViewer();
      const inputHtml = '<p><a href="sub%20folder/My%20File.md">file</a></p>';
      const rewritten = component.rewriteWorkspacePreviewHtml(
        inputHtml,
        "index.md",
      );
      expect(rewritten).toContain(
        'href="/files/test-group/sub%20folder/My%20File.md"',
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

    it("resolves files and subfolders with spaces (both literal and percent-encoded)", () => {
      const component = new ShadowClawFileViewer();

      expect(
        component.resolveWorkspaceLinkPath(
          "My File With Spaces In The Name.md",
          "README.md",
        ),
      ).toBe("My File With Spaces In The Name.md");

      expect(
        component.resolveWorkspaceLinkPath(
          "./My File With Spaces In The Name.md",
          "README.md",
        ),
      ).toBe("My File With Spaces In The Name.md");

      expect(
        component.resolveWorkspaceLinkPath(
          "./My%20File%20With%20Spaces%20In%20The%20Name.md",
          "README.md",
        ),
      ).toBe("My File With Spaces In The Name.md");

      expect(
        component.resolveWorkspaceLinkPath(
          "sub folder/My File With Spaces In The Name.md",
          "README.md",
        ),
      ).toBe("sub folder/My File With Spaces In The Name.md");

      expect(
        component.resolveWorkspaceLinkPath(
          "sub%20folder/My%20File%20With%20Spaces%20In%20The%20Name.md",
          "README.md",
        ),
      ).toBe("sub folder/My File With Spaces In The Name.md");

      expect(
        component.resolveWorkspaceLinkPath(
          "./child note.md",
          "my sub folder/README.md",
        ),
      ).toBe("my sub folder/child note.md");

      expect(
        component.resolveWorkspaceLinkPath(
          "../other folder/doc.md",
          "my sub folder/README.md",
        ),
      ).toBe("other folder/doc.md");
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
        await import("../../storage/write-group-file.js");

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

  describe("peer file sharing menu", () => {
    it("includes modal-share-dropdown in template", async () => {
      const template = await Promise.resolve(
        ShadowClawFileViewer.template.map((e: Element) => e.outerHTML).join(""),
      );

      expect(template).toContain("modal-share-dropdown");
      expect(template).toContain("modal-share-peer-btn");
    });

    it("hides share dropdown and shows single share button in standard non-peer conversations", async () => {
      const component = new ShadowClawFileViewer();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).activeGroupId = "main";
      (fileViewerStore as any).file = {
        name: "test.txt",
        path: "test.txt",
        groupId: "main",
        kind: "text",
        content: "hello",
      };

      Object.defineProperty(navigator, "share", {
        value: jest.fn(),
        configurable: true,
      });

      await component.updateView(1);

      const root = component.shadowRoot!;
      const shareBtn = root.querySelector(".modal-share-btn");
      const shareDropdown = root.querySelector(".modal-share-dropdown");

      // In non-peer conversations, the peer dropdown MUST be hidden
      expect(shareDropdown?.classList.contains("hidden")).toBe(true);
      // Single share button should be visible (since device share is supported)
      expect(shareBtn?.classList.contains("hidden")).toBe(false);

      document.body.removeChild(component);
    });

    it("shows share dropdown with 'Send to peer' option and hides single share button in peer: conversation", async () => {
      const component = new ShadowClawFileViewer();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).activeGroupId = "peer:peer-bob";
      (fileViewerStore as any).file = {
        name: "presentation.pdf",
        path: "docs/presentation.pdf",
        groupId: "peer:peer-bob",
        mimeType: "application/pdf",
        kind: "pdf",
        content: "",
      };

      await component.updateView(1);

      const root = component.shadowRoot!;
      const shareBtn = root.querySelector(".modal-share-btn");
      const shareDropdown = root.querySelector(".modal-share-dropdown");
      const peerLabel = root.querySelector(".modal-share-peer-label");
      const peerBtn = root.querySelector(
        ".modal-share-peer-btn",
      ) as HTMLButtonElement;

      // In peer conversation, dropdown MUST be visible and single button hidden
      expect(shareDropdown?.classList.contains("hidden")).toBe(false);
      expect(shareBtn?.classList.contains("hidden")).toBe(true);
      expect(peerLabel?.textContent).toBe("Send to peer");

      // Clicking peer share option invokes sendFileToPeer
      peerBtn.click();
      expect(orchestratorStore.sendFileToPeer).toHaveBeenCalledWith(
        "docs/presentation.pdf",
        "peer:peer-bob",
        expect.objectContaining({
          fileName: "presentation.pdf",
          mimeType: "application/pdf",
        }),
      );

      document.body.removeChild(component);
    });

    it("shows share dropdown with 'Send to room peers' option in room: conversation", async () => {
      const component = new ShadowClawFileViewer();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).activeGroupId = "room:alpha-room";
      (fileViewerStore as any).file = {
        name: "code.ts",
        path: "code.ts",
        groupId: "room:alpha-room",
        mimeType: "text/typescript",
        kind: "text",
        content: "const a = 1;",
      };

      await component.updateView(1);

      const root = component.shadowRoot!;
      const shareDropdown = root.querySelector(".modal-share-dropdown");
      const peerLabel = root.querySelector(".modal-share-peer-label");
      const peerBtn = root.querySelector(
        ".modal-share-peer-btn",
      ) as HTMLButtonElement;

      expect(shareDropdown?.classList.contains("hidden")).toBe(false);
      expect(peerLabel?.textContent).toBe("Send to room peers");

      peerBtn.click();
      expect(orchestratorStore.sendFileToPeer).toHaveBeenCalledWith(
        "code.ts",
        "room:alpha-room",
        expect.objectContaining({
          fileName: "code.ts",
          mimeType: "text/typescript",
        }),
      );

      document.body.removeChild(component);
    });

    it("handles handleAnchorNavigation with line numbers and elements", async () => {
      const component = new ShadowClawFileViewer();
      document.body.appendChild(component);
      await component.render();

      const content = component.shadowRoot!.querySelector(
        ".file-content",
      ) as HTMLElement;
      content.innerHTML = `
        <div class="code-line" data-line="1">Line 1</div>
        <div class="code-line" data-line="2">Line 2</div>
        <div class="code-line" data-line="3">Line 3</div>
        <h2 id="heading-test">Heading</h2>
      `;

      window.HTMLElement.prototype.scrollIntoView = jest.fn();

      const matchedLine = component.handleAnchorNavigation("#L1-L2");
      expect(matchedLine).toBe(true);
      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

      const matchedHeading = component.handleAnchorNavigation("#heading-test");
      expect(matchedHeading).toBe(true);

      const nonExistent = component.handleAnchorNavigation("#not-found");
      expect(nonExistent).toBe(false);

      document.body.removeChild(component);
    });

    it("handles storage proxy requests from iframe", async () => {
      const component = new ShadowClawFileViewer();
      document.body.appendChild(component);
      await component.render();

      (fileViewerStore as any).file = {
        name: "test.html",
        path: "test.html",
      };

      const mockSource = {
        postMessage: jest.fn(),
      } as any;

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-1",
        "removeItem",
        { key: "item-1" },
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-1",
          result: null,
        }),
        "*",
      );

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-2",
        "clear",
        {},
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-2",
        }),
        "*",
      );

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-3",
        "getAllItems",
        {},
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-3",
        }),
        "*",
      );

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-4",
        "idb-put",
        { dbName: "mydb", storeName: "mystore", key: "k1", value: "v1" },
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-4",
          result: "k1",
        }),
        "*",
      );

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-5",
        "idb-get",
        { dbName: "mydb", storeName: "mystore", key: "k1" },
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-5",
        }),
        "*",
      );

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-6",
        "idb-getAll",
        { dbName: "mydb", storeName: "mystore" },
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-6",
        }),
        "*",
      );

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-7",
        "idb-delete",
        { dbName: "mydb", storeName: "mystore", key: "k1" },
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-7",
        }),
        "*",
      );

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-8",
        "idb-clear",
        { dbName: "mydb", storeName: "mystore" },
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-8",
        }),
        "*",
      );

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-9",
        "idb-deleteDatabase",
        { dbName: "mydb" },
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-9",
        }),
        "*",
      );

      await (component as any).handleStorageProxyRequest(
        mockSource,
        "req-10",
        "unknown-op",
        {},
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-storage-proxy-result",
          requestId: "req-10",
          error: expect.stringContaining("Unknown storage proxy method"),
        }),
        "*",
      );

      document.body.removeChild(component);
    });

    it("handles link click navigation in content", async () => {
      const component = new ShadowClawFileViewer();
      document.body.appendChild(component);
      await component.render();
      component.db = {} as any;

      const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);

      const anchorEl = document.createElement("a");
      anchorEl.setAttribute("href", "https://example.com/external");
      anchorEl.setAttribute("target", "_blank");

      const fakeEvent = {
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        target: anchorEl,
        preventDefault: jest.fn(),
      } as any;

      await component.handlePreviewLinkClick(fakeEvent);
      expect(fakeEvent.preventDefault).toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.com/external",
        "_blank",
        "noopener,noreferrer",
      );

      openSpy.mockRestore();
      document.body.removeChild(component);
    });

    it("handles isFileEditMode rendering in updateView", async () => {
      const component = new ShadowClawFileViewer();
      document.body.appendChild(component);
      await component.render();

      (fileViewerStore as any).file = {
        name: "index.ts",
        path: "src/index.ts",
        content: "const a = 10;",
        mimeType: "text/typescript",
        kind: "text",
      };

      component.isFileEditMode = true;
      component.isFilePreviewMode = false;
      component.isEditorDirty = false;
      await component.updateView();

      const root = component.shadowRoot!;
      const editor = root.querySelector(".file-editor") as HTMLTextAreaElement;
      expect(editor).toBeDefined();
      expect(editor.value).toBe("const a = 10;");
      expect(editor.getAttribute("language")).toBe("typescript");

      // Dirty mode
      component.isEditorDirty = true;
      component.editorDraftContent = "const a = 20;";
      await component.updateView();
      expect(editor.value).toBe("const a = 20;");

      document.body.removeChild(component);
    });

    it("handles reloadPreviewWithSearchParams", async () => {
      const component = new ShadowClawFileViewer();
      document.body.appendChild(component);
      await component.render();

      (fileViewerStore as any).file = {
        name: "page.html",
        path: "page.html",
        content: "<h1>Test</h1>",
        mimeType: "text/html",
        kind: "html",
      };

      const root = component.shadowRoot!;
      const iframe = document.createElement("iframe");
      iframe.className = "file-viewer__iframe";
      root.appendChild(iframe);

      await (component as any).reloadPreviewWithSearchParams("?color=blue");
      expect(iframe.srcdoc).toBeDefined();

      document.body.removeChild(component);
    });

    it("handles reactive modal open and close via effect callback", async () => {
      const { effect } = await import("../../core/effect.js");
      const component = new ShadowClawFileViewer();
      document.body.appendChild(component);
      await component.render();

      const calls = (effect as any).mock.calls;
      const effectCallback = calls[calls.length - 1][0];
      expect(typeof effectCallback).toBe("function");

      (fileViewerStore as any).file = {
        name: "note.txt",
        path: "note.txt",
        content: "hello world",
      };
      effectCallback();
      expect(component.lastOpenedFileName).toBe("note.txt");

      (fileViewerStore as any).file = null;
      effectCallback();
      expect(component.lastOpenedFileName).toBe("");

      document.body.removeChild(component);
    });

    it("handles storage proxy requests and iframe messages comprehensively", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);
      component.db = {};
      const mockSource = { postMessage: jest.fn() };

      // 1. handleStorageProxyRequest
      // missing requestId
      await component.handleStorageProxyRequest(mockSource, "", "setItem", {});
      expect(mockSource.postMessage).not.toHaveBeenCalled();

      // setItem, removeItem, clear, getAllItems
      await component.handleStorageProxyRequest(mockSource, "r1", "setItem", {
        key: "k1",
        value: "v1",
      });
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "r1", result: null }),
        "*",
      );

      await component.handleStorageProxyRequest(
        mockSource,
        "r2",
        "getAllItems",
        {},
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "r2" }),
        "*",
      );

      await component.handleStorageProxyRequest(
        mockSource,
        "r3",
        "removeItem",
        { key: "k1" },
      );
      await component.handleStorageProxyRequest(mockSource, "r4", "clear", {});

      // IndexedDB methods: idb-put (with key and without key), idb-get, idb-getAll, idb-delete, idb-clear, idb-deleteDatabase
      await component.handleStorageProxyRequest(mockSource, "r5", "idb-put", {
        dbName: "myDb",
        storeName: "myStore",
        key: "item1",
        value: { foo: "bar" },
      });
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "r5", result: "item1" }),
        "*",
      );

      await component.handleStorageProxyRequest(mockSource, "r6", "idb-put", {
        dbName: "myDb",
        storeName: "myStore",
        key: null,
        value: { auto: true },
      });
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "r6" }),
        "*",
      );

      await component.handleStorageProxyRequest(mockSource, "r7", "idb-get", {
        dbName: "myDb",
        storeName: "myStore",
        key: "item1",
      });

      await component.handleStorageProxyRequest(
        mockSource,
        "r8",
        "idb-getAll",
        {
          dbName: "myDb",
          storeName: "myStore",
        },
      );

      await component.handleStorageProxyRequest(
        mockSource,
        "r9",
        "idb-delete",
        {
          dbName: "myDb",
          storeName: "myStore",
          key: "item1",
        },
      );

      await component.handleStorageProxyRequest(
        mockSource,
        "r10",
        "idb-clear",
        {
          dbName: "myDb",
          storeName: "myStore",
        },
      );

      await component.handleStorageProxyRequest(
        mockSource,
        "r11",
        "idb-deleteDatabase",
        {
          dbName: "myDb",
        },
      );

      // Unknown method throws and catches
      await component.handleStorageProxyRequest(
        mockSource,
        "r12",
        "invalidMethod",
        {},
      );
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "r12",
          error: expect.stringContaining("Unknown storage proxy method"),
        }),
        "*",
      );

      // 2. handleIframeMessage
      // null or non-object data
      component.handleIframeMessage({ data: null } as any);
      component.handleIframeMessage({ data: "string-data" } as any);

      // shadow-claw-broadcast-result
      component.broadcastProxy = {
        handleResultFromIframe: jest.fn(),
        dispose: jest.fn(),
      };
      component.handleIframeMessage({
        data: {
          type: "shadow-claw-broadcast-result",
          channel: "c1",
          payload: { ok: true },
        },
        source: mockSource,
      } as any);
      expect(
        component.broadcastProxy.handleResultFromIframe,
      ).toHaveBeenCalledWith(mockSource, "c1", { ok: true });

      // shadow-claw-iframe-resize
      const iframe = document.createElement("iframe");
      iframe.className = "file-content-iframe";
      component.shadowRoot.appendChild(iframe);
      component.previewFrameWindow = null;
      component.handleIframeMessage({
        data: { type: "shadow-claw-iframe-resize", height: 450 },
        source: mockSource,
      } as any);
      expect(iframe.style.height).toBe("450px");

      // shadow-claw-storage-proxy with source mismatch vs match
      component.previewFrameWindow = mockSource;
      const otherSource = { postMessage: jest.fn() };
      component.handleIframeMessage({
        data: {
          type: "shadow-claw-storage-proxy",
          requestId: "r99",
          method: "clear",
        },
        source: otherSource,
      } as any);
      expect(otherSource.postMessage).not.toHaveBeenCalled();

      component.handleIframeMessage({
        data: {
          type: "shadow-claw-storage-proxy",
          requestId: "r100",
          method: "clear",
        },
        source: mockSource,
      } as any);
      await new Promise((r) => setTimeout(r, 20));
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "r100" }),
        "*",
      );

      // shadow-claw-file-viewer-link guards
      component.db = null;
      component.handleIframeMessage({
        data: { type: "shadow-claw-file-viewer-link", href: "doc.md" },
      } as any);

      component.db = {};
      component.handleIframeMessage({
        data: { type: "shadow-claw-file-viewer-link", href: 123 },
      } as any);

      component.previewFrameWindow = mockSource;
      component.handleIframeMessage({
        data: { type: "shadow-claw-file-viewer-link", href: "doc.md" },
        source: otherSource,
      } as any);

      document.body.removeChild(component);
    });

    it("handles web share and file sharing branches", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);
      const { showError, showSuccess } = await import("../../ui/toast.js");

      // 1. buildWebShareFile
      expect(component.buildWebShareFile(null)).toBeNull();
      expect(component.buildWebShareFile({ binaryContent: null })).toBeNull();
      expect(
        component.buildWebShareFile({ binaryContent: new Uint8Array(0) }),
      ).toBeNull();
      const f1 = component.buildWebShareFile({
        binaryContent: new Uint8Array([1, 2, 3]),
      });
      expect(f1.name).toBe("shared-file");
      expect(f1.type).toBe("application/octet-stream");

      // 2. canShareCurrentFile
      expect(component.canShareCurrentFile(null)).toBe(false);
      component.isWebShareAvailable = () => false;
      expect(component.canShareCurrentFile({ kind: "text" })).toBe(false);
      component.isWebShareAvailable = () => true;
      expect(component.canShareCurrentFile({ kind: "text" })).toBe(true);

      const origCanShare = Object.getOwnPropertyDescriptor(
        navigator,
        "canShare",
      );
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        writable: true,
        value: jest.fn().mockReturnValue(true),
      });
      expect(
        component.canShareCurrentFile({
          kind: "binary",
          binaryContent: new Uint8Array([1]),
        }),
      ).toBe(true);
      (navigator as any).canShare = jest.fn().mockReturnValue(false);
      expect(
        component.canShareCurrentFile({
          kind: "binary",
          binaryContent: new Uint8Array([1]),
        }),
      ).toBe(false);
      (navigator as any).canShare = undefined;
      expect(
        component.canShareCurrentFile({
          kind: "binary",
          binaryContent: new Uint8Array([1]),
        }),
      ).toBe(false);

      // 3. handleShareFile
      (fileViewerStore as any).file = null;
      await component.handleShareFile();
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining("not supported"),
        4500,
      );

      // text file sharing success
      const origShare = Object.getOwnPropertyDescriptor(navigator, "share");
      Object.defineProperty(navigator, "share", {
        configurable: true,
        writable: true,
        value: jest.fn().mockResolvedValue(undefined),
      });
      (fileViewerStore as any).file = {
        name: "test.txt",
        kind: "text",
        content: null,
      };
      await component.handleShareFile();
      expect(navigator.share).toHaveBeenCalledWith({
        title: "test.txt",
        text: "",
      });
      expect(showSuccess).toHaveBeenCalledWith("Shared test.txt");

      // binary file sharing failure on second call and success
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        writable: true,
        value: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
      });
      (fileViewerStore as any).file = {
        name: "test.bin",
        kind: "binary",
        binaryContent: new Uint8Array([1, 2]),
      };
      await component.handleShareFile();
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining("File sharing is not supported"),
        4500,
      );

      (navigator as any).canShare = jest.fn().mockReturnValue(true);
      await component.handleShareFile();
      expect(showSuccess).toHaveBeenCalledWith("Shared test.bin");

      // AbortError is ignored
      (navigator as any).share = jest
        .fn()
        .mockRejectedValue(new DOMException("Aborted", "AbortError"));
      await component.handleShareFile();

      // Normal Error
      (navigator as any).share = jest
        .fn()
        .mockRejectedValue(new Error("Permission denied"));
      await component.handleShareFile();
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining("Permission denied"),
        5000,
      );

      // String error
      (navigator as any).share = jest.fn().mockRejectedValue("String failure");
      await component.handleShareFile();
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining("String failure"),
        5000,
      );

      if (origShare) {
        Object.defineProperty(navigator, "share", origShare);
      } else {
        delete (navigator as any).share;
      }
      if (origCanShare) {
        Object.defineProperty(navigator, "canShare", origCanShare);
      } else {
        delete (navigator as any).canShare;
      }
      document.body.removeChild(component);
    });

    it("handles native and emulated fullscreen branches", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);
      const modal = component.shadowRoot.querySelector(
        ".file-modal",
      ) as HTMLElement;

      // canUseNativeFullscreen
      const dummyEl = document.createElement("div") as any;
      Object.defineProperty(document, "fullscreenEnabled", {
        value: true,
        configurable: true,
      });
      dummyEl.webkitRequestFullscreen = jest.fn();
      (document as any).webkitExitFullscreen = jest.fn();
      expect(component.canUseNativeFullscreen(dummyEl)).toBe(true);

      Object.defineProperty(document, "fullscreenEnabled", {
        value: false,
        configurable: true,
      });
      expect(component.canUseNativeFullscreen(dummyEl)).toBe(false);

      // getCurrentFullscreenElement
      Object.defineProperty(document, "fullscreenElement", {
        value: null,
        configurable: true,
      });
      (document as any).webkitFullscreenElement = dummyEl;
      expect(component.getCurrentFullscreenElement()).toBe(dummyEl);
      (document as any).webkitFullscreenElement = null;
      expect(component.getCurrentFullscreenElement()).toBeNull();

      // getFullscreenTarget
      expect(
        component.getFullscreenTarget(document.createElement("div")),
      ).toBeNull();
      const divWithSpan = document.createElement("div");
      divWithSpan.innerHTML = '<svg class="modal-content"></svg>';
      expect(component.getFullscreenTarget(divWithSpan)).toBeNull();

      // exitNativeFullscreen & requestNativeFullscreen
      (document as any).webkitExitFullscreen = jest.fn();
      const origExit = Object.getOwnPropertyDescriptor(
        document,
        "exitFullscreen",
      );
      Object.defineProperty(document, "exitFullscreen", {
        configurable: true,
        writable: true,
        value: undefined,
      });
      await expect(component.exitNativeFullscreen()).resolves.toBeUndefined();
      (document as any).webkitExitFullscreen = undefined;
      await expect(component.exitNativeFullscreen()).rejects.toThrow(
        "Native fullscreen exit unavailable",
      );
      if (origExit) Object.defineProperty(document, "exitFullscreen", origExit);

      dummyEl.requestFullscreen = undefined;
      dummyEl.webkitRequestFullscreen = jest.fn();
      await expect(
        component.requestNativeFullscreen(dummyEl),
      ).resolves.toBeUndefined();
      dummyEl.webkitRequestFullscreen = undefined;
      await expect(component.requestNativeFullscreen(dummyEl)).rejects.toThrow(
        "Native fullscreen unavailable",
      );

      // exitFullscreenIfActive
      await component.exitFullscreenIfActive(null);
      await component.exitFullscreenIfActive(modal);

      // toggleFullscreenMode emulated fallback
      const modalContent = modal.querySelector(".modal-content")!;
      component.canUseNativeFullscreen = () => false;
      await component.toggleFullscreenMode(modal);
      expect(modalContent.classList.contains("modal-content--fullscreen")).toBe(
        true,
      );
      await component.toggleFullscreenMode(modal);
      expect(modalContent.classList.contains("modal-content--fullscreen")).toBe(
        false,
      );

      // toggleFullscreenMode with invalid target
      await component.toggleFullscreenMode(document.createElement("div"));

      // toggleFullscreenMode native fullscreen
      component.canUseNativeFullscreen = () => true;
      component.isTargetInFullscreen = jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      component.requestNativeFullscreen = jest
        .fn()
        .mockResolvedValue(undefined);
      component.exitNativeFullscreen = jest.fn().mockResolvedValue(undefined);
      await component.toggleFullscreenMode(modal);
      expect(component.requestNativeFullscreen).toHaveBeenCalled();
      await component.toggleFullscreenMode(modal);
      expect(component.exitNativeFullscreen).toHaveBeenCalled();

      // toggleFullscreenMode native failure catch
      component.requestNativeFullscreen = jest
        .fn()
        .mockRejectedValue(new Error("Fullscreen denied"));
      await component.toggleFullscreenMode(modal);
      expect(modalContent.classList.contains("modal-content--fullscreen")).toBe(
        true,
      );

      document.body.removeChild(component);
    });

    it("handles preview link navigation and workspace link resolution", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);
      component.db = {};

      // 1. handlePreviewLinkClick guards
      const evDefault = new MouseEvent("click", { cancelable: true });
      evDefault.preventDefault();
      await component.handlePreviewLinkClick(evDefault);

      const evButton = new MouseEvent("click", { button: 1 });
      await component.handlePreviewLinkClick(evButton);

      const evMeta = new MouseEvent("click", { metaKey: true });
      await component.handlePreviewLinkClick(evMeta);

      const evCtrl = new MouseEvent("click", { ctrlKey: true });
      await component.handlePreviewLinkClick(evCtrl);

      const evShift = new MouseEvent("click", { shiftKey: true });
      await component.handlePreviewLinkClick(evShift);

      const evAlt = new MouseEvent("click", { altKey: true });
      await component.handlePreviewLinkClick(evAlt);

      // not element target
      await component.handlePreviewLinkClick({
        target: null,
        button: 0,
      } as any);

      // no anchor element
      const divEl = document.createElement("div");
      await component.handlePreviewLinkClick({
        target: divEl,
        button: 0,
      } as any);

      // without db
      const anchorEl = document.createElement("a");
      anchorEl.href = "/workspace/file.md";
      component.db = null;
      await component.handlePreviewLinkClick({
        target: anchorEl,
        button: 0,
      } as any);
      component.db = {};

      // internal navigation via window.navigation.navigate
      (fileViewerStore as any).file = {
        name: "index.md",
        path: "docs/index.md",
      };
      const navMock = { navigate: jest.fn() };
      Object.defineProperty(window as any, "navigation", {
        configurable: true,
        writable: true,
        value: navMock,
      });
      const evInternal = {
        target: anchorEl,
        button: 0,
        preventDefault: jest.fn(),
      } as any;
      anchorEl.setAttribute("href", "sub.md");
      await component.handlePreviewLinkClick(evInternal);
      expect(navMock.navigate).toHaveBeenCalled();

      // internal navigation fallback to history.pushState
      delete (window as any).navigation;
      const pushSpy = jest
        .spyOn(window.history, "pushState")
        .mockImplementation(() => {});
      await component.handlePreviewLinkClick(evInternal);
      expect(pushSpy).toHaveBeenCalled();
      pushSpy.mockRestore();

      // external link click
      const extAnchor = document.createElement("a");
      extAnchor.setAttribute("href", "https://external.example.com/page");
      extAnchor.setAttribute("target", "_self");
      const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
      const evExternal = {
        target: extAnchor,
        button: 0,
        preventDefault: jest.fn(),
      } as any;
      await component.handlePreviewLinkClick(evExternal);
      expect(openSpy).toHaveBeenCalledWith(
        "https://external.example.com/page",
        "_blank",
        "noopener,noreferrer",
      );

      // external custom scheme
      extAnchor.setAttribute("href", "slack://open?id=123");
      extAnchor.setAttribute("target", "my-win");
      await component.handlePreviewLinkClick(evExternal);
      expect(openSpy).toHaveBeenCalledWith(
        "slack://open?id=123",
        "my-win",
        "noopener,noreferrer",
      );
      openSpy.mockRestore();

      // 2. resolveWorkspaceLinkPath
      expect(component.resolveWorkspaceLinkPath("")).toBeNull();
      expect(component.resolveWorkspaceLinkPath("#top")).toBeNull();
      expect(
        component.resolveWorkspaceLinkPath("ftp://example.com/file"),
      ).toBeNull();
      expect(
        component.resolveWorkspaceLinkPath("https://other.com/file"),
      ).toBeNull();
      expect(component.resolveWorkspaceLinkPath("/absolute/path")).toBeNull();
      expect(
        component.resolveWorkspaceLinkPath(
          "../../out-of-bounds",
          "src/file.ts",
        ),
      ).toBeNull();
      expect(
        component.resolveWorkspaceLinkPath("a/./b/../c", "src/file.ts"),
      ).toBe("src/a/c");

      // 3. routeGroupMatches
      expect(component.routeGroupMatches("main", "main")).toBe(true);
      expect(component.routeGroupMatches("main", "br:main")).toBe(true);
      expect(component.routeGroupMatches("br:main", "main")).toBe(true);
      expect(component.routeGroupMatches("g1", "g2")).toBe(false);
      expect(component.routeGroupMatches("peer:123", "peer-123")).toBe(true);
      expect(component.routeGroupMatches("peer:123", "peer:456")).toBe(false);

      document.body.removeChild(component);
    });

    it("handles binary preview rendering, code highlighting, wrapCodeLines, and theme sync", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);
      const content = document.createElement("div");

      // 1. mimeTypeForImageExt
      expect(component.mimeTypeForImageExt("png")).toBe("image/png");
      expect(component.mimeTypeForImageExt("unknown_xyz")).toBe("image/jpeg");

      // 2. renderBinaryPreview
      // nativeFile
      const fileNative = {
        name: "img.png",
        mimeType: "image/png",
        nativeFile: new File([""], "img.png"),
      };
      component.renderBinaryPreview(content, fileNative);
      expect(content.querySelector("img")).not.toBeNull();

      // binaryContent empty
      const fileEmpty = {
        name: "empty.bin",
        mimeType: "application/octet-stream",
        binaryContent: new Uint8Array(0),
      };
      component.renderBinaryPreview(content, fileEmpty);
      expect(content.textContent).toBe("Binary content unavailable.");

      // video
      const fileVideo = {
        name: "vid.mp4",
        mimeType: "video/mp4",
        binaryContent: new Uint8Array([1, 2, 3]),
      };
      component.renderBinaryPreview(content, fileVideo);
      expect(content.querySelector("video")).not.toBeNull();

      // audio
      const fileAudio = {
        name: "aud.mp3",
        mimeType: "audio/mp3",
        binaryContent: new Uint8Array([1, 2, 3]),
      };
      component.renderBinaryPreview(content, fileAudio);
      expect(content.querySelector("audio")).not.toBeNull();

      // other mimeType -> iframe
      const fileOther = {
        name: "doc.bin",
        mimeType: "application/pdf",
        binaryContent: new Uint8Array([1, 2, 3]),
      };
      component.renderBinaryPreview(content, fileOther);
      expect(content.querySelector("iframe")).not.toBeNull();

      // 3. wrapCodeLines
      const preContainer = document.createElement("div");
      preContainer.innerHTML = "<pre><code>line1\n\nline3\n</code></pre>";
      component.wrapCodeLines(preContainer);
      expect(preContainer.innerHTML).toContain("&nbsp;");

      const preNoTrailing = document.createElement("div");
      preNoTrailing.innerHTML = "<pre><code>lineA\nlineB</code></pre>";
      component.wrapCodeLines(preNoTrailing);
      expect(preNoTrailing.innerHTML).toContain('data-line="2"');

      // 4. stripHtmlFrontmatter
      expect(component.stripHtmlFrontmatter(null as any)).toBeNull();
      expect(component.stripHtmlFrontmatter("hello world")).toBe("hello world");
      expect(component.stripHtmlFrontmatter("---\n---\nbody")).toBe(
        "---\n---\nbody",
      );
      expect(
        component.stripHtmlFrontmatter("---\ntitle: test\n---\nbody"),
      ).toBe("body");

      // 5. syncIframeTheme
      component.previewFrameWindow = null;
      component.syncIframeTheme();
      const mockWin = { postMessage: jest.fn() };
      component.previewFrameWindow = mockWin;
      document.documentElement.classList.add("dark-mode");
      component.syncIframeTheme();
      expect(mockWin.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-theme-update",
          theme: "dark",
        }),
        "*",
      );

      document.body.removeChild(component);
    });

    it("handles anchor navigation, file saving, sending to peer, and workspace link opening", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);
      component.db = {};
      const { showError, showSuccess } = await import("../../ui/toast.js");

      // 1. handleAnchorNavigation
      const fileContent = component.shadowRoot.querySelector(
        ".file-content",
      ) as HTMLElement;
      fileContent.innerHTML = `
        <span class="code-line" data-line="5">five</span>
        <span class="code-line" data-line="10">ten</span>
        <div id="section-id">section</div>
        <a name="section-name">name anchor</a>
      `;

      expect(component.handleAnchorNavigation("#L5")).toBe(true);
      expect(component.handleAnchorNavigation("#L5-L10")).toBe(true);
      expect(component.handleAnchorNavigation("#L99")).toBe(false);
      expect(component.handleAnchorNavigation("#section-id")).toBe(true);
      expect(component.handleAnchorNavigation("#section-name")).toBe(true);
      expect(component.handleAnchorNavigation("#nonexistent")).toBe(false);

      // 2. canDismissViewer
      component.hasUnsavedChanges = () => false;
      await expect(component.canDismissViewer()).resolves.toBe(true);

      component.hasUnsavedChanges = () => true;
      component.requestConfirmation = jest.fn().mockResolvedValue(true);
      await expect(component.canDismissViewer()).resolves.toBe(true);

      component.requestConfirmation = jest.fn().mockResolvedValue(false);
      await expect(component.canDismissViewer()).resolves.toBe(false);

      // 3. handleSave
      (fileViewerStore as any).file = null;
      await component.handleSave();

      (fileViewerStore as any).file = {
        name: "doc.txt",
        path: null,
        groupId: null,
      };
      (orchestratorStore as any).currentPath = ".";
      const editor = component.shadowRoot.querySelector(
        ".file-editor",
      ) as HTMLTextAreaElement;
      editor.value = "saved text";
      await component.handleSave();
      expect(showSuccess).toHaveBeenCalledWith("Saved doc.txt");

      (orchestratorStore as any).currentPath = "subfolder";
      await component.handleSave();
      expect(showSuccess).toHaveBeenCalledWith("Saved doc.txt");

      (writeGroupFile as any).mockRejectedValueOnce(new Error("Disk full"));
      await component.handleSave();
      expect(showError).toHaveBeenCalledWith("Failed to save file: Disk full");

      (writeGroupFile as any).mockRejectedValueOnce("String disk failure");
      await component.handleSave();
      expect(showError).toHaveBeenCalledWith(
        "Failed to save file: String disk failure",
      );

      // 4. handleSendFileToPeer
      (fileViewerStore as any).file = null;
      await component.handleSendFileToPeer();
      expect(showError).toHaveBeenCalledWith(
        "No file is currently open.",
        4500,
      );

      (fileViewerStore as any).file = {
        name: "doc.txt",
        path: "doc.txt",
        groupId: "main",
      };
      await component.handleSendFileToPeer();
      expect(showError).toHaveBeenCalledWith(
        "Can only send files to peers in a peer or room conversation.",
        4500,
      );

      (fileViewerStore as any).file = {
        name: "doc.txt",
        path: "doc.txt",
        groupId: "peer:peer1",
      };
      await component.handleSendFileToPeer();
      expect(orchestratorStore.sendFileToPeer).toHaveBeenCalledWith(
        "doc.txt",
        "peer:peer1",
        expect.anything(),
      );

      (fileViewerStore as any).file = {
        name: "doc.txt",
        path: "doc.txt",
        groupId: "room:room1",
      };
      await component.handleSendFileToPeer();
      expect(orchestratorStore.sendFileToPeer).toHaveBeenCalledWith(
        "doc.txt",
        "room:room1",
        expect.anything(),
      );

      // 5. openFolderInFilesView
      component.db = null;
      await component.openFolderInFilesView("path");
      component.db = {};
      await component.openFolderInFilesView("///");

      (window as any).shadowclaw = { ui: { showPage: jest.fn() } };
      await component.openFolderInFilesView("my/folder");
      expect((window as any).shadowclaw.ui.showPage).toHaveBeenCalledWith(
        "files",
      );

      (orchestratorStore.setCurrentPath as any).mockRejectedValueOnce(
        new Error("Path invalid"),
      );
      await component.openFolderInFilesView("bad/folder");
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to open linked folder"),
        5000,
      );

      // 6. openWorkspaceLink
      component.db = null;
      await component.openWorkspaceLink("href", "base");
      component.db = {};
      await component.openWorkspaceLink("", "base");

      // extensionless file
      (fileViewerStore.openFile as any).mockResolvedValueOnce(undefined);
      await component.openWorkspaceLink("extensionless", "base/file.md");

      (fileViewerStore.openFile as any).mockRejectedValueOnce(
        new DOMException("Not found", "NotFoundError"),
      );
      await component.openWorkspaceLink("extensionless", "base/file.md");

      (fileViewerStore.openFile as any).mockRejectedValueOnce(
        new DOMException("Is directory", "TypeMismatchError"),
      );
      await component.openWorkspaceLink("extensionless", "base/file.md");

      (fileViewerStore.openFile as any).mockRejectedValueOnce(
        new Error("General failure"),
      );
      await component.openWorkspaceLink("extensionless", "base/file.md");
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to open linked file"),
        5000,
      );

      // file with extension
      (fileViewerStore.openFile as any).mockRejectedValueOnce(
        new Error("File read error"),
      );
      await component.openWorkspaceLink("target.txt", "base/file.md");
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to open linked file"),
        5000,
      );

      // 7. reloadPreviewWithSearchParams guards
      (fileViewerStore as any).file = null;
      await component.reloadPreviewWithSearchParams("?q=1");

      (fileViewerStore as any).file = { name: "test.html" };
      const oldIframe = component.shadowRoot.querySelector(
        ".file-viewer__iframe",
      );
      oldIframe?.remove();
      await component.reloadPreviewWithSearchParams("?q=1");

      document.body.removeChild(component);
    });

    it("handles requestCloseViewer when dismiss is confirmed vs prevented", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);

      component.canDismissViewer = jest.fn().mockResolvedValue(false);
      const dismissedFalse = await component.requestCloseViewer();
      expect(dismissedFalse).toBe(false);
      expect(fileViewerStore.closeFile).not.toHaveBeenCalled();

      component.canDismissViewer = jest.fn().mockResolvedValue(true);
      component.exitFullscreenIfActive = jest.fn().mockResolvedValue(undefined);
      const dismissedTrue = await component.requestCloseViewer();
      expect(dismissedTrue).toBe(true);
      expect(component.exitFullscreenIfActive).toHaveBeenCalled();
      expect(fileViewerStore.closeFile).toHaveBeenCalled();

      document.body.removeChild(component);
    });

    it("handles renderContent branches for pdf, binary, iframe, and markdown", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);
      const modal = component.shadowRoot.querySelector(
        ".file-modal",
      ) as HTMLElement;
      const content = modal.querySelector(".file-content") as HTMLElement;

      // 1. PDF file
      const pdfFile = { name: "doc.pdf", kind: "pdf", path: "doc.pdf" };
      await component.renderPreview(
        content,
        pdfFile,
        component.viewRenderToken,
      );
      await new Promise((r) => setTimeout(r, 20));

      // 2. Binary file
      const binaryFile = {
        name: "image.png",
        kind: "binary",
        path: "image.png",
        mimeType: "image/png",
      };
      await component.renderPreview(
        content,
        binaryFile,
        component.viewRenderToken,
      );

      // 3. Iframe preview file with load event
      const htmlFile = {
        name: "preview.html",
        kind: "text",
        path: "preview.html",
        content: "<h1>Hi</h1>",
      };
      await component.renderPreview(
        content,
        htmlFile,
        component.viewRenderToken,
      );
      const iframe = content.querySelector("iframe");
      expect(iframe).not.toBeNull();
      iframe?.dispatchEvent(new Event("load"));

      // 4. Stale render token
      const oldToken = component.viewRenderToken - 1;
      const mdFile = {
        name: "readme.md",
        kind: "text",
        path: "readme.md",
        content: "# Title",
      };
      await component.renderPreview(content, mdFile, oldToken);

      // 5. Markdown preview with script and frontmatter promise
      const existingScript = document.createElement("script");
      existingScript.src = "./approved.js";
      document.head.appendChild(existingScript);

      component.db = {
        transaction: () => ({
          objectStore: () => ({
            get: () => {
              const req: any = {};
              setTimeout(() => {
                req.result = { value: "true" };
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
          }),
        }),
      };
      const mdWithScript = {
        name: "test.md",
        kind: "text",
        path: "test.md",
        content: '<script src="./approved.js"></script><p>Text</p>',
      };
      await component.renderPreview(
        content,
        mdWithScript,
        component.viewRenderToken,
      );

      existingScript.remove();
      document.body.removeChild(component);
    });

    it("handles image resolving branches", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);

      // resolveMarkdownImages when db is null
      component.db = null;
      const div = document.createElement("div");
      await component.resolveMarkdownImages(div, "file.md");

      // resolveMarkdownImages with no images
      component.db = {};
      await component.resolveMarkdownImages(div, "file.md");

      // resolveMarkdownImages with various image src attributes
      div.innerHTML = `
        <img src="" />
        <img src="data:image/png;base64,123" />
        <img src="blob:http://localhost/abc" />
        <img src="#anchor" />
        <img src="resolved.png" />
        <img src="unreadable.png" />
      `;
      component.getWorkspaceRouteTarget = jest.fn((src: string) => {
        if (src === "resolved.png")
          return { groupId: "test-group", path: "resolved.png" };
        if (src === "unreadable.png")
          return { groupId: "test-group", path: "unreadable.png" };
        return null;
      });
      (readGroupFileBytes as jest.Mock).mockImplementation(
        (_db: any, _gid: any, path: any) => {
          if (path === "resolved.png") {
            return Promise.resolve(new Uint8Array([137, 80, 78, 71]));
          }
          return Promise.reject(new Error("File unreadable"));
        },
      );

      await component.resolveMarkdownImages(div, "file.md");
      const imgs = div.querySelectorAll("img");
      expect(imgs[4].src).toContain("data:image/png");
      expect(imgs[5].getAttribute("src")).toBe("unreadable.png");

      // resolveRelativeImagesInHtml
      component.db = null;
      expect(
        await component.resolveRelativeImagesInHtml(
          "<img src='a.png'>",
          "f.html",
        ),
      ).toBe("<img src='a.png'>");
      component.db = {};
      expect(await component.resolveRelativeImagesInHtml("", "f.html")).toBe(
        "",
      );
      expect(
        await component.resolveRelativeImagesInHtml(
          "<div>No img</div>",
          "f.html",
        ),
      ).toContain("<div>No img</div>");

      const htmlWithImgs = `
        <img src="" />
        <img src="data:image/png;base64,xyz" />
        <img src="relative.jpg" />
        <img src="fail.jpg" />
      `;
      component.getWorkspaceRouteTarget = jest.fn((src: string) => {
        if (src === "relative.jpg")
          return { groupId: "test-group", path: "relative.jpg" };
        if (src === "fail.jpg")
          return { groupId: "test-group", path: "fail.jpg" };
        return null;
      });
      (readGroupFileBytes as jest.Mock).mockImplementation(
        (_db: any, _gid: any, path: any) => {
          if (path === "relative.jpg") {
            return Promise.resolve(new Uint8Array([255, 216, 255]));
          }
          return Promise.reject(new Error("File missing"));
        },
      );
      const resolvedHtml = await component.resolveRelativeImagesInHtml(
        htmlWithImgs,
        "dir/f.html",
      );
      expect(resolvedHtml).toContain("data:image/jpeg");

      document.body.removeChild(component);
    });

    it("handles getWorkspaceRouteTarget candidates and filtering branches", () => {
      const component = new ShadowClawFileViewer() as any;
      (orchestratorStore as any).activeGroupId = "main-group";

      // 1. empty target
      expect(component.getWorkspaceRouteTarget("")).toBeNull();

      // 2. dotPrefixedFilesPath starting with files/
      expect(
        component.getWorkspaceRouteTarget("./files/group1/doc.txt"),
      ).toBeDefined();

      // 3. nested /files/ in absolute path
      expect(
        component.getWorkspaceRouteTarget("/workspace/files/group1/doc.txt"),
      ).toBeDefined();

      // 4. resolveRouteGroupId returning null
      component.resolveRouteGroupId = jest.fn().mockReturnValue(null);
      expect(
        component.getWorkspaceRouteTarget("/files/group1/doc.txt"),
      ).toBeNull();

      // 5. allowCrossGroup: false and resolvedGroupId !== activeGroupId
      component.resolveRouteGroupId = jest.fn().mockReturnValue("other-group");
      expect(
        component.getWorkspaceRouteTarget("/files/group1/doc.txt", {
          allowCrossGroup: false,
        }),
      ).toBeNull();
      expect(
        component.getWorkspaceRouteTarget("/files/group1/doc.txt", {
          allowCrossGroup: true,
        }),
      ).toEqual({
        groupId: "other-group",
        path: "doc.txt",
      });
    });

    it("handles handleIframeMessage file-viewer-link navigation and gameSave branches", () => {
      const component = new ShadowClawFileViewer() as any;
      component.db = {};
      component.reloadPreviewWithSearchParams = jest.fn();

      // 1. gameSave param via handleIframeMessage
      const msgEventGameSave = {
        data: {
          type: "shadow-claw-file-viewer-link",
          href: "/files/test-group/page?gameSave=123",
        },
        source: window,
      } as any;
      component.handleIframeMessage(msgEventGameSave);
      expect(component.reloadPreviewWithSearchParams).toHaveBeenCalledWith(
        "?gameSave=123",
      );

      // 2. external non-internal link via handleIframeMessage
      const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
      const msgEventExternal = {
        data: {
          type: "shadow-claw-file-viewer-link",
          href: "https://example.com/external",
        },
        source: window,
      } as any;
      component.handleIframeMessage(msgEventExternal);
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.com/external",
        "_blank",
        "noopener,noreferrer",
      );
      openSpy.mockRestore();

      // 3. internal link with window.navigation via handleIframeMessage
      const mockNavigate = jest.fn();
      Object.defineProperty(window, "navigation", {
        configurable: true,
        writable: true,
        value: { navigate: mockNavigate },
      });
      const msgEventInternal = {
        data: { type: "shadow-claw-file-viewer-link", href: "/chat" },
        source: window,
      } as any;
      component.handleIframeMessage(msgEventInternal);
      expect(mockNavigate).toHaveBeenCalled();

      // 4. internal link with pushState fallback
      delete (window as any).navigation;
      const pushStateSpy = jest.spyOn(window.history, "pushState");
      component.handleIframeMessage(msgEventInternal);
      expect(pushStateSpy).toHaveBeenCalled();
      pushStateSpy.mockRestore();

      // 5. mismatching source when previewFrameWindow is set
      component.previewFrameWindow = {} as any;
      component.handleIframeMessage({
        data: { type: "shadow-claw-file-viewer-link", href: "/chat" },
        source: window,
      } as any);

      // 6. non-matching message types or null db
      component.handleIframeMessage({ data: { type: "other-type" } } as any);
      component.db = null;
      component.handleIframeMessage({
        data: { type: "shadow-claw-file-viewer-link", href: "/chat" },
      } as any);
    });

    it("handles UI event listeners and updateView edit/binary branches", async () => {
      const component = new ShadowClawFileViewer() as any;
      document.body.appendChild(component);
      const root = component.shadowRoot;

      // 1. shareDeviceBtn click removes open from shareDropdown
      const shareDropdown = root.querySelector(
        ".share-dropdown",
      ) as HTMLDetailsElement;
      const shareDeviceBtn = root.querySelector(
        ".modal-share-device-btn",
      ) as HTMLElement;
      if (shareDropdown && shareDeviceBtn) {
        shareDropdown.setAttribute("open", "true");
        component.handleShareFile = jest.fn();
        shareDeviceBtn.click();
        expect(shareDropdown.hasAttribute("open")).toBe(false);
        expect(component.handleShareFile).toHaveBeenCalled();
      }

      // 2. root click outside shareDropdown closes it
      if (shareDropdown) {
        shareDropdown.setAttribute("open", "true");
        shareDropdown.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(shareDropdown.hasAttribute("open")).toBe(true);

        const outsideDiv = document.createElement("div");
        root.appendChild(outsideDiv);
        outsideDiv.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(shareDropdown.hasAttribute("open")).toBe(false);
      }

      // 3. editBtn click toggles isFileEditMode
      const editBtn = root.querySelector(
        ".modal-edit-btn",
      ) as HTMLButtonElement;
      if (editBtn) {
        editBtn.click();
        expect(component.isFileEditMode).toBe(true);
        editBtn.click();
        expect(component.isFileEditMode).toBe(false);
      }

      // 4. updateView when isFileEditMode is true, no language, dirty editor
      (fileViewerStore as any).file = {
        name: "Makefile",
        kind: "text",
        path: "Makefile",
        content: "all:\n\techo hi",
      };
      component.isFileEditMode = true;
      component.isEditorDirty = true;
      await component.updateView();
      const editor = root.querySelector(".file-editor") as HTMLTextAreaElement;
      expect(editor.getAttribute("language")).toBeNull();

      // 5. updateView when isFileEditMode is false and file is binary
      (fileViewerStore as any).file = {
        name: "data.bin",
        kind: "binary",
        path: "data.bin",
        mimeType: "application/octet-stream",
      };
      component.isFileEditMode = false;
      await component.updateView();
      const content = root.querySelector(".file-content") as HTMLElement;
      expect(content.textContent).toContain(
        "Binary file (application/octet-stream)",
      );

      // 6. syncIframeTheme with custom properties
      document.documentElement.style.setProperty(
        "--custom-test-theme-prop",
        "#ff0000",
      );
      const postMessageSpy = jest.fn();
      component.previewFrameWindow = { postMessage: postMessageSpy };
      component.syncIframeTheme();
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "shadow-claw-theme-update",
          customProperties: expect.objectContaining({
            "--custom-test-theme-prop": "#ff0000",
          }),
        }),
        "*",
      );

      document.body.removeChild(component);
    });
  });
});
