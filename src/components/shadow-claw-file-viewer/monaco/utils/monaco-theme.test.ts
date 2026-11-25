import { describe, expect, it } from "@jest/globals";

import { buildMonacoTheme, normalizeColor } from "./monaco-theme.js";

describe("normalizeColor", () => {
  it("normalizes hex and rgb values", () => {
    expect(normalizeColor("#fff")).toBe("#ffffff");
    expect(normalizeColor(" #0F172A ")).toBe("#0f172a");
    expect(normalizeColor("#0f172a80")).toBe("#0f172a80");
    expect(normalizeColor("rgb(15, 23, 42)")).toBe("#0f172a");
    expect(normalizeColor("rgba(255, 0, 0, 0.5)")).toBe("#ff000080");
  });

  it("rejects unusable values", () => {
    expect(normalizeColor("")).toBeUndefined();
    expect(normalizeColor(undefined)).toBeUndefined();
    expect(normalizeColor("var(--x)")).toBeUndefined();
    expect(normalizeColor("rebeccapurple")).toBeUndefined();
    expect(normalizeColor("#12")).toBeUndefined();
  });
});

describe("buildMonacoTheme", () => {
  const props = {
    "--shadow-claw-bg-primary": "#0f172a",
    "--shadow-claw-text-primary": "#f1f5f9",
    "--shadow-claw-accent-primary": "#94a3b8",
  };

  it("builds a dark theme from custom properties", () => {
    const { name, data } = buildMonacoTheme({
      theme: "dark",
      customProperties: props,
    });

    expect(name).toBe("shadow-claw-dark");
    expect(data.base).toBe("vs-dark");
    expect(data.inherit).toBe(true);
    expect(data.colors["editor.background"]).toBe("#0f172a");
    expect(data.colors["editor.foreground"]).toBe("#f1f5f9");
    expect(data.colors["focusBorder"]).toBe("#94a3b8");
  });

  it("builds a light theme", () => {
    const { name, data } = buildMonacoTheme({
      theme: "light",
      customProperties: {
        "--shadow-claw-bg-primary": "rgb(248, 250, 252)",
        "--shadow-claw-text-primary": "#0f172a",
      },
    });

    expect(name).toBe("shadow-claw-light");
    expect(data.base).toBe("vs");
    expect(data.colors["editor.background"]).toBe("#f8fafc");
  });

  it("omits colors that cannot be resolved so Monaco defaults apply", () => {
    const { data } = buildMonacoTheme({
      theme: "dark",
      customProperties: { "--shadow-claw-bg-primary": "var(--nope)" },
    });

    expect(data.colors["editor.background"]).toBeUndefined();
    expect(data.base).toBe("vs-dark");
  });

  it("selects high-contrast themes when forced colors are active", () => {
    expect(
      buildMonacoTheme({
        theme: "dark",
        customProperties: {},
        forcedColors: true,
      }).name,
    ).toBe("hc-black");
    expect(
      buildMonacoTheme({
        theme: "light",
        customProperties: {},
        forcedColors: true,
      }).name,
    ).toBe("hc-light");
  });
});
