import { normalizeTerminalText } from "./normalize-terminal-text.js";
import { extractLastPromptLine } from "./extract-last-prompt-line.js";

describe("normalizeTerminalText", () => {
  it("handles clear-line escape sequence with and without newlines", () => {
    // ESC [ 2 K is clear line
    // With newline
    const res1 = normalizeTerminalText("line1\nline2", "\u001b[2K", "", {
      respectEraseSequences: true,
    });
    expect(res1.text).toBe("line1\n");

    // Without newline
    const res2 = normalizeTerminalText("singleline", "\u001b[2K", "", {
      respectEraseSequences: true,
    });
    expect(res2.text).toBe("");
  });

  it("handles backspace and DEL control characters", () => {
    const res = normalizeTerminalText("hello", "o\b\u007f", "", {
      respectEraseSequences: true,
    });
    // "hello" + "o" -> "helloo" -> \b -> "hello" -> \u007f -> "hell"
    expect(res.text).toBe("hell");
  });

  it("skips non-printable control characters and bell", () => {
    const res = normalizeTerminalText("start", "\u0001\u0007\u0002end", "", {
      respectEraseSequences: true,
    });
    expect(res.text).toBe("startend");
  });
});

describe("extractLastPromptLine", () => {
  it("returns empty string when text is empty or falsy", () => {
    expect(extractLastPromptLine("")).toBe("");
    expect(extractLastPromptLine(null as any)).toBe("");
  });

  it("extracts prompt ending with # or $", () => {
    expect(extractLastPromptLine("output line\nalpine:~# ")).toBe("alpine:~# ");
    expect(extractLastPromptLine("some text\nuser@host:~$ ")).toBe(
      "user@host:~$ ",
    );
    expect(extractLastPromptLine("no prompt here")).toBe("");
  });
});
