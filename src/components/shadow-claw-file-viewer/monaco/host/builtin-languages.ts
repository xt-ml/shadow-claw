import type * as monacoNs from "monaco-editor";

import type { LanguageRegistry } from "./language-registry.js";
import {
  MERMAID_LANGUAGE_ID,
  mermaidLanguage,
  mermaidLanguageConfiguration,
} from "./languages/mermaid.js";

/**
 * Registers ShadowClaw's built-in Monaco languages lazily.
 *
 * JSON, CSS, and HTML have full language-service workers; SVG (XML),
 * Markdown, Mermaid, and common programming languages load their Monarch
 * tokenizers on demand. Add future languages by appending to this list.
 */
export function registerBuiltinLanguages(
  registry: LanguageRegistry,
  monaco: Pick<typeof monacoNs, "languages">,
): void {
  registry.register({
    id: "mermaid",
    load: async () => {
      monaco.languages.register({
        id: MERMAID_LANGUAGE_ID,
        extensions: [".mmd", ".mermaid"],
        aliases: ["Mermaid", "mermaid"],
      });
      monaco.languages.setMonarchTokensProvider(
        MERMAID_LANGUAGE_ID,
        mermaidLanguage,
      );
      monaco.languages.setLanguageConfiguration(
        MERMAID_LANGUAGE_ID,
        mermaidLanguageConfiguration,
      );
    },
  });

  registry.register({
    id: "json",
    load: () => import("monaco-editor/languages/features/json/register.js"),
  });

  registry.register({
    id: "css",
    load: async () => {
      await Promise.all([
        import("monaco-editor/languages/features/css/register.js"),
        import("monaco-editor/languages/definitions/css/register.js"),
      ]);
    },
  });

  registry.register({
    id: "scss",
    dependencies: ["css"],
    load: () => import("monaco-editor/languages/definitions/scss/register.js"),
  });

  registry.register({
    id: "less",
    dependencies: ["css"],
    load: () => import("monaco-editor/languages/definitions/less/register.js"),
  });

  registry.register({
    id: "html",
    dependencies: ["css", "javascript"],
    load: async () => {
      await Promise.all([
        import("monaco-editor/languages/features/html/register.js"),
        import("monaco-editor/languages/definitions/html/register.js"),
      ]);
    },
  });

  registry.register({
    id: "xml",
    load: () => import("monaco-editor/languages/definitions/xml/register.js"),
  });

  registry.register({
    id: "markdown",
    dependencies: [
      "mermaid",
      "xml",
      "json",
      "css",
      "html",
      "javascript",
      "typescript",
      "shell",
      "yaml",
    ],
    load: () =>
      import("monaco-editor/languages/definitions/markdown/register.js"),
  });

  const definitions: Array<[string, () => Promise<unknown>]> = [
    [
      "javascript",
      () =>
        import("monaco-editor/languages/definitions/javascript/register.js"),
    ],
    [
      "typescript",
      () =>
        import("monaco-editor/languages/definitions/typescript/register.js"),
    ],
    [
      "python",
      () => import("monaco-editor/languages/definitions/python/register.js"),
    ],
    [
      "ruby",
      () => import("monaco-editor/languages/definitions/ruby/register.js"),
    ],
    [
      "rust",
      () => import("monaco-editor/languages/definitions/rust/register.js"),
    ],
    [
      "shell",
      () => import("monaco-editor/languages/definitions/shell/register.js"),
    ],
    [
      "yaml",
      () => import("monaco-editor/languages/definitions/yaml/register.js"),
    ],
    [
      "sql",
      () => import("monaco-editor/languages/definitions/sql/register.js"),
    ],
    [
      "java",
      () => import("monaco-editor/languages/definitions/java/register.js"),
    ],
    [
      "php",
      () => import("monaco-editor/languages/definitions/php/register.js"),
    ],
    ["go", () => import("monaco-editor/languages/definitions/go/register.js")],
    [
      "dockerfile",
      () =>
        import("monaco-editor/languages/definitions/dockerfile/register.js"),
    ],
  ];

  for (const [id, load] of definitions) {
    registry.register({ id, load });
  }
}
