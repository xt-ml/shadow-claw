import { jest } from "@jest/globals";

const ShadowClawElement = (await import("./shadow-claw-element.js")).default;

// ---------------------------------------------------------------------------
// Concrete testable subclass — points to non-existent assets so the fetch
// mock in jest-setup.ts returns 404 with empty content, giving us a silently-
// resolved onTemplateReady / onStylesReady without hitting real files.
// Protected methods are exposed via `(el as any)` casts in tests.
// ---------------------------------------------------------------------------
class TestElement extends (ShadowClawElement as any) {
  static styles = "nonexistent.css";
  static template = "nonexistent.html";
}

customElements.define("shadow-claw-test-element", TestElement as any);

/** Build and connect a fresh TestElement. Returns it cast to `any`. */
function makeEl(): any {
  const el = new (TestElement as any)();
  document.body.appendChild(el);

  return el;
}

// ---------------------------------------------------------------------------
// Helpers to control fetch responses within individual tests
// ---------------------------------------------------------------------------
function mockFetchOnce(text: string) {
  jest.mocked(globalThis.fetch).mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(text),
  } as Response);
}

function mockFetchFailOnce() {
  jest
    .mocked(globalThis.fetch)
    .mockRejectedValueOnce(new Error("network error"));
}

// ---------------------------------------------------------------------------
// Static helpers
// ---------------------------------------------------------------------------
describe("ShadowClawElement static helpers", () => {
  describe("getTemplate", () => {
    it("parses a <template>-wrapped HTML file and returns its content children", async () => {
      mockFetchOnce("<template><div class='foo'></div><p>bar</p></template>");
      const children = await ShadowClawElement.getTemplate("fake.html");
      expect(children).toHaveLength(2);
      expect((children[0] as Element).className).toBe("foo");
      expect((children[1] as Element).tagName).toBe("P");
    });

    it("falls back to head+body children when there is no <template> wrapper", async () => {
      mockFetchOnce("<div class='root'><span>hi</span></div>");
      const children = await ShadowClawElement.getTemplate("fake.html");
      // DOMParser wraps into <html><head/><body>...<body/></html>
      // Our div ends up in body.
      const tags = (children as Element[]).map((c) => c.tagName);
      expect(tags).toContain("DIV");
    });

    it("rejects when fetch fails", async () => {
      mockFetchFailOnce();
      await expect(
        ShadowClawElement.getTemplate("fail.html"),
      ).rejects.toThrow();
    });
  });

  describe("getTemplateSource", () => {
    it("returns the raw HTML string", async () => {
      mockFetchOnce("<template><div></div></template>");
      const src = await ShadowClawElement.getTemplateSource("fake.html");
      expect(src).toBe("<template><div></div></template>");
    });
  });

  describe("setTemplate", () => {
    it("appends template children to the shadow root", () => {
      const el = makeEl();
      const root = el.shadowRoot as ShadowRoot;
      // Clear any nodes from the constructor's template load
      root.replaceChildren();

      const div = document.createElement("div");
      div.className = "injected";
      ShadowClawElement.setTemplate(root, [div]);

      expect(root.querySelector(".injected")).toBe(div);
      el.remove();
    });
  });

  describe("getStyles", () => {
    it("returns a CSSStyleSheet populated with the fetched CSS", async () => {
      mockFetchOnce(":host { color: red; }");
      const sheet = await ShadowClawElement.getStyles("fake.css");
      expect(sheet).toBeInstanceOf(CSSStyleSheet);
      // The mock CSSStyleSheet stores the CSS in _css
      expect((sheet as any)._css).toContain("color: red");
    });

    it("rejects when fetch fails", async () => {
      mockFetchFailOnce();
      await expect(ShadowClawElement.getStyles("fail.css")).rejects.toThrow();
    });
  });

  describe("getStylesSource", () => {
    it("returns the raw CSS string", async () => {
      mockFetchOnce(":host { display: block; }");
      const src = await ShadowClawElement.getStylesSource("fake.css");
      expect(src).toBe(":host { display: block; }");
    });
  });

  describe("setStyles", () => {
    it("assigns the stylesheet to shadowRoot.adoptedStyleSheets", () => {
      const el = makeEl();
      const root = el.shadowRoot as ShadowRoot;
      const sheet = new CSSStyleSheet();
      ShadowClawElement.setStyles(root, sheet);
      expect((root as any).adoptedStyleSheets).toContain(sheet);
      el.remove();
    });
  });
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------
describe("ShadowClawElement constructor", () => {
  it("attaches an open shadow root", () => {
    const el = makeEl();
    expect(el.shadowRoot).not.toBeNull();
    el.remove();
  });

  it("exposes onTemplateReady as a Promise", () => {
    const el = makeEl();
    expect(el.onTemplateReady).toBeInstanceOf(Promise);
    el.remove();
  });

  it("exposes onStylesReady as a Promise", () => {
    const el = makeEl();
    expect(el.onStylesReady).toBeInstanceOf(Promise);
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
