import { ToolProfile } from "./types.js";

/**
 * Built-in profile optimized for Gemini Nano (Prompt API).
 * Minimizes context consumption so Nano has maximum tokens for generation.
 */
export const NANO_BUILTIN_PROFILE: ToolProfile = {
  id: "__builtin_nano",
  name: "Nano Optimized",
  providerId: "prompt_api",
  enabledToolNames: [
    "bash",
    "read_file",
    "write_file",
    "list_files",
    "attach_file_to_chat",
    "open_file",
    "fetch_url",
    "update_memory",
    "create_task",
    "javascript",
    "list_tasks",
    "show_toast",
    "send_notification",
  ],
  customTools: [],
  systemPromptOverride:
    "You are a helpful coding assistant.\n" +
    "When asked to create a file, use write_file with COMPLETE, production-ready content.\n" +
    "For HTML files: include full <!DOCTYPE html>, <html>, <head>, <body>, inline <style> and <script>.\n" +
    "Write working code — do not leave placeholders or TODOs.\n" +
    "Keep responses short.",
};
