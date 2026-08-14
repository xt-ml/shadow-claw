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
    "fetch_url",
    "javascript",
    "list_files",
    "open_file",
    "proofread_text",
    "read_file",
    "summarize_text",
    "translate_text",
    "write_file",
    "write_text",
  ],
  customTools: [],
  systemPromptOverride:
    "You are a helpful coding assistant.\n" +
    "When asked to create a file, use write_file with COMPLETE, production-ready content.\n" +
    "For HTML files: include full <!DOCTYPE html>, <html>, <head>, <body>, inline <style> and <script>.\n" +
    "Write working code — do not leave placeholders or TODOs.\n" +
    "Keep responses short.",
};
