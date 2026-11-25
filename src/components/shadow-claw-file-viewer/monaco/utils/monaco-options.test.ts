import { describe, expect, it } from "@jest/globals";

import { buildMonacoOptions } from "./monaco-options.js";

const base = {
  viewportWidth: 1200,
  coarsePointer: false,
  reducedMotion: false,
  readOnly: false,
  ariaLabel: "Code editor: a.ts",
};

describe("buildMonacoOptions", () => {
  it("uses a compact mobile profile on narrow viewports", () => {
    const o = buildMonacoOptions({ ...base, viewportWidth: 360 });

    expect(o.minimap).toEqual({ enabled: false });
    expect(o.wordWrap).toBe("on");
    expect(o.fontSize).toBeGreaterThanOrEqual(14);
    expect(o.folding).toBe(false);
    expect(o.glyphMargin).toBe(false);
    expect(o.lineNumbersMinChars).toBe(3);
  });

  it("uses the compact profile for coarse pointers on wide viewports", () => {
    const o = buildMonacoOptions({ ...base, coarsePointer: true });

    expect(o.minimap).toEqual({ enabled: false });
    expect(o.wordWrap).toBe("on");
  });

  it("enables desktop affordances on wide fine-pointer viewports", () => {
    const o = buildMonacoOptions(base);

    expect(o.minimap).toEqual({ enabled: true });
    expect(o.wordWrap).toBe("off");
    expect(o.folding).toBe(true);
  });

  it("always sets accessibility and layout essentials", () => {
    const o = buildMonacoOptions({ ...base, fontFamily: "Fira Code" });

    expect(o.automaticLayout).toBe(true);
    expect(o.accessibilitySupport).toBe("auto");
    expect(o.ariaLabel).toBe("Code editor: a.ts");
    expect(o.tabSize).toBe(2);
    expect(o.scrollBeyondLastLine).toBe(false);
    expect(o.fontFamily).toBe("Fira Code");
    expect(o.readOnly).toBe(false);
  });

  it("reflects read-only", () => {
    expect(buildMonacoOptions({ ...base, readOnly: true }).readOnly).toBe(true);
  });

  it("disables motion when reduced motion is requested", () => {
    const o = buildMonacoOptions({ ...base, reducedMotion: true });

    expect(o.smoothScrolling).toBe(false);
    expect(o.cursorSmoothCaretAnimation).toBe("off");
    expect(o.cursorBlinking).toBe("solid");

    const normal = buildMonacoOptions(base);
    expect(normal.smoothScrolling).toBe(true);
  });
});
