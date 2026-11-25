import { jest } from "@jest/globals";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import DefaultShadowClawElement, {
  ShadowClawElement,
  BaseElement,
  defineElement,
} from "./shadow-claw-element.js";

describe("ShadowClawElement", () => {
  it("exports named ShadowClawElement, default export, BaseElement, and defineElement", () => {
    expect(DefaultShadowClawElement).toBe(ShadowClawElement);
    expect(BaseElement).toBe(HTMLElement);
    expect(typeof defineElement).toBe("function");
  });

  it("adopts static styles as a CSSStyleSheet, a CSS string, or an array (with caching for strings)", () => {
    const sharedCss = ".box { color: red; }";
    const extraSheet = new CSSStyleSheet();
    extraSheet.replaceSync(".extra { display: flex; }");

    class StringStyledElement extends ShadowClawElement {
      static styles = sharedCss;
      static template = `<div class="box">Hello</div>`;
    }

    class ArrayStyledElement extends ShadowClawElement {
      static styles = [sharedCss, extraSheet];
      static template = `<div class="box extra">World</div>`;
    }

    defineElement("test-string-styled", StringStyledElement);
    defineElement("test-array-styled", ArrayStyledElement);

    const el1 = new StringStyledElement();
    const el2 = new StringStyledElement();
    const el3 = new ArrayStyledElement();

    expect(el1.shadowRoot?.adoptedStyleSheets.length).toBe(1);
    expect(el2.shadowRoot?.adoptedStyleSheets.length).toBe(1);
    // Cached CSSStyleSheet instance reused across instances for identical CSS string
    expect(el1.shadowRoot?.adoptedStyleSheets[0]).toBe(
      el2.shadowRoot?.adoptedStyleSheets[0],
    );
    expect(el3.shadowRoot?.adoptedStyleSheets.length).toBe(2);
    expect(el3.shadowRoot?.adoptedStyleSheets[1]).toBe(extraSheet);
    expect(el1.shadowRoot?.querySelector(".box")?.textContent).toBe("Hello");
    expect(el3.shadowRoot?.querySelector(".box.extra")?.textContent).toBe(
      "World",
    );

    // Clones fresh template nodes per instance
    expect(el1.shadowRoot?.querySelector(".box")).not.toBe(
      el2.shadowRoot?.querySelector(".box"),
    );
  });

  it("adopts static template from HTMLTemplateElement and clones per instance", () => {
    const tpl = document.createElement("template");
    tpl.innerHTML = `<span class="tpl-span">FromTemplate</span>`;

    class TemplateEl extends ShadowClawElement {
      static template = tpl;
    }

    defineElement("test-tpl-el", TemplateEl);
    const a = new TemplateEl();
    const b = new TemplateEl();

    expect(a.shadowRoot?.querySelector(".tpl-span")?.textContent).toBe(
      "FromTemplate",
    );
    expect(b.shadowRoot?.querySelector(".tpl-span")?.textContent).toBe(
      "FromTemplate",
    );
    expect(a.shadowRoot?.querySelector(".tpl-span")).not.toBe(
      b.shadowRoot?.querySelector(".tpl-span"),
    );
  });

  it("forwards static shadowRootOptions (e.g. delegatesFocus) while enforcing mode: 'open'", () => {
    class FocusEl extends ShadowClawElement {
      static shadowRootOptions = {
        delegatesFocus: true,
        mode: "closed" as ShadowRootMode,
      };
      static template = `<button type="button">Press</button>`;
    }

    const spy = jest.spyOn(HTMLElement.prototype, "attachShadow");
    defineElement("test-focus-el", FocusEl);
    const el = new FocusEl();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        delegatesFocus: true,
        mode: "open",
      }),
    );
    expect(el.shadowRoot).not.toBeNull();
    spy.mockRestore();
  });

  it("runs registered cleanups on disconnectedCallback", () => {
    const cleanup = jest.fn();

    class CleanupEl extends ShadowClawElement {
      connectedCallback() {
        super.connectedCallback();
        this.addCleanup(cleanup);
      }
    }

    defineElement("test-cleanup-el", CleanupEl);
    const el = new CleanupEl();
    document.body.appendChild(el);
    expect(cleanup).not.toHaveBeenCalled();

    el.remove();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("automatically installs and cleans up page swipe guard when static disablePageSwipe = true", () => {
    const viewer = document.createElement("div");
    viewer.className = "pages__viewer";

    class GuardedEl extends ShadowClawElement {
      static disablePageSwipe = true;
    }

    defineElement("test-guarded-el", GuardedEl);
    const el = new GuardedEl();
    viewer.appendChild(el);
    document.body.appendChild(viewer);

    expect(el.getAttribute("data-no-swipe")).toBe("true");
    expect(el.getAttribute("data-no-nav")).toBe("true");
    expect(viewer.getAttribute("data-no-swipe")).toBe("true");
    expect(viewer.getAttribute("data-no-nav")).toBe("true");

    el.remove();
    expect(viewer.hasAttribute("data-no-swipe")).toBe(false);
    expect(viewer.hasAttribute("data-no-nav")).toBe(false);

    viewer.remove();
  });

  it("defineElement registers once and safely no-ops when customElements is unavailable", () => {
    class OnceEl extends ShadowClawElement {}
    defineElement("test-once-el", OnceEl);
    expect(customElements.get("test-once-el")).toBe(OnceEl);

    // Calling again does not throw
    expect(() => defineElement("test-once-el", OnceEl)).not.toThrow();

    const originalCustomElements = globalThis.customElements;
    Object.defineProperty(globalThis, "customElements", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(() => defineElement("test-missing-ce", OnceEl)).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "customElements", {
        value: originalCustomElements,
        configurable: true,
      });
    }
  });

  it("falls back to <style> when CSSStyleSheet.replaceSync is unavailable", () => {
    const origDesc = Object.getOwnPropertyDescriptor(
      globalThis,
      "CSSStyleSheet",
    );
    Object.defineProperty(globalThis, "CSSStyleSheet", {
      value: undefined,
      configurable: true,
    });

    try {
      class FallbackStyleEl extends ShadowClawElement {
        static styles = ".fallback { color: blue; }";
        static template = `<div class="fallback">OK</div>`;
      }
      defineElement("test-fallback-style-el", FallbackStyleEl);
      const el = new FallbackStyleEl();
      const styleTag = el.shadowRoot?.querySelector("style");
      expect(styleTag?.textContent).toContain(".fallback { color: blue; }");
    } finally {
      if (origDesc) {
        Object.defineProperty(globalThis, "CSSStyleSheet", origDesc);
      }
    }
  });

  it("runs in pure Node.js without HTMLElement or customElements", () => {
    const tsFile = path.resolve(
      process.cwd(),
      "src/components/shadow-claw-element.ts",
    );
    const script = `
      import fs from "node:fs";
      import { registerHooks } from "node:module";
      import { fileURLToPath, pathToFileURL } from "node:url";

      registerHooks({
        resolve(specifier, context, nextResolve) {
          if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
            const parentPath = fileURLToPath(context.parentURL);
            const candidate = new URL(specifier.replace(/\\.js$/, ".ts"), pathToFileURL(parentPath));
            if (fs.existsSync(candidate)) {
              return { shortCircuit: true, url: candidate.href };
            }
          }
          return nextResolve(specifier, context);
        },
      });

      const { ShadowClawElement, BaseElement, defineElement } = await import(${JSON.stringify(pathToFileURL(tsFile).href)});
      if (typeof BaseElement !== "function") throw new Error("BaseElement missing");
      class MyNodeEl extends ShadowClawElement {
        static styles = ".a { color: red; }";
        static disablePageSwipe = true;
      }
      defineElement("my-node-el", MyNodeEl);
      const instance = new MyNodeEl();
      instance.connectedCallback();
      instance.disconnectedCallback();
    `;
    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "-e", script],
      { encoding: "utf8" },
    );
    if (res.status !== 0) {
      throw new Error(
        res.error?.message || res.stderr || res.stdout || "Node smoke failed",
      );
    }
    expect(res.status).toBe(0);
  });
});
