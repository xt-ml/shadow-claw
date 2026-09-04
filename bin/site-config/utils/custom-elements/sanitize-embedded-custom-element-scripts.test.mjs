import { sanitizeEmbeddedCustomElementScripts } from "./sanitize-embedded-custom-element-scripts.mjs";

describe("sanitizeEmbeddedCustomElementScripts", () => {
  it("removes unapproved scripts and does not mutate input config", () => {
    const config = {
      customElements: {
        scripts: [
          "https://allowed.example.com/a.mjs",
          "https://bad.example.com/b.mjs",
          { src: "local.mjs" },
        ],
      },
    };

    const sanitized = sanitizeEmbeddedCustomElementScripts(config, [
      "allowed.example.com",
    ]);

    expect(sanitized.customElements.scripts).toEqual([
      "https://allowed.example.com/a.mjs",
      { src: "local.mjs" },
    ]);
    expect(config.customElements.scripts).toEqual([
      "https://allowed.example.com/a.mjs",
      "https://bad.example.com/b.mjs",
      { src: "local.mjs" },
    ]);
  });

  it("leaves non-object customElements untouched and filters missing src entries", () => {
    const untouched = sanitizeEmbeddedCustomElementScripts(
      { customElements: ["a.mjs"], site: { title: "Demo" } },
      ["allowed.example.com"],
    );
    expect(untouched).toEqual({
      customElements: ["a.mjs"],
      site: { title: "Demo" },
    });

    const removesMissingSrc = sanitizeEmbeddedCustomElementScripts(
      {
        customElements: {
          scripts: [
            {},
            { src: "local.mjs" },
            { src: "another.mjs", hasInit: true },
          ],
        },
      },
      ["allowed.example.com"],
    );
    expect(removesMissingSrc.customElements.scripts).toEqual([
      { src: "local.mjs" },
      { src: "another.mjs", hasInit: true },
    ]);
  });
});
