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
});
