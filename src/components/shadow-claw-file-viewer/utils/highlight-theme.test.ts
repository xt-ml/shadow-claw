import { describe, expect, it } from "@jest/globals";
import { DEFAULT_FILE_VIEWER_HIGHLIGHT_CSS } from "./highlight-theme.js";

describe("highlight-theme", () => {
  it("provides valid CSS with dark mode and light mode syntax classes", () => {
    expect(DEFAULT_FILE_VIEWER_HIGHLIGHT_CSS).toContain("code.hljs");
    expect(DEFAULT_FILE_VIEWER_HIGHLIGHT_CSS).toContain(".hljs-keyword");
    expect(DEFAULT_FILE_VIEWER_HIGHLIGHT_CSS).toContain(".hljs-string");
    expect(DEFAULT_FILE_VIEWER_HIGHLIGHT_CSS).toContain(
      ":host-context(.light-mode)",
    );
    expect(DEFAULT_FILE_VIEWER_HIGHLIGHT_CSS).toContain(
      ".file-editor-container",
    );
  });
});
