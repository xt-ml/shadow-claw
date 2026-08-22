import { normalizeCustomElementScriptSrc } from "./normalize-custom-element-script-src.mjs";

describe("normalizeCustomElementScriptSrc", () => {
  it("normalizes local prefixed script paths", () => {
    expect(normalizeCustomElementScriptSrc("pages/main/x.mjs")).toBe("x.mjs");
    expect(normalizeCustomElementScriptSrc("resources/x.mjs")).toBe("x.mjs");
    expect(normalizeCustomElementScriptSrc("deps/x.mjs")).toBe("x.mjs");
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
