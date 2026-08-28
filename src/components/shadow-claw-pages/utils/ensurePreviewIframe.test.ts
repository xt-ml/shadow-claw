import { describe, it, expect, jest } from "@jest/globals";
import { ensurePreviewIframe } from "./ensurePreviewIframe.js";

describe("ensurePreviewIframe", () => {
  it("returns existing iframe if already present", () => {
    const root = document.createElement("div");
    const rendered = document.createElement("div");
    const existing = document.createElement("iframe");
    existing.setAttribute("data-pages-iframe", "");
    root.appendChild(existing);
    root.appendChild(rendered);

    const result = ensurePreviewIframe({
      root: root as unknown as ShadowRoot,
      rendered,
    });

    expect(result).toBe(existing);
  });

  it("creates new iframe with sandbox and attributes when not present", () => {
    const root = document.createElement("div");
    const rendered = document.createElement("div");
    root.appendChild(rendered);

    const onLoad = jest.fn();
    const iframe = ensurePreviewIframe({
      root: root as unknown as ShadowRoot,
      rendered,
      selectedPath: "guide.md",
      onIframeLoad: onLoad,
    });

    expect(iframe).toBeInstanceOf(HTMLIFrameElement);
    expect(iframe.getAttribute("title")).toBe("Preview: guide.md");
    expect(iframe.hidden).toBe(true);

    iframe.dispatchEvent(new Event("load"));
    expect(onLoad).toHaveBeenCalledWith(iframe.contentWindow);
  });
});
