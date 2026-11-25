export interface MonacoOptionsInput {
  viewportWidth: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
  readOnly: boolean;
  ariaLabel: string;
  fontFamily?: string;
}

/** Viewport width at or below which the compact (mobile) profile applies. */
export const MONACO_COMPACT_MAX_WIDTH = 640;

/**
 * Pure builder for Monaco standalone editor options. Mobile first: the compact
 * profile is used for narrow viewports and touch pointers.
 */
export function buildMonacoOptions(input: MonacoOptionsInput) {
  const compact =
    input.coarsePointer || input.viewportWidth <= MONACO_COMPACT_MAX_WIDTH;

  return {
    accessibilitySupport: "auto" as const,
    ariaLabel: input.ariaLabel,
    automaticLayout: true,
    cursorBlinking: input.reducedMotion
      ? ("solid" as const)
      : ("blink" as const),
    cursorSmoothCaretAnimation: input.reducedMotion
      ? ("off" as const)
      : ("on" as const),
    folding: !compact,
    fontFamily: input.fontFamily,
    fontSize: compact ? 14 : 13,
    glyphMargin: false,
    lineNumbersMinChars: compact ? 3 : 5,
    minimap: { enabled: !compact },
    readOnly: input.readOnly,
    scrollBeyondLastLine: false,
    smoothScrolling: !input.reducedMotion,
    tabSize: 2,
    wordWrap: compact ? ("on" as const) : ("off" as const),
  };
}
