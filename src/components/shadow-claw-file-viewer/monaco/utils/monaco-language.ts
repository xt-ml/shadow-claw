/**
 * Map a file name to a Monaco language id. Unknown files are `plaintext`.
 *
 * To support a new language: add the extension here, then register a loader
 * for the language id in `host/builtin-languages.ts`.
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  bash: "shell",
  cjs: "javascript",
  css: "css",
  go: "go",
  htm: "html",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsonc: "json",
  jsx: "javascript",
  less: "less",
  markdown: "markdown",
  md: "markdown",
  mermaid: "mermaid",
  mjs: "javascript",
  mmd: "mermaid",
  mts: "typescript",
  cts: "typescript",
  php: "php",
  py: "python",
  rb: "ruby",
  rs: "rust",
  scss: "scss",
  sh: "shell",
  sql: "sql",
  svg: "xml",
  ts: "typescript",
  tsx: "typescript",
  webmanifest: "json",
  xml: "xml",
  xsd: "xml",
  xsl: "xml",
  xslt: "xml",
  yaml: "yaml",
  yml: "yaml",
  zsh: "shell",
};

const FILENAME_TO_LANGUAGE: Record<string, string> = {
  dockerfile: "dockerfile",
};

export function getMonacoLanguage(fileName: string): string {
  const base = (fileName || "").split(/[\\/]/).pop()?.toLowerCase() || "";

  if (!base) {
    return "plaintext";
  }

  if (FILENAME_TO_LANGUAGE[base]) {
    return FILENAME_TO_LANGUAGE[base];
  }

  const dot = base.lastIndexOf(".");
  if (dot < 0) {
    return "plaintext";
  }

  return EXTENSION_TO_LANGUAGE[base.slice(dot + 1)] || "plaintext";
}
