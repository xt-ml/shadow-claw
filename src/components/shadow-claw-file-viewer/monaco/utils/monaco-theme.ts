import type { MonacoCustomProperties, MonacoThemeName } from "../types.js";

export interface MonacoThemeData {
  base: "vs" | "vs-dark" | "hc-black" | "hc-light";
  inherit: boolean;
  rules: Array<{ token: string; foreground?: string }>;
  colors: Record<string, string>;
}

export interface BuiltMonacoTheme {
  name: string;
  data: MonacoThemeData;
}

const hex2 = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

/** Normalise `#rgb`, `#rrggbb[aa]`, `rgb()` and `rgba()` to `#rrggbb[aa]`. */
export function normalizeColor(value: string | undefined): string | undefined {
  const v = (value || "").trim().toLowerCase();
  if (!v) {
    return undefined;
  }

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (hex) {
    const h = hex[1];
    return h.length === 3
      ? `#${h
          .split("")
          .map((c) => c + c)
          .join("")}`
      : `#${h}`;
  }

  const rgb =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*(\d*\.?\d+)\s*)?\)$/.exec(
      v,
    );
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    const base = `#${hex2(+rgb[1])}${hex2(+rgb[2])}${hex2(+rgb[3])}`;
    return alpha < 1 ? `${base}${hex2(alpha * 255)}` : base;
  }

  return undefined;
}

export interface BuildMonacoThemeInput {
  theme: MonacoThemeName;
  customProperties: MonacoCustomProperties;
  forcedColors?: boolean;
}

const COLOR_MAP: Array<[string, string]> = [
  ["editor.background", "--shadow-claw-bg-primary"],
  ["editor.foreground", "--shadow-claw-text-primary"],
  ["editorCursor.foreground", "--shadow-claw-text-primary"],
  ["focusBorder", "--shadow-claw-accent-primary"],
];

export function buildMonacoTheme(
  input: BuildMonacoThemeInput,
): BuiltMonacoTheme {
  const { theme, customProperties, forcedColors } = input;

  if (forcedColors) {
    return {
      name: theme === "dark" ? "hc-black" : "hc-light",
      data: {
        base: theme === "dark" ? "hc-black" : "hc-light",
        inherit: true,
        rules: [],
        colors: {},
      },
    };
  }

  const colors: Record<string, string> = {};
  for (const [key, prop] of COLOR_MAP) {
    const resolved = normalizeColor(customProperties[prop]);
    if (resolved) {
      colors[key] = resolved;
    }
  }

  return {
    name: theme === "dark" ? "shadow-claw-dark" : "shadow-claw-light",
    data: {
      base: theme === "dark" ? "vs-dark" : "vs",
      inherit: true,
      rules: [],
      colors,
    },
  };
}
