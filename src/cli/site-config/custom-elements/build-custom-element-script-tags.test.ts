import { describe, it, expect } from "@jest/globals";
import { buildCustomElementScriptTags } from "./build-custom-element-script-tags.js";

describe("buildCustomElementScriptTags", () => {
  it("builds escaped script tags for strings and object entries", () => {
    const tags = buildCustomElementScriptTags(
      [
        "pages/main/a.mjs",
        {
          src: "pages/resources/b.mjs",
          type: 'module"onload="x',
          async: true,
          defer: true,
        },
        { src: "pages/resources/c.mjs" },
      ],
      (s) => s.replace(/"/g, "&quot;"),
    );

    expect(tags).toContain('<script type="module" src="/a.mjs"></script>');
    expect(tags).toContain(
      '<script type="module&quot;onload=&quot;x" async defer src="/b.mjs"></script>',
    );
    expect(tags).toContain('<script type="module" src="/c.mjs"></script>');
  });

  it("emits a companion init script for hasInit:true entries", () => {
    const tags = buildCustomElementScriptTags(
      [
        {
          src: ".agents/scripts/main/block-garden-adapter.js",
          hasInit: true,
        },
      ],
      (s) => s,
    );
    expect(tags).toContain(
      '<script type="module" src="/.agents/scripts/main/block-garden-adapter.js"></script>',
    );
    expect(tags).toContain(
      'import("/.agents/scripts/main/block-garden-adapter.js")',
    );
    expect(tags).toContain("m.init()");
  });

  it("returns empty output for non-array, empty, and invalid entries", () => {
    expect(buildCustomElementScriptTags([], (s) => s)).toBe("");
    expect(buildCustomElementScriptTags("not-an-array" as any, (s) => s)).toBe(
      "",
    );
    expect(buildCustomElementScriptTags([123] as any, (s) => s)).toBe("");
  });
});
