import { describe, it, expect } from "@jest/globals";
import { removePreviewIframe } from "./removePreviewIframe.js";

describe("removePreviewIframe", () => {
  it("does nothing when iframe element is not found", () => {
    const root = document.createElement("div") as unknown as ShadowRoot;
    expect(() => removePreviewIframe(root)).not.toThrow();
  });

  it("removes srcdoc attribute and removes iframe from DOM", () => {
    const root = document.createElement("div");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-pages-iframe", "");
    iframe.setAttribute("srcdoc", "<p>content</p>");
    root.appendChild(iframe);

    removePreviewIframe(root as unknown as ShadowRoot);

    expect(root.querySelector("[data-pages-iframe]")).toBeNull();
  });
});
