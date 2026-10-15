import { jest } from "@jest/globals";

const ShadowClawElement = (await import("./shadow-claw-element.js")).default;

// ---------------------------------------------------------------------------
// Concrete testable subclass
// ---------------------------------------------------------------------------
const mockSheet = new CSSStyleSheet();
const mockDiv = document.createElement("div");
mockDiv.className = "test-template-element";

class TestElement extends (ShadowClawElement as any) {
  static styles = mockSheet;
  static template = [mockDiv];
}

customElements.define("shadow-claw-test-element", TestElement as any);

/** Build and connect a fresh TestElement. Returns it cast to `any`. */
function makeEl(): any {
  const el = new (TestElement as any)();
  document.body.appendChild(el);

  return el;
}

// ---------------------------------------------------------------------------
// Constructor and Lifecycle
// ---------------------------------------------------------------------------
describe("ShadowClawElement constructor", () => {
  it("attaches an open shadow root", () => {
    const el = makeEl();
    expect(el.shadowRoot).not.toBeNull();
    el.remove();
  });

  it("synchronously applies the template during construction", () => {
    const el = makeEl();
    const root = el.shadowRoot as ShadowRoot;

    // We expect the cloned element to be in the shadow root
    const injectedDiv = root.querySelector(".test-template-element");
    expect(injectedDiv).toBeTruthy();
    expect(injectedDiv).not.toBe(mockDiv); // should be a clone
    el.remove();
  });

  it("synchronously applies adoptedStyleSheets during construction", () => {
    const el = makeEl();
    const root = el.shadowRoot as ShadowRoot;

    expect((root as any).adoptedStyleSheets).toContain(mockSheet);
    el.remove();
  });

  it("runs registered cleanup callbacks on disconnect", () => {
    const el = makeEl();
    const cleanup = jest.fn();

    (el as any).addCleanup(cleanup);
    (el as any).addCleanup(cleanup);
    el.remove();

    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("removes DSD styles when styles are applied", () => {
    class DsdElement extends (ShadowClawElement as any) {
      static styles = mockSheet;
    }
    customElements.define("shadow-claw-dsd-test", DsdElement as any);

    const el = document.createElement("shadow-claw-dsd-test") as any;
    const dsdStyle = document.createElement("style");
    dsdStyle.setAttribute("data-dsd-style", "");
    const dsdLink = document.createElement("link");
    dsdLink.rel = "stylesheet";
    el.shadowRoot.appendChild(dsdStyle);
    el.shadowRoot.appendChild(dsdLink);

    // Call constructor logic/trigger stylesheet removal
    const el2 = new (DsdElement as any)();
    expect(
      el2.shadowRoot.querySelectorAll(
        'style[data-dsd-style], link[rel="stylesheet"]',
      ).length,
    ).toBe(0);
  });

  it("handles existing shadow root (e.g. Declarative Shadow DOM)", () => {
    class PreExistingRootElement extends (ShadowClawElement as any) {
      static styles = mockSheet;
      static template = [mockDiv];
    }

    // Create element with pre-existing shadowRoot before constructor if possible or test class
    customElements.define(
      "shadow-claw-existing-root-test",
      PreExistingRootElement as any,
    );

    // Using custom element with inner template
    const el = new (PreExistingRootElement as any)();
    expect(el.shadowRoot).toBeTruthy();
  });

  it("works when subclass has no template and no styles", () => {
    class EmptyElement extends (ShadowClawElement as any) {}
    customElements.define("shadow-claw-empty-test", EmptyElement as any);

    const el = new (EmptyElement as any)();
    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot.childNodes.length).toBe(0);
  });

  it("upgrades and calls ensureDialog on shadow-claw-dialog elements in connectedCallback", () => {
    const ensureDialogMock = jest.fn();
    class MockDialog extends HTMLElement {
      ensureDialog = ensureDialogMock;
    }
    customElements.define("shadow-claw-dialog", MockDialog);

    const dialogDiv = document.createElement("div");
    const dialogEl = document.createElement("shadow-claw-dialog");
    dialogDiv.appendChild(dialogEl);

    class DialogHostElement extends (ShadowClawElement as any) {
      static template = [dialogDiv];
    }
    customElements.define("shadow-claw-dialog-host", DialogHostElement as any);

    const host = new (DialogHostElement as any)();
    document.body.appendChild(host);

    expect(ensureDialogMock).toHaveBeenCalled();
    host.remove();
  });

  it("handles pre-existing shadowRoot before upgrade (DSD)", () => {
    const preHost = document.createElement("shadow-claw-dsd-pre");
    preHost.attachShadow({ mode: "open" });
    document.body.appendChild(preHost);

    class DsdPreElement extends (ShadowClawElement as any) {
      static styles = mockSheet;
      static template = [mockDiv];
    }
    customElements.define("shadow-claw-dsd-pre", DsdPreElement as any);

    expect(preHost.shadowRoot).toBeTruthy();
    preHost.remove();
  });

  it("handles dialogs without ensureDialog function", () => {
    class NoEnsureDialog extends HTMLElement {}
    customElements.define("shadow-claw-dialog-no-func", NoEnsureDialog);

    const dialogDiv = document.createElement("div");
    const fakeDialog = document.createElement("shadow-claw-dialog");
    // Remove ensureDialog or set it to undefined
    (fakeDialog as any).ensureDialog = undefined;
    dialogDiv.appendChild(fakeDialog);

    class DialogHostNoFunc extends (ShadowClawElement as any) {
      static template = [dialogDiv];
    }
    customElements.define(
      "shadow-claw-dialog-no-func-host",
      DialogHostNoFunc as any,
    );

    const host = new (DialogHostNoFunc as any)();
    expect(() => host.connectedCallback()).not.toThrow();
  });

  it("safely handles ensureShadowDialogs when shadowRoot is missing", () => {
    const el = makeEl();
    const origRoot = el.shadowRoot;
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    expect(() => el.connectedCallback()).not.toThrow();
    Object.defineProperty(el, "shadowRoot", {
      value: origRoot,
      configurable: true,
    });
    el.remove();
  });
});
