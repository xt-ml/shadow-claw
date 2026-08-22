import { resolveCustomElementScripts } from "./resolve-custom-element-scripts.mjs";

describe("resolveCustomElementScripts", () => {
  it("resolves scripts and allowed domains from customElements object", () => {
    const result = resolveCustomElementScripts(
      {
        customElements: {
          scripts: ["https://allowed.example.com/x.mjs"],
          allowedDomains: ["allowed.example.com"],
        },
      },
      {},
    );

    expect(result.rawScripts).toEqual(["https://allowed.example.com/x.mjs"]);
    expect(result.allowedDomains).toEqual(["allowed.example.com"]);
  });

  it("resolves scripts from fallback config and theme values", () => {
    const fromConfigScripts = resolveCustomElementScripts(
      {
        scripts: ["a.mjs"],
        allowedCustomElementDomains: ["demo.example.com"],
      },
      {},
    );
    expect(fromConfigScripts.rawScripts).toEqual(["a.mjs"]);
    expect(fromConfigScripts.allowedDomains).toEqual(["demo.example.com"]);

    const fromThemeScripts = resolveCustomElementScripts(
      {},
      { scripts: ["b.mjs"] },
    );
    expect(fromThemeScripts.rawScripts).toEqual(["b.mjs"]);
    expect(fromThemeScripts.allowedDomains).toEqual([]);
  });

  it("handles array customElements and defaults", () => {
    const fromArrayCustomElements = resolveCustomElementScripts(
      { customElements: ["array-script.mjs"] },
      {},
    );
    expect(fromArrayCustomElements.rawScripts).toEqual(["array-script.mjs"]);

    const fromCustomElementsDomainless = resolveCustomElementScripts(
      {
        customElements: { scripts: ["x.mjs"] },
        allowedCustomElementDomains: ["fallback.example.com"],
      },
      {},
    );
    expect(fromCustomElementsDomainless.allowedDomains).toEqual([
      "fallback.example.com",
    ]);

    const fromCustomElementsNoScripts = resolveCustomElementScripts(
      { customElements: {}, scripts: ["c.mjs"] },
      {},
    );
    expect(fromCustomElementsNoScripts.rawScripts).toEqual(["c.mjs"]);

    expect(resolveCustomElementScripts({}, {})).toEqual({
      rawScripts: [],
      allowedDomains: [],
    });
    expect(resolveCustomElementScripts({})).toEqual({
      rawScripts: [],
      allowedDomains: [],
    });
  });
});
