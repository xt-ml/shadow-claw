import { describe, it, expect } from "@jest/globals";
import { normalizeCustomElementScriptSrc } from "./normalize-custom-element-script-src.js";

describe("normalizeCustomElementScriptSrc", () => {
  it("normalizes local prefixed script paths and adds a leading slash", () => {
    expect(normalizeCustomElementScriptSrc("pages/main/x.mjs")).toBe("/x.mjs");
    expect(normalizeCustomElementScriptSrc("resources/x.mjs")).toBe("/x.mjs");
    expect(normalizeCustomElementScriptSrc("deps/x.mjs")).toBe("/x.mjs");
  });

  it("preserves already root-relative paths unchanged", () => {
    expect(normalizeCustomElementScriptSrc("/assets/script.js")).toBe(
      "/assets/script.js",
    );
  });

  it("adds a leading slash to .agents/ paths so they resolve from origin root", () => {
    expect(
      normalizeCustomElementScriptSrc(
        ".agents/scripts/main/block-garden-adapter.js",
      ),
    ).toBe("/.agents/scripts/main/block-garden-adapter.js");
  });

  it("keeps absolute remote URLs unchanged", () => {
    expect(normalizeCustomElementScriptSrc("https://example.com/x.mjs")).toBe(
      "https://example.com/x.mjs",
    );
    expect(normalizeCustomElementScriptSrc("//cdn.example.com/x.mjs")).toBe(
      "//cdn.example.com/x.mjs",
    );
  });
});
