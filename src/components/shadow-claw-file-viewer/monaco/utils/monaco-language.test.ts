import { describe, expect, it } from "@jest/globals";

import { getMonacoLanguage } from "./monaco-language.js";

describe("getMonacoLanguage", () => {
  it.each([
    ["app.js", "javascript"],
    ["mod.mjs", "javascript"],
    ["mod.cjs", "javascript"],
    ["view.jsx", "javascript"],
    ["main.ts", "typescript"],
    ["view.tsx", "typescript"],
    ["x.mts", "typescript"],
    ["data.json", "json"],
    ["tsconfig.jsonc", "json"],
    ["manifest.webmanifest", "json"],
    ["style.css", "css"],
    ["style.scss", "scss"],
    ["style.less", "less"],
    ["index.html", "html"],
    ["index.htm", "html"],
    ["logo.svg", "xml"],
    ["feed.xml", "xml"],
    ["README.md", "markdown"],
    ["notes.markdown", "markdown"],
    ["flow.mmd", "mermaid"],
    ["flow.mermaid", "mermaid"],
    ["script.py", "python"],
    ["script.rb", "ruby"],
    ["main.rs", "rust"],
    ["run.sh", "shell"],
    ["run.bash", "shell"],
    ["config.yml", "yaml"],
    ["config.yaml", "yaml"],
    ["q.sql", "sql"],
    ["Main.java", "java"],
    ["index.php", "php"],
    ["main.go", "go"],
    ["Dockerfile", "dockerfile"],
  ])("maps %s to %s", (name, expected) => {
    expect(getMonacoLanguage(name)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(getMonacoLanguage("LOGO.SVG")).toBe("xml");
    expect(getMonacoLanguage("README.MD")).toBe("markdown");
  });

  it("uses only the last extension and handles nested paths", () => {
    expect(getMonacoLanguage("docs/a.b/flow.mmd")).toBe("mermaid");
    expect(getMonacoLanguage("archive.tar.json")).toBe("json");
  });

  it("falls back to plaintext", () => {
    expect(getMonacoLanguage("notes.unknownext")).toBe("plaintext");
    expect(getMonacoLanguage("noextension")).toBe("plaintext");
    expect(getMonacoLanguage("")).toBe("plaintext");
  });
});
