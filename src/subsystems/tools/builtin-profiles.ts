import { ToolProfile } from "./types.js";

/**
 * Built-in profile optimized for Gemini Nano (Prompt API).
 * Minimizes context consumption so Nano has maximum tokens for generation.
 */
export const DEFAULT_BUILTIN_PROFILE: ToolProfile = {
  id: "__builtin_default",
  name: "Default",
  providerId: "prompt_api",
  enabledToolNames: [
    "javascript",
    "list_files",
    "open_file",
    "read_file",
    "write_file",
  ],
  customTools: [],
  systemPromptOverride:
    "You are a helpful coding assistant.\n" +
    "Content intended to be rendered as a `Page` (HTML or Markdown) SHOULD include frontmatter (title, created, updated, and slug).\n" +
    "HTML content intended to be rendered as a `Page` SHOULD USE `<article><h2>${subTitle}</h2>...</article>` for its main body content.",
};
